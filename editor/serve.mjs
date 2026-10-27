/**
 * NodeGX Studio — the server behind `studio.html`, an editor for a NodeGX app built from the NodeGX kit.
 *
 *   node serve.mjs <project-dir> [--port n]
 *
 *   /                      studio.html
 *   /runtime/*             the deploy runtime (`@nodegx/preview`'s dist/external/deploy/)
 *   /preview.js            `@nodegx/preview`'s in-page build
 *   /look.js, /specs.js    `@nodegx/canvas-look` and `@nodegx/node-spec` as ES modules (vendor/)
 *   GET  /phrasebook.json  STU-052: the composer's follow-ups by type (phrases.mjs over NodeGX's
 *                          scripts/bubble-phrasebook/rows.js, vendor/phrasebook/, the community's Bubble→Noodl dictionary as executed)
 *
 * Every kit piece is where lib/nodegx.mjs says (STU-006: vendor/ and node_modules/, or the checkout NODEGX_REPO names).
 *   GET  /api/project      every text file of the project folder as one path → text map, plus the folder's name
 *   POST /api/save         { files: { path: text }, removed: [path], bases: { path: text | null }, force? } — written under
 *                          the project folder, nothing else. `bases` is each file as the page last had it: when the disk
 *                          no longer says that (somebody else wrote it meanwhile) the save is refused with 409 and the
 *                          files as they are now, so the page can ask; `force` writes anyway
 *   GET  /api/events?client=id  server-sent events: `{ changed: { path: text }, removed: [path] }` whenever a file of the
 *                          project changes and Studio did not write it (Claude Code through MCP, VS Code, `git pull`)
 *   ANY  /api/backend/*    forwarded to the project's bound backend (`metadata.cloudservices.endpoint`) with the app id
 *                          header the runtime sends; the Data tab reads rows through it, as the backend's admin when it
 *                          is a local one (its own `secrets.json`, read here and never sent to the page)
 *   GET  /api/backend-status    the project's backend (STU-004): `{ phase, name, endpoint, error }`, also pushed over
 *                          /api/events as `{ backend }` whenever it changes; `{ live }` the same for its live one
 *   POST /api/backend-provision a backend for a project bound to none: NodeGX's provision, then the binding
 *   ANY  /api/live/*       STU-065: as /api/backend/*, to the app's live backend (`metadata.cloudservicesLive`)
 *   POST /api/live-provision    a live backend for the app: NodeGX's provision, its rules kept on this computer too,
 *                          then development's schema deployed to it (nothing in it can be lost: it is empty)
 *   GET  /api/live-compare      what Deploy to live would add and what it would lose (lib/live.mjs compare)
 *   POST /api/live-promote      { allowDestructive } Deploy to live; refused with the plan when it would lose something
 *   POST /api/live-copy         { from: 'development' | 'live', types: [], dryRun } rows from one to the other
 *   GET  /fields.js        STU-061: the backend manager's field kinds (vendor/fields.js, or bundled from NODEGX_REPO)
 *   GET  /api/agent        STU-005: Claude Code and this folder (`lib/agent.mjs` stateOf): `{ state, serverName, command, … }`
 *   POST /api/agent-connect     "Connect Claude Code": the NodeGX editor's writer of `.mcp.json`, `CLAUDE.md`, `AGENTS.md`
 *   GET  /api/images       STU-051: every image file in the project folder, `[path]`, for the image popover
 *   POST /api/asset?name=x the request's bytes as an image under `assets/` (the NodeGX editor's projectAssets.ts:
 *                          made unique before the extension, `logo-1.png`), answering `{ path }`
 *   POST /api/automations/trigger  P127 BKO-005: { id, enabled?, time?: { hour, minute }, client } one trigger turned on or
 *                          off, or a daily schedule moved, on the backend and in `nodegx.automations.json` together
 *                          (BKO-001's rule: the backend first, then the file; the backend put back if the file fails).
 *                          Answers `{ file, text, backend }`: the file's new text and what the backend stored
 *
 * STU-004: a project bound to a local backend (`lib/backend.mjs`) has it started when this server starts — or adopted
 * when the NodeGX editor or Claude Code already runs it — and stopped when this server stops (SIGTERM / SIGINT; the
 * backend's own --parent-pid guard covers a kill). A change to the binding (Claude Code's provision_backend, a
 * `git pull`) is followed the same way.
 *
 * The page holds the project in memory in the kit's own store (`V2ProjectStore` over `memoryFiles`), makes every edit
 * through it, and sends the files it changed here. This file knows nothing about nodes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, watch, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fieldsBundle, kit, nodegxRepo, studioRoot } from '../lib/nodegx.mjs';
import * as backends from '../lib/backend.mjs';
import * as lives from '../lib/live.mjs';
import * as agent from '../lib/agent.mjs';
import { createRequire } from 'node:module';
import { TYPES, phrasesFor } from './phrases.mjs';
import { CLOUD, scriptTableNames } from './fngraph.mjs';
import { AUTOMATIONS_FILE, atTime, readAutomations } from './automations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const flag = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
};
const projectDir = resolve(process.argv.slice(2).find((a) => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--port') ?? '.');
if (!existsSync(join(projectDir, 'nodegx.project.json'))) {
  console.error(`serve: ${projectDir} has no nodegx.project.json`);
  process.exit(2);
}
const runtimeDir = flag('--runtime') ?? kit.runtimeDir;
const bundle = kit.previewBundle;
for (const [what, at] of [
  ['the deploy runtime', join(runtimeDir, 'noodl.deploy.js')],
  ['the in-page preview bundle', bundle],
  ['the look module', kit.look],
  ['the specs module', kit.specs]
]) {
  if (!existsSync(at)) {
    console.error(`serve: no ${what} at ${at} (the kit is read from ${kit.from})`);
    process.exit(2);
  }
}

const types = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
const TEXT = ['.json', '.js', '.css', '.md', '.html', '.txt'];
const SKIP = new Set(['node_modules', '.git', '.nodegx', 'noodl_modules']);

function projectFiles(dir) {
  const files = {};
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT.includes(extname(name))) files[relative(dir, full).split(sep).join('/')] = readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return files;
}

/* STU-002: files changed outside Studio. `known` is every file as Studio last read or wrote it, so a change on disk
   that matches it is Studio's own save coming back and is dropped; anything else goes to every open page. */
const known = new Map(Object.entries(projectFiles(projectDir)));
const clients = new Map(); // the response of each open page's event stream → that page's id
const tell = (change, except) => {
  const event = `data: ${JSON.stringify(change)}\n\n`;
  for (const [res, id] of clients) if (id !== except) res.write(event);
};
const ignored = (rel) => rel.split('/').some((seg) => SKIP.has(seg) || seg.startsWith('.'));
const diskText = (rel) => {
  const file = join(projectDir, rel);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
};
/* CCN-002: who changed a file on disk last, when it was the agent. NodeGX's MCP server rewrites a component's three files
   together and stamps component.json `modifiedBy: 'noodl-mcp'`; the stamp alone says only who wrote the component last
   (an agent's file later edited in VS Code is not the agent's change), so a file counts as the agent's only when it
   changed in the same batch as a stamped component.json. */
const agentChanged = new Set();
const componentJsonOf = (rel) => (rel.startsWith('components/') ? rel.replace(/[^/]+$/, 'component.json') : null);
const stampedByAgent = (text) => { try { return JSON.parse(text ?? 'null')?.modifiedBy === 'noodl-mcp'; } catch { return false; } };
/** Whether the change on disk to `rel` was the agent's: from the watcher's last batch, or — for a save that lands
    before that batch settles — from a component.json on disk that Studio has not seen yet and the agent stamped. */
const byAgent = (rel) => {
  if (agentChanged.has(rel)) return true;
  const cj = componentJsonOf(rel);
  if (!cj) return false;
  const text = diskText(cj);
  return text !== known.get(cj) && stampedByAgent(text);
};
let touched = new Set();
let settle;
function flush() {
  const now = new Map();
  for (const rel of touched) {
    const full = join(projectDir, rel);
    let st = null;
    try { st = statSync(full); } catch { /* gone */ }
    if (st?.isDirectory()) for (const [p, t] of Object.entries(projectFiles(full))) now.set(rel ? `${rel}/${p}` : p, t);
    else if (st?.isFile() && TEXT.includes(extname(rel))) now.set(rel, readFileSync(full, 'utf8'));
    // a folder that went (a component deleted) reports only itself: everything Studio knew under it went with it
    for (const p of known.keys()) if ((!rel || p === rel || p.startsWith(rel + '/')) && !now.has(p) && !existsSync(join(projectDir, p))) now.set(p, null);
  }
  touched = new Set();
  const changed = {};
  const removed = [];
  for (const [p, t] of now) {
    if (t === null) {
      if (known.delete(p)) removed.push(p);
    } else if (known.get(p) !== t) {
      known.set(p, t);
      changed[p] = t;
    }
  }
  for (const p of [...Object.keys(changed), ...removed]) {
    const cj = componentJsonOf(p);
    if (cj && stampedByAgent(changed[cj])) agentChanged.add(p); else agentChanged.delete(p);
  }
  if (Object.keys(changed).length || removed.length) tell({ changed, removed });
  if ('nodegx.project.json' in changed) followBackend();
}
watch(projectDir, { recursive: true }, (_kind, name) => {
  const rel = name ? String(name).split(sep).join('/') : '';
  if (rel && ignored(rel)) return;
  // an atomic write (a temp file renamed over the target, as NodeGX's MCP writes) reports both names; the temp one
  // has no text extension and no longer exists, so it reads as nothing
  touched.add(rel);
  clearTimeout(settle);
  settle = setTimeout(flush, 120); // one MCP edit writes three or four files: they arrive as one change
});

const under = (root, rel) => {
  const file = resolve(root, rel);
  return file.startsWith(root + sep) || file === root ? file : undefined;
};

const IMAGES = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
function projectImages(dir) {
  const out = [];
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (IMAGES.includes(extname(name).toLowerCase())) out.push(relative(dir, full).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}
/** Where an uploaded image lands: `assets/<name>`, or `assets/<stem>-n<ext>` when that is taken. */
function assetPath(name) {
  const base = String(name).split(/[\\/]/).pop().replace(/[^\w.\- ]+/g, '').trim() || 'image.png';
  const ext = extname(base), stem = base.slice(0, base.length - ext.length) || 'image';
  for (let i = 0; ; i++) {
    const rel = `assets/${i ? `${stem}-${i}` : stem}${ext}`;
    if (!existsSync(join(projectDir, rel))) return rel;
  }
}

function readBody(req) {
  return new Promise((ok, no) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
}

/* STU-004: the project's backend. `backend` is what the page shows; `ours` is a backend this server started (and so
   stops); everything that starts, adopts or stops one goes through `serial` one at a time. */
let backend = { phase: 'none' };
let ours = null;
let serial = Promise.resolve();
const setBackend = (next) => {
  backend = next;
  tell({ backend });
};
const inTurn = (fn) => (serial = serial.then(fn, fn));
async function reconcileBackend() {
  const binding = backends.bindingOf(projectDir);
  if (ours && ours !== binding.instanceId) {
    await backends.stop(ours).catch(() => {});
    ours = null;
  }
  if (!binding.endpoint) return setBackend({ phase: 'none' });
  let config;
  try {
    config = await backends.localBackendOf(projectDir);
  } catch (err) {
    return setBackend({ phase: 'failed', endpoint: binding.endpoint, error: err.message });
  }
  if (!config) return setBackend({ phase: 'remote', endpoint: binding.endpoint });
  if (backend.id === config.id && (backend.phase === 'running' || backend.phase === 'adopted')) return;
  setBackend({ phase: 'starting', id: config.id, name: config.name, endpoint: binding.endpoint });
  try {
    const up = await backends.startFor(projectDir, config);
    if (up.phase === 'running') ours = up.id;
    setBackend(up);
  } catch (err) {
    setBackend({ phase: 'failed', id: config.id, name: config.name, endpoint: binding.endpoint, error: err.message });
  }
}
/* STU-065: the app's live backend, run the same way: started (or adopted) with the project, stopped with it. */
let live = { phase: 'none' };
let oursLive = null;
const setLive = (next) => {
  live = next;
  tell({ live });
};
async function reconcileLive() {
  const binding = backends.liveBindingOf(projectDir);
  if (oursLive && oursLive !== binding.instanceId) {
    await backends.stop(oursLive).catch(() => {});
    oursLive = null;
  }
  if (!binding.endpoint) return setLive({ phase: 'none' });
  let config;
  try {
    config = await backends.localBackendOf(projectDir, backends.LIVE);
  } catch (err) {
    return setLive({ phase: 'failed', endpoint: binding.endpoint, error: err.message });
  }
  if (!config) return setLive({ phase: 'remote', endpoint: binding.endpoint });
  if (live.id === config.id && (live.phase === 'running' || live.phase === 'adopted')) return;
  setLive({ phase: 'starting', id: config.id, name: config.name, endpoint: binding.endpoint });
  try {
    const up = await backends.startFor(projectDir, config);
    if (up.phase === 'running') oursLive = up.id;
    setLive(up);
  } catch (err) {
    setLive({ phase: 'failed', id: config.id, name: config.name, endpoint: binding.endpoint, error: err.message });
  }
}
const followBackend = () => inTurn(async () => {
  await reconcileBackend();
  await reconcileLive();
});
const isUp = (b) => b.phase === 'running' || b.phase === 'adopted';
/** STU-062: the renames development made since the last Deploy to live, as the project records them (Studio's page clears them after one). */
function liveRenames() {
  try {
    return JSON.parse(readFileSync(join(projectDir, 'nodegx.project.json'), 'utf8')).metadata?.cloudservicesLive?.renames ?? [];
  } catch {
    return [];
  }
}
/** A backend of the app as its admin (lib/live.mjs), or a sentence saying why it can't be asked. */
async function adminOf(which) {
  const state = which === 'live' ? live : backend;
  const binding = which === 'live' ? backends.liveBindingOf(projectDir) : backends.bindingOf(projectDir);
  const what = which === 'live' ? 'live database' : 'development database';
  if (!isUp(state)) throw new Error(state.phase === 'none' ? `This app has no ${what}.` : `The ${what} is not running here (${state.phase}).`);
  const token = await backends.adminTokenOf(state.id);
  if (!token) throw new Error(`The ${what} has no admin credential on this computer.`);
  return lives.admin({ endpoint: state.endpoint, token, appId: binding.appId ?? binding.instanceId });
}
/**
 * P127 BKO-005: one trigger turned on or off, or its daily time moved, the way BKO-001 writes one: the backend first
 * (it checks the change and answers with what it stored), then the project's file, the entry patched by id and nothing
 * else in it touched. If the file cannot be written the backend is put back: both, or neither. The project's file is
 * the truth (R1), so a trigger the file lacks is refused; a backend that is not running here is refused too, so the
 * two never part.
 */
async function setTrigger({ id, enabled, time }) {
  const rel = AUTOMATIONS_FILE, file = join(projectDir, rel);
  const before = diskText(rel);
  const autos = readAutomations(before);
  if (autos.error) throw new Error(autos.error);
  const at = autos.triggers.findIndex((t) => t.id === id);
  if (at < 0) throw new Error(`The project's ${rel} has no trigger "${id}". Ask the agent to keep it in the project first.`);
  const entry = autos.triggers[at];
  let cron;
  if (time) {
    if (entry.type !== 'schedule' || !entry.schedule?.cron) throw new Error(`"${id}" is not a schedule, so it has no time to move.`);
    cron = atTime(entry.schedule.cron, time.hour, time.minute);
  } else if (typeof enabled !== 'boolean') throw new Error('Say what to change: enabled (on or off) or time.');
  const be = await adminOf('development').catch((e) => { throw new Error(`${e.message} The trigger is changed on the backend and in the project together, so start the backend first.`); });
  const path = `/admin/triggers/${encodeURIComponent(id)}`;
  const was = (await be.get(path)).trigger;
  const stored = cron
    ? (await be.put(path, { ...was, schedule: { ...was.schedule, cron } })).trigger
    : (await be.post(`${path}/enabled`, { enabled })).trigger;
  const json = JSON.parse(before);
  json.triggers[at] = cron ? { ...json.triggers[at], schedule: { ...json.triggers[at].schedule, cron: stored.schedule.cron } } : { ...json.triggers[at], enabled: stored.enabled };
  const text = JSON.stringify(json, null, 2) + (before.endsWith('\n') ? '\n' : '');
  try {
    known.set(rel, text); // before the write, so the watcher's echo of it matches
    writeFileSync(`${file}.studio-tmp`, text);
    renameSync(`${file}.studio-tmp`, file);
  } catch (e) {
    known.set(rel, before);
    let undone = true;
    try { if (cron) await be.put(path, was); else await be.post(`${path}/enabled`, { enabled: was.enabled }); } catch { undone = false; }
    throw new Error(`The backend took the change but ${rel} could not be written (${e.message}), ${undone ? 'so the backend was put back as it was. Nothing changed.' : 'and putting the backend back failed too: the backend now has a change the project does not.'}`);
  }
  return { file: rel, text, backend: stored };
}
/** STU-061: the field kinds, from vendor/ or bundled once from the checkout NODEGX_REPO names. */
let fieldsFile = kit.fields;
async function fieldsModule() {
  if (fieldsFile) return readFileSync(fieldsFile);
  const out = join(studioRoot, '.kit', 'fields.js');
  const { buildSync } = await import(join(nodegxRepo, 'node_modules/esbuild/lib/main.js'));
  mkdirSync(dirname(out), { recursive: true });
  buildSync({ ...fieldsBundle(nodegxRepo), outfile: out });
  fieldsFile = out;
  return readFileSync(out);
}

let mapNow = null; // { key, handle }: one map per backend and credential
async function backendMap() {
  if (!(backend.phase === 'running' || backend.phase === 'adopted')) {
    return { words: backend.phase === 'none' ? 'This project has no backend yet. Add one in the Data tab, and the map draws it.' : backend.phase === 'remote' ? 'This project’s backend is not on this computer, so the map can’t ask it as each person.' : backend.phase === 'failed' ? `The backend didn’t start: ${backend.error}` : 'The backend is starting. Open this tab again in a moment.' };
  }
  const token = await backends.adminTokenOf(backend.id);
  if (!token) return { words: 'The backend has no admin credential yet, so the map can’t ask it anything.' };
  const key = `${backend.endpoint}|${token}`;
  if (mapNow?.key !== key) {
    let mod;
    try {
      mod = await import('@nodegx/backend-map');
    } catch {
      return { words: 'The backend map isn’t installed in this copy of Studio (npm install @nodegx/backend-map).' };
    }
    const editor = mod.createEditor({ project: projectDir, backend: backend.endpoint, token });
    await editor.views.sweep();
    mapNow = { key, handle: mod.handler(editor) };
  }
  return mapNow;
}
/**
 * P127 BKO-004: what each cloud function reads and writes, in the map's own reading (`analyseProject`: record nodes,
 * scripts, and the helpers a function places). The tables a script names are the project's own and, with a backend
 * up, the backend's. Read from the files on disk at each ask; nothing is run. The map's package exports only its
 * server, so its reader is imported by file; without it the answer says so and names no touches.
 */
async function functionTouches() {
  let lib;
  try {
    const pkg = createRequire(import.meta.url).resolve('@nodegx/backend-map/package.json');
    lib = await import(pathToFileURL(join(dirname(pkg), 'lib', 'project.mjs')).href);
  } catch {
    return { functions: [], words: 'The backend map isn’t installed in this copy of Studio, so what each function reads and writes is not said.' };
  }
  const project = lib.openProject(projectDir);
  let rules = null; try { rules = JSON.parse(readFileSync(join(projectDir, 'nodegx.security.json'), 'utf8')); } catch { /* none */ }
  const names = new Set(lib.projectTables(project, rules, lib.analyseProject(project, [])).keys());
  // and the tables the functions' own scripts name in a records call: all there is to go on with no backend up
  const reg = project.store.readRegistry();
  for (const key of project.store.componentKeys()) {
    if (!key.startsWith(CLOUD)) continue;
    try { for (const n of project.store.filesOf(key, reg.components[key]).nodes.nodes) for (const t of scriptTableNames(n.parameters?.functionScript ?? '')) names.add(t); } catch { /* skip */ }
  }
  if (isUp(backend)) {
    try {
      const token = await backends.adminTokenOf(backend.id);
      const r = await fetch(`${backend.endpoint.replace(/\/$/, '')}/admin/schema`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) for (const t of (await r.json()).tables ?? []) names.add(t.name);
    } catch { /* the project's own names will do */ }
  }
  const app = lib.analyseProject(project, [...names]);
  return { functions: [...app.functions, ...app.helpers].map((f) => ({ key: f.component, touches: f.touches })) };
}
const mapWords = (words) =>
  `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#141318;color:#c4cedb;font:15px system-ui,sans-serif"><p style="max-width:460px;text-align:center">${words.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</p>`;

// STU-070: Studio inside a conversation. A host that renders MCP Apps (Claude Desktop) draws `/panel` at its own sandbox
// origin, so every request the page then makes is cross-origin: answered with CORS, and a preflight with 204. The
// server listens on loopback only, so "any origin" is any page on this computer, which is what it was already.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const HOLD_FILE = '.nodegx-hold.json';
let livePanel = { id: '', seq: -1 };
/** The hold: a file in the project folder the MCP server reads before every write. A dotfile, so the page's store and the watcher never see it as a project file. */
/** P125-PUPPY2: who lifted the last hold, and on which words (the agent's `release_hold` passes the person's message). Kept
    in memory: it is something to show, not a state of the project. */
let lifted = null;
const holdOf = () => {
  const at = join(projectDir, HOLD_FILE);
  if (!existsSync(at)) return lifted ? { held: false, lifted } : { held: false };
  try { return { held: true, ...JSON.parse(readFileSync(at, 'utf8')) }; } catch { return { held: true, at: statSync(at).mtime.toISOString(), note: '' }; }
};
/** studio.html for a foreign origin: Studio's own absolute origin on the one script tag, the runtime base, the module
 * imports (root-relative AND `./`: in a sandbox the page is `about:srcdoc`, and `./specs.js` resolves to nowhere), the
 * bridge in the head, and Studio's module waiting for the bridge's `window.__studioReady` (the proxy may answer 503
 * until Studio is up). ⚠️ The same five rewrites as NodeGX's `packages/noodl-mcp/src/studio/panelHtml.ts`, which
 * builds the MCP App resource from this file on disk before any Studio runs: change one, change both. */
const panelHtml = (origin) =>
  readFileSync(join(here, 'studio.html'), 'utf8')
    // studio.html has no <head> tag of its own: the bridge goes in before its first script, so it runs first
    .replace(/<script\b/i, (tag) => `<script>window.__STUDIO_ORIGIN=${JSON.stringify(origin)}</script><script type="module" src="${origin}/hosted/hosted.js"></script>${tag}`)
    .replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`)
    .replace(/runtimeBase:\s*'\/runtime\/'/g, `runtimeBase: '${origin}/runtime/'`)
    .replace(/(import\(|from\s+)(['"])\.?\/(?!\/)/g, `$1$2${origin}/`)
    .replace(/<script type="module">/, '<script type="module">\nawait window.__studioReady;\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (status, body, type) => {
    res.writeHead(status, { 'content-type': type ?? types['.json'], 'cache-control': 'no-store', ...CORS });
    res.end(body);
  };
  const json = (status, value) => send(status, JSON.stringify(value));
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname === '/') return send(200, readFileSync(join(here, 'studio.html')), types['.html']);
    if (url.pathname === '/panel') return send(200, panelHtml(`http://127.0.0.1:${server.address().port}`), types['.html']);
    if (url.pathname === '/api/hold' && req.method === 'GET') return json(200, holdOf());
    if (url.pathname === '/api/hold' && req.method === 'POST') {
      const { held, note = '', by, words } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const at = join(projectDir, HOLD_FILE);
      if (held) { writeFileSync(at, JSON.stringify({ by: 'NodeGX Studio', at: new Date().toISOString(), note: String(note).slice(0, 500) }, null, 2) + '\n'); lifted = null; }
      else {
        if (existsSync(at)) { rmSync(at); lifted = { by: by === 'agent' ? 'agent' : 'you', at: new Date().toISOString(), ...(words ? { words: String(words).slice(0, 300) } : {}) }; }
      }
      const hold = holdOf();
      for (const client of clients.keys()) client.write(`data: ${JSON.stringify({ hold })}\n\n`);
      return json(200, hold);
    }
    // P125-PUPPY2-THREEPANELS: one live panel per conversation. A host keeps every panel an open_studio call drew, and
    // each live one holds an event stream: three held all six of the browser's connections to this origin, and every
    // panel's app stopped loading. The panel of the newest call (`seq`, its issuedAt) is live; the others hear
    // `{ panel }` and go quiet (hosted.js). `wake` is the person's "Bring it back here" on an older one.
    if (url.pathname === '/api/panel' && req.method === 'POST') {
      const { id, seq = 0, wake } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (typeof id !== 'string' || !id) return json(400, { error: 'a panel id' });
      if (wake) { livePanel = { id, seq: Math.max(livePanel.seq, Date.now()) }; }
      else if (id !== livePanel.id && Number(seq) >= livePanel.seq) livePanel = { id, seq: Number(seq) };
      for (const client of clients.keys()) client.write(`data: ${JSON.stringify({ panel: { live: livePanel.id } })}\n\n`);
      return json(200, { live: livePanel.id, you: livePanel.id === id });
    }
    if (url.pathname === '/preview.js') return send(200, readFileSync(bundle), types['.js']);
    if (url.pathname === '/phrasebook.json') { // read on the first ask (require caches it): a phrasebook edit shows after a restart
      try { const { rows } = createRequire(import.meta.url)(kit.phrasebook); return json(200, Object.fromEntries(TYPES.map((t) => [t, phrasesFor(rows, t)]))); }
      catch (err) { return json(404, { error: `no phrasebook at ${kit.phrasebook}: ${err.message}` }); }
    }
    if (url.pathname === '/fields.js') return send(200, await fieldsModule(), types['.js']);
    if (url.pathname === '/look.js' || url.pathname === '/specs.js') return send(200, readFileSync(url.pathname === '/look.js' ? kit.look : kit.specs), types['.js']);
    // the app's frame gets Studio's probe first in its head (what it asks the backend, which page it is on): STU-011
    if (url.pathname === '/runtime/index.html') {
      const probe = `<script>${readFileSync(join(here, 'probe.js'), 'utf8')}</script>`;
      return send(200, readFileSync(join(runtimeDir, 'index.html'), 'utf8').replace(/<head[^>]*>/i, (tag) => tag + probe), types['.html']);
    }
    if (url.pathname === '/api/project' && req.method === 'GET') {
      const files = projectFiles(projectDir);
      known.clear();
      for (const [p, t] of Object.entries(files)) known.set(p, t);
      return json(200, { dir: projectDir, name: projectDir.split(sep).pop(), files, backend, live });
    }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', ...CORS });
      res.write(': watching the project folder\n\n');
      // the page connects after it has drawn, which a backend may have finished starting before: it hears where it is now
      res.write(`data: ${JSON.stringify({ backend, live })}\n\n`);
      clients.set(res, url.searchParams.get('client'));
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/save' && req.method === 'POST') {
      const { files = {}, removed = [], bases, force, client } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      for (const rel of [...Object.keys(files), ...removed]) if (!under(projectDir, rel)) return json(400, { error: `refused: ${rel}` });
      if (bases && !force) {
        const conflicts = [...Object.keys(files), ...removed].filter((rel) => rel in bases).map((rel) => ({ path: rel, theirs: diskText(rel) })).filter((c) => c.theirs !== bases[c.path]);
        if (conflicts.length) {
          // CCN-002: the other writer named when it was the agent (`byAgent`, beside the watcher)
          for (const c of conflicts) if (byAgent(c.path)) c.by = 'agent';
          const who = conflicts.every((c) => c.by === 'agent') ? 'changed by the agent' : 'changed outside Studio';
          return json(409, { error: `${who}: ${conflicts.map((c) => c.path).join(', ')}`, conflicts });
        }
      }
      const written = [];
      for (const [rel, text] of Object.entries(files)) {
        const file = under(projectDir, rel);
        if (!file || typeof text !== 'string') return json(400, { error: `refused: ${rel}` });
        mkdirSync(dirname(file), { recursive: true });
        known.set(rel, text); // before the write, so the watcher's echo of it matches
        agentChanged.delete(rel);
        writeFileSync(file, text);
        written.push(rel);
      }
      const gone = [];
      for (const rel of removed) {
        const file = under(projectDir, rel);
        if (!file) return json(400, { error: `refused: ${rel}` });
        known.delete(rel);
        agentChanged.delete(rel);
        if (existsSync(file)) {
          rmSync(file, { recursive: true });
          gone.push(rel);
        }
      }
      // a second Studio window on the same project hears this save as a change made outside it
      if (written.length || gone.length) tell({ changed: Object.fromEntries(written.map((rel) => [rel, files[rel]])), removed: gone }, client);
      return json(200, { written, removed: gone });
    }
    if (url.pathname === '/api/backend-status') return json(200, { ...backend, live });
    if (url.pathname === '/api/live-provision' && req.method === 'POST') {
      try {
        const up = await inTurn(async () => {
          const made = await backends.provisionLiveFor(projectDir);
          if (made.phase === 'running') oursLive = made.id;
          setLive(made);
          return made;
        });
        const [dev, liveBe] = [await adminOf('development'), await adminOf('live')];
        await lives.closeLive(liveBe);
        const first = await lives.promote(dev, liveBe);
        return json(200, { ...up, done: first.done });
      } catch (err) {
        return json(409, { error: err.message });
      }
    }
    if (url.pathname === '/api/live-compare') {
      try {
        const plan = await lives.compare(await adminOf('development'), await adminOf('live'), { renames: liveRenames() });
        return json(200, { added: plan.added, lost: plan.lost, held: plan.held, rendered: plan.rendered, same: plan.same });
      } catch (err) {
        return json(409, { error: err.message });
      }
    }
    if (url.pathname === '/api/live-promote' && req.method === 'POST') {
      const { allowDestructive } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      try {
        const r = await lives.promote(await adminOf('development'), await adminOf('live'), { allowDestructive: !!allowDestructive, renames: liveRenames() });
        return json(200, { done: r.done });
      } catch (err) {
        return json(409, { error: err.message, lost: err.plan?.lost });
      }
    }
    if (url.pathname === '/api/live-copy' && req.method === 'POST') {
      const { from, types: only = [], dryRun = true } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      try {
        const [dev, liveBe] = [await adminOf('development'), await adminOf('live')];
        return json(200, await lives.copyRows(from === 'live' ? liveBe : dev, from === 'live' ? dev : liveBe, { types: only, dryRun: dryRun !== false }));
      } catch (err) {
        return json(409, { error: err.message });
      }
    }
    if (url.pathname === '/api/backend-provision' && req.method === 'POST') {
      try {
        const up = await inTurn(async () => {
          const made = await backends.provisionFor(projectDir);
          if (made.phase === 'running') ours = made.id;
          setBackend(made);
          return made;
        });
        return json(200, up);
      } catch (err) {
        return json(409, { error: err.message });
      }
    }
    if (url.pathname === '/api/automations/trigger' && req.method === 'POST') {
      const { id, enabled, time, client } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      try {
        const done = await setTrigger({ id, enabled, time });
        tell({ changed: { [done.file]: done.text }, removed: [] }, client); // another Studio window on the project
        return json(200, done);
      } catch (err) {
        return json(409, { error: err.message });
      }
    }
    if (url.pathname === '/api/images') return json(200, projectImages(projectDir));
    if (url.pathname === '/api/functions') { try { return json(200, await functionTouches()); } catch (e) { return json(200, { functions: [], words: `What each function reads and writes could not be read: ${e.message}` }); } }
    if (url.pathname === '/api/asset' && req.method === 'POST') {
      const name = url.searchParams.get('name') || '';
      if (!IMAGES.includes(extname(name).toLowerCase())) return json(400, { error: `not an image: ${name}` });
      const rel = assetPath(name), file = under(projectDir, rel);
      if (!file) return json(400, { error: `refused: ${rel}` });
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, await readBody(req));
      return json(200, { path: rel });
    }
    if (url.pathname === '/api/doc') { // STU-040: one Markdown file of the project's docs/ folder, read only (the import report)
      const rel = url.searchParams.get('path') ?? '';
      if (!/^docs\/[\w .-]+\.md$/.test(rel)) return json(400, { error: 'only a .md file directly in docs/' });
      const at = join(projectDir, ...rel.split('/'));
      return existsSync(at) ? send(200, readFileSync(at, 'utf8'), 'text/markdown; charset=utf-8') : json(404, { error: `${rel} is not in the project` });
    }
    if (url.pathname === '/api/agent') return json(200, await agent.stateOf(projectDir));
    if (url.pathname === '/api/agent-connect' && req.method === 'POST') {
      // Studio's own writes, known before they land, so the watcher does not hand them back to the page as an outside edit
      const result = await agent.connect(projectDir, (rel, text) => known.set(rel, text));
      return json(200, result);
    }
    // the backend map (@nodegx/backend-map): who can reach which rows, run as each person. It holds the admin
    // credential here, as the Data tab's proxy does; the page never sees it
    if (url.pathname === '/backend-map') return res.writeHead(302, { location: '/backend-map/' }).end();
    if (url.pathname.startsWith('/backend-map/')) {
      const map = await backendMap();
      if (map.words) return send(200, mapWords(map.words), types['.html']);
      // P127-BKO002-HOSTEDPRIVACY: the map's handler writes its own headers, and in a conversation Privacy and the map
      // ask it across origins like every other route here. Set first, so they join whatever it writes.
      for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
      return map.handle(req, res, url.pathname.slice('/backend-map'.length));
    }
    if (url.pathname.startsWith('/api/backend/') || url.pathname.startsWith('/api/live/')) {
      const isLive = url.pathname.startsWith('/api/live/');
      const state = isLive ? live : backend;
      const binding = isLive ? backends.liveBindingOf(projectDir) : backends.bindingOf(projectDir);
      const endpoint = isUp(state) ? state.endpoint : binding.endpoint;
      if (!endpoint) return json(503, { error: isLive ? 'This app has no live database yet.' : 'This project is not bound to a backend (no metadata.cloudservices.endpoint).' });
      const target = endpoint.replace(/\/$/, '') + url.pathname.slice(isLive ? '/api/live'.length : '/api/backend'.length) + url.search;
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      const headers = { 'X-Parse-Application-Id': binding.appId ?? binding.instanceId ?? '', 'Content-Type': req.headers['content-type'] ?? 'application/json' };
      // the Data tab is the app's owner looking at its data: on a local backend it asks as the backend's admin, as the
      // NodeGX editor's Data Browser does, so a policy that keeps rows from the app's visitors does not keep them from it
      const token = state.id ? await backends.adminTokenOf(state.id) : null;
      if (token) headers['X-Parse-Master-Key'] = token;
      let upstream;
      try {
        upstream = await fetch(target, { method: req.method, headers, body });
      } catch (err) {
        return json(502, { error: `The backend at ${endpoint} did not answer: ${err.message}` });
      }
      return send(upstream.status, Buffer.from(await upstream.arrayBuffer()), upstream.headers.get('content-type') ?? types['.json']);
    }
    const [root, rel] = url.pathname.startsWith('/runtime/') ? [runtimeDir, url.pathname.slice('/runtime/'.length)] : [here, url.pathname.slice(1)];
    const file = under(root, decodeURIComponent(rel));
    if (file && existsSync(file) && statSync(file).isFile()) return send(200, readFileSync(file), types[extname(file)] ?? 'application/octet-stream');
    // an asset of the project (images the app shows). The app's frame has `Noodl.baseUrl` "/runtime/", so the runtime
    // asks for a project image `assets/x.png` as /runtime/assets/x.png: what the runtime folder does not have is the project's
    const asset = under(projectDir, decodeURIComponent(url.pathname.startsWith('/runtime/') ? rel : url.pathname.slice(1)));
    if (asset && existsSync(asset) && statSync(asset).isFile()) return send(200, readFileSync(asset), types[extname(asset)] ?? 'application/octet-stream');
    res.writeHead(404, CORS);
    res.end();
  } catch (err) {
    json(500, { error: err.message });
  }
});
server.listen(Number(flag('--port')) || 0, '127.0.0.1', () => {
  console.log(`nodegx-studio: http://127.0.0.1:${server.address().port}/  (${projectDir})`);
  followBackend(); // after the window has somewhere to load: a backend takes a second or two to answer
});
