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
 *                          /api/events as `{ backend }` whenever it changes
 *   POST /api/backend-provision a backend for a project bound to none: NodeGX's provision, then the binding
 *   GET  /api/agent        STU-005: Claude Code and this folder (`lib/agent.mjs` stateOf): `{ state, serverName, command, … }`
 *   POST /api/agent-connect     "Connect Claude Code": the NodeGX editor's writer of `.mcp.json`, `CLAUDE.md`, `AGENTS.md`
 *   GET  /api/images       STU-051: every image file in the project folder, `[path]`, for the image popover
 *   POST /api/asset?name=x the request's bytes as an image under `assets/` (the NodeGX editor's projectAssets.ts:
 *                          made unique before the extension, `logo-1.png`), answering `{ path }`
 *
 * STU-004: a project bound to a local backend (`lib/backend.mjs`) has it started when this server starts — or adopted
 * when the NodeGX editor or Claude Code already runs it — and stopped when this server stops (SIGTERM / SIGINT; the
 * backend's own --parent-pid guard covers a kill). A change to the binding (Claude Code's provision_backend, a
 * `git pull`) is followed the same way.
 *
 * The page holds the project in memory in the kit's own store (`V2ProjectStore` over `memoryFiles`), makes every edit
 * through it, and sends the files it changed here. This file knows nothing about nodes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, watch, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kit } from '../lib/nodegx.mjs';
import * as backends from '../lib/backend.mjs';
import * as agent from '../lib/agent.mjs';
import { createRequire } from 'node:module';
import { TYPES, phrasesFor } from './phrases.mjs';

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
const followBackend = () => inTurn(reconcileBackend);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (status, body, type) => {
    res.writeHead(status, { 'content-type': type ?? types['.json'], 'cache-control': 'no-store' });
    res.end(body);
  };
  const json = (status, value) => send(status, JSON.stringify(value));
  try {
    if (url.pathname === '/') return send(200, readFileSync(join(here, 'studio.html')), types['.html']);
    if (url.pathname === '/preview.js') return send(200, readFileSync(bundle), types['.js']);
    if (url.pathname === '/phrasebook.json') { // read on the first ask (require caches it): a phrasebook edit shows after a restart
      try { const { rows } = createRequire(import.meta.url)(kit.phrasebook); return json(200, Object.fromEntries(TYPES.map((t) => [t, phrasesFor(rows, t)]))); }
      catch (err) { return json(404, { error: `no phrasebook at ${kit.phrasebook}: ${err.message}` }); }
    }
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
      return json(200, { dir: projectDir, name: projectDir.split(sep).pop(), files, backend });
    }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': watching the project folder\n\n');
      // the page connects after it has drawn, which a backend may have finished starting before: it hears where it is now
      res.write(`data: ${JSON.stringify({ backend })}\n\n`);
      clients.set(res, url.searchParams.get('client'));
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/save' && req.method === 'POST') {
      const { files = {}, removed = [], bases, force, client } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      for (const rel of [...Object.keys(files), ...removed]) if (!under(projectDir, rel)) return json(400, { error: `refused: ${rel}` });
      if (bases && !force) {
        const conflicts = [...Object.keys(files), ...removed].filter((rel) => rel in bases).map((rel) => ({ path: rel, theirs: diskText(rel) })).filter((c) => c.theirs !== bases[c.path]);
        if (conflicts.length) return json(409, { error: `changed outside Studio: ${conflicts.map((c) => c.path).join(', ')}`, conflicts });
      }
      const written = [];
      for (const [rel, text] of Object.entries(files)) {
        const file = under(projectDir, rel);
        if (!file || typeof text !== 'string') return json(400, { error: `refused: ${rel}` });
        mkdirSync(dirname(file), { recursive: true });
        known.set(rel, text); // before the write, so the watcher's echo of it matches
        writeFileSync(file, text);
        written.push(rel);
      }
      const gone = [];
      for (const rel of removed) {
        const file = under(projectDir, rel);
        if (!file) return json(400, { error: `refused: ${rel}` });
        known.delete(rel);
        if (existsSync(file)) {
          rmSync(file, { recursive: true });
          gone.push(rel);
        }
      }
      // a second Studio window on the same project hears this save as a change made outside it
      if (written.length || gone.length) tell({ changed: Object.fromEntries(written.map((rel) => [rel, files[rel]])), removed: gone }, client);
      return json(200, { written, removed: gone });
    }
    if (url.pathname === '/api/backend-status') return json(200, backend);
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
    if (url.pathname === '/api/images') return json(200, projectImages(projectDir));
    if (url.pathname === '/api/asset' && req.method === 'POST') {
      const name = url.searchParams.get('name') || '';
      if (!IMAGES.includes(extname(name).toLowerCase())) return json(400, { error: `not an image: ${name}` });
      const rel = assetPath(name), file = under(projectDir, rel);
      if (!file) return json(400, { error: `refused: ${rel}` });
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, await readBody(req));
      return json(200, { path: rel });
    }
    if (url.pathname === '/api/agent') return json(200, await agent.stateOf(projectDir));
    if (url.pathname === '/api/agent-connect' && req.method === 'POST') {
      // Studio's own writes, known before they land, so the watcher does not hand them back to the page as an outside edit
      const result = await agent.connect(projectDir, (rel, text) => known.set(rel, text));
      return json(200, result);
    }
    if (url.pathname.startsWith('/api/backend/')) {
      const binding = backends.bindingOf(projectDir);
      const endpoint = backend.phase === 'running' || backend.phase === 'adopted' ? backend.endpoint : binding.endpoint;
      if (!endpoint) return json(503, { error: 'This project is not bound to a backend (no metadata.cloudservices.endpoint).' });
      const target = endpoint.replace(/\/$/, '') + url.pathname.slice('/api/backend'.length) + url.search;
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      const headers = { 'X-Parse-Application-Id': binding.appId ?? binding.instanceId ?? '', 'Content-Type': req.headers['content-type'] ?? 'application/json' };
      // the Data tab is the app's owner looking at its data: on a local backend it asks as the backend's admin, as the
      // NodeGX editor's Data Browser does, so a policy that keeps rows from the app's visitors does not keep them from it
      const token = backend.id ? await backends.adminTokenOf(backend.id) : null;
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
    res.writeHead(404);
    res.end();
  } catch (err) {
    json(500, { error: err.message });
  }
});
server.listen(Number(flag('--port')) || 0, '127.0.0.1', () => {
  console.log(`nodegx-studio: http://127.0.0.1:${server.address().port}/  (${projectDir})`);
  followBackend(); // after the window has somewhere to load: a backend takes a second or two to answer
});
