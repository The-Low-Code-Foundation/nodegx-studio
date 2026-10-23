/**
 * STU-008 — Publish: the app as a static site, written by NodeGX's own deploy.
 *
 * Studio does not have its own way of publishing an app. The site is written by `@nodegx/preview`'s `nodegx-deploy`
 * engine, the `deployToFolder` the NodeGX editor's *Deploy to Folder* runs, with the production engine npm ships (the
 * engine refuses a development one by itself). An app's cloud functions go to its backend through the NodeGX MCP
 * server's own `deploy_cloud_functions`, run over stdio for the one call: the bundle is built and pushed by the code
 * the editor's Deploy button runs, never by a copy of it.
 *
 * What is Studio's own is the folder the site goes in. The engine writes over what is there and deletes nothing, so a
 * second publish would leave the first one's bundles beside its own, and a site written inside the project would be
 * published again as one of the project's files. So:
 *   - a site never goes inside the project folder, nor the project inside the site's;
 *   - the folder is new, empty, or one this project was published to before (`.nodegx-publish.json`, written beside
 *     the site, names the project and the files that publish wrote); a republish deletes exactly those files first;
 *   - any other folder with files in it is refused, untouched.
 *
 * The site talks to the backend the project is bound to (`metadata.cloudservices.endpoint`, built into the site).
 * One on 127.0.0.1 answers only on this machine, so the result says so; where else a site and its backend can go is
 * ruling R10.
 *
 * STU-065: an app with a live database (`metadata.cloudservicesLive`) is published against live, not development. The
 * engine reads the backend from the project file only (P123-STU065-DEPLOYBACKEND), so the site is written from a copy
 * of the project, outside it, whose file names live; the copy is deleted after. Before that, development's schema goes
 * to live as Data's Deploy to live sends it, when nothing would be lost (as a Bubble deploy carries its types); when
 * something would, live is left as it is and the result says what waits on Data's Deploy to live. Its cloud functions go
 * to live.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { adminTokenOf, bindingOf, LIVE, liveBindingOf, localBackendOf } from './backend.mjs';
import { admin, compare, promote } from './live.mjs';
import { kit } from './nodegx.mjs';

export const MARKER = '.nodegx-publish.json';

const readProject = (dir) => JSON.parse(readFileSync(join(dir, 'nodegx.project.json'), 'utf8'));
const within = (outer, inner) => inner === outer || inner.startsWith(outer + sep);

/** The cloud functions the project has: its `__cloud__/` components, by the name after the prefix. */
export function cloudFunctionsOf(dir) {
  try {
    const names = Object.keys(JSON.parse(readFileSync(join(dir, 'components/_registry.json'), 'utf8')).components ?? {});
    return names.filter((n) => /^\/?#?__cloud__\//.test(n)).map((n) => n.replace(/^\/?#?__cloud__\//, ''));
  } catch {
    return [];
  }
}

/** Where the published site will send its requests (live when the app has one), and whether that is this machine only. */
export function backendTargetOf(dir) {
  const live = liveBindingOf(dir);
  const { endpoint, instanceId } = live.endpoint ? live : bindingOf(dir);
  if (!endpoint) return { endpoint: null, local: false, instanceId: null, live: false };
  let host = '';
  try {
    host = new URL(endpoint).hostname;
  } catch { /* not a URL: shown as it is */ }
  return { endpoint, instanceId: instanceId ?? null, local: ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host), live: !!live.endpoint };
}

/** A copy of the project, outside it, whose file names live as its backend: what the engine publishes from. */
function stageForLive(dir) {
  const stage = join(mkdtempSync(join(tmpdir(), 'nodegx-studio-live-')), basename(dir));
  cpSync(dir, stage, { recursive: true, filter: (src) => !/[\\/](node_modules|\.git|\.nodegx)$/.test(src) });
  const file = join(stage, 'nodegx.project.json');
  const project = JSON.parse(readFileSync(file, 'utf8'));
  project.metadata.cloudservices = { ...project.metadata[LIVE] };
  delete project.metadata[LIVE];
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
  return stage;
}

/** Development's schema onto live before a publish, when nothing would be lost; otherwise what waits, in words. */
async function schemaToLive(dir) {
  const dev = bindingOf(dir), live = liveBindingOf(dir);
  const [devConfig, liveConfig] = [await localBackendOf(dir), await localBackendOf(dir, LIVE)];
  if (!devConfig || !liveConfig) return { status: 'skipped', reason: 'Live’s schema was not compared: development or live is not a backend on this computer.' };
  const be = async (binding, config) => admin({ endpoint: binding.endpoint, token: await adminTokenOf(config.id), appId: binding.appId ?? binding.instanceId });
  try {
    const [d, l] = [await be(dev, devConfig), await be(live, liveConfig)];
    // the renames development made since the last deploy go first, as renames (STU-062); one live already has is skipped
    const renames = JSON.parse(readFileSync(join(dir, 'nodegx.project.json'), 'utf8')).metadata?.[LIVE]?.renames ?? [];
    const plan = await compare(d, l, { renames });
    if (plan.same) return { status: 'same' };
    if (plan.lost.length) return { status: 'behind', lost: plan.lost.map((x) => x.words) };
    return { status: 'deployed', done: (await promote(d, l, { renames })).done };
  } catch (err) {
    return { status: 'skipped', reason: `Live’s schema was not compared: ${err.message}` };
  }
}

/** A name for the site's folder when the person has not chosen one: the project's, plus "site". */
export const defaultSiteName = (dir) => {
  let name = '';
  try {
    name = readProject(dir).name ?? '';
  } catch { /* unnamed */ }
  return `${(name || basename(dir)).trim()} site`;
};

/**
 * Whether `out` may take this project's site. Resolves `{ fresh }` (true: new or empty) or `{ previous }` (the marker
 * of this project's last publish there), or throws saying why not; nothing is changed either way.
 */
export function claimSiteFolder(dir, out) {
  dir = resolve(dir);
  out = resolve(out);
  if (within(dir, out)) throw new Error('The site cannot go inside the project’s own folder: the next publish would copy it as part of the app. Choose a folder outside it.');
  if (within(out, dir)) throw new Error('The site cannot go in a folder that holds the project. Choose a new folder.');
  if (!existsSync(out)) return { fresh: true };
  if (!statSync(out).isDirectory()) throw new Error(`${out} is a file, not a folder.`);
  const inside = readdirSync(out).filter((n) => n !== '.DS_Store');
  if (!inside.length) return { fresh: true };
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(join(out, MARKER), 'utf8'));
  } catch { /* not a site Studio wrote */ }
  if (!previous) throw new Error(`${basename(out)} already holds ${inside.length} item${inside.length === 1 ? '' : 's'}, and Studio did not publish it. Choose a new folder, or an empty one.`);
  if (previous.projectId !== readProject(dir).id) throw new Error(`${basename(out)} holds another app’s site (${previous.projectName ?? 'unnamed'}). Choose a new folder, or that app’s own.`);
  return { fresh: false, previous };
}

/** Deletes what the last publish wrote there, and only that; folders it leaves empty go too. */
function clearPrevious(out, previous) {
  const dirs = new Set();
  for (const f of previous.written ?? []) {
    const at = resolve(out, f);
    if (!within(out, at) || at === out) continue; // a marker is a file anyone can edit: never reach outside the site
    rmSync(at, { force: true });
    for (let d = dirname(at); d !== out && within(out, d); d = dirname(d)) dirs.add(d);
  }
  for (const d of [...dirs].sort((a, b) => b.length - a.length)) if (existsSync(d) && !readdirSync(d).length) rmSync(d, { recursive: true });
}

/**
 * Project files the engine publishes that the app never reads and nobody meant to make public: the backend's access
 * policy and its own folder (seed data, fixtures, proposed triggers). The engine's default rules miss them
 * (P123-STU008-BACKENDPUBLIC in NodeGX's ledger); until they do, the person is told, and a `.noodlignore` line
 * (`nodegx.security.json`, `backend/`) keeps them out. Studio does not delete them from the site behind the engine.
 */
export const exposedFiles = (written = []) => written.filter((f) => f === 'nodegx.security.json' || f.startsWith('backend/'));

/** Under Electron, process.execPath is Electron itself: ELECTRON_RUN_AS_NODE makes it plain Node for the kit's CLIs. */
const nodeEnv = () => ({ ...process.env, ELECTRON_RUN_AS_NODE: '1' });

/**
 * How the site's pages are addressed. `settings.navigationPathType` "path" (every template's, and the importer's) gives
 * each page a path of its own (`/sign-in`); unset or "hash" puts it after a `#`, which never reaches the server. A path
 * that is not a file reaches the server, and a plain static server answers 404: a link to a page, or a reload on one,
 * needs the host to answer every such path with index.html. Opening the site's root works on any server. `example` is
 * one page's address, when a Page names one.
 */
export function routingOf(dir) {
  let type = 'hash';
  try {
    if (readProject(dir).settings?.navigationPathType === 'path') type = 'path';
  } catch { /* no project file: the runtime's default */ }
  let example = null;
  const walk = (at) => {
    for (const e of readdirSync(at, { withFileTypes: true })) {
      if (example) return;
      if (e.isDirectory()) walk(join(at, e.name));
      else if (e.name === 'nodes.json') {
        try {
          const page = JSON.parse(readFileSync(join(at, e.name), 'utf8')).nodes?.find((n) => n.type === 'Page' && n.parameters?.urlPath?.replace(/^\/+/, ''));
          if (page) example = '/' + page.parameters.urlPath.replace(/^\/+/, '');
        } catch { /* not a component file */ }
      }
    }
  };
  if (type === 'path' && existsSync(join(dir, 'components'))) walk(join(dir, 'components'));
  return { type, example };
}

/** The deploy engine: `<project> <out>`, one JSON report on stdout, everything human on stderr. */
function runDeploy(dir, out) {
  return new Promise((ok, no) => {
    const child = spawn(process.execPath, [kit.deployEngine, dir, out], { env: nodeEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', no);
    child.on('close', (code) => {
      let report = null;
      try {
        report = JSON.parse(stdout);
      } catch { /* no report: the error is on stderr */ }
      if (code === 0 && report?.ok) return ok({ report, log: stderr });
      no(new Error(`The site was not written:\n${(report?.error ?? stderr.trim()).toString().slice(-800)}`));
    });
  });
}

/**
 * One call to the NodeGX MCP server for this project, over stdio: initialize, the tool, and stop. Resolves with the
 * tool's JSON answer, or rejects with its error text.
 */
export function callMcpTool(dir, name, args, { timeoutMs = 180000 } = {}) {
  return new Promise((ok, no) => {
    const child = spawn(process.execPath, [kit.mcpServer, dir, '--allow-writes', '--all-tools'], { env: nodeEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let stderr = '';
    let settled = false;
    const done = (fn, v) => {
      if (settled) return;
      settled = true;
      clearTimeout(late);
      child.stdin.end();
      child.kill();
      fn(v);
    };
    const late = setTimeout(() => done(no, new Error(`the NodeGX MCP server did not answer ${name} in ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          if (msg.error) return done(no, new Error(msg.error.message));
          send({ method: 'notifications/initialized' });
          send({ id: 2, method: 'tools/call', params: { name, arguments: args } });
        } else if (msg.id === 2) {
          if (msg.error) return done(no, new Error(msg.error.message));
          const text = (msg.result?.content ?? []).map((c) => c.text ?? '').join('');
          let body = text;
          try {
            body = JSON.parse(text);
          } catch { /* plain text */ }
          if (msg.result?.isError) return done(no, new Error(typeof body === 'string' ? body : body.error ?? body.message ?? text));
          done(ok, body);
        }
      }
    });
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => done(no, err));
    child.on('exit', (code) => done(no, new Error(`the NodeGX MCP server stopped (exit ${code}): ${stderr.trim().slice(-400)}`)));
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nodegx-studio', version: '0.1.0' } } });
  });
}

/**
 * The app's cloud functions, onto its backend. Only a backend on this machine (the MCP server's backends folder) can be
 * deployed to from here, and only while it runs; anything else is said, not attempted.
 */
async function deployFunctions(dir, functions, target) {
  if (!functions.length) return { status: 'none' };
  if (!target.endpoint) return { status: 'skipped', reason: 'The app has cloud functions but no backend to run them.' };
  const config = await localBackendOf(dir, target.live ? LIVE : 'cloudservices');
  if (!config) return { status: 'skipped', reason: `The functions were not deployed: ${target.endpoint} is not a backend on this machine, so deploy them where it runs.` };
  try {
    const result = await callMcpTool(dir, 'deploy_cloud_functions', { backendId: config.id });
    return { status: result.ok ? 'deployed' : 'failed', result };
  } catch (err) {
    return { status: 'failed', reason: err.message };
  }
}

/**
 * Publishes the project at `dir` to `out`. Resolves with `{ site, files, backend, functions, engine }`, or rejects
 * (nothing published) with what stopped it.
 */
export async function publish(dir, out) {
  dir = resolve(dir);
  out = resolve(out);
  const claim = claimSiteFolder(dir, out);
  const target = backendTargetOf(dir);
  const schema = target.live ? await schemaToLive(dir) : null;
  if (claim.previous) clearPrevious(out, claim.previous);
  mkdirSync(out, { recursive: true });
  const stage = target.live ? stageForLive(dir) : null;
  let report;
  try {
    ({ report } = await runDeploy(stage ?? dir, out));
  } finally {
    if (stage) rmSync(dirname(stage), { recursive: true, force: true });
  }
  const project = readProject(dir);
  writeFileSync(
    join(out, MARKER),
    JSON.stringify({ by: 'nodegx-studio', projectId: project.id, projectName: project.name, publishedAt: new Date().toISOString(), backend: target.endpoint, written: report.written }, null, 2) + '\n'
  );
  const functions = await deployFunctions(dir, cloudFunctionsOf(dir), target);
  return {
    site: out,
    index: join(out, 'index.html'),
    files: report.written.length,
    replaced: !claim.fresh,
    backend: target,
    schema,
    functions,
    engine: report.engine?.kind,
    routing: routingOf(dir),
    exposed: exposedFiles(report.written),
    warnings: report.warnings ?? []
  };
}
