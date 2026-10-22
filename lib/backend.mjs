/**
 * STU-004 — the project's backend, run by Studio.
 *
 * Studio does not have its own way of running a backend. It uses NodeGX's: the backends live where the NodeGX editor
 * and the NodeGX MCP server keep theirs (`~/.noodl/backends/<id>/`, or NODEGX_BACKENDS_DIR), each one owned by the
 * projects named in its `config.json`, started as `nodegx-backend serve` on that folder with `--project-dir` (so the
 * project's `nodegx.security.json` is the policy a new backend starts on) and `--parent-pid`, and recorded in a
 * runtime file that every spawner reads before it starts anything, so a backend that the editor or Claude Code
 * already runs is adopted, never started twice on one database. That code is the MCP server's
 * (`packages/noodl-mcp/src/backend/`), bundled: `npm run vendor` builds it into vendor/backend.cjs at the vendored
 * commit, and with NODEGX_REPO set this module bundles it from that checkout on every start instead (esbuild, about
 * 0.2 s), so Studio never runs an older copy than the checkout holds. The service it starts is `@nodegx/mcp`'s
 * (lib/nodegx.mjs), the one the MCP server starts when Claude Code provisions a backend.
 *
 * The project names its backend the way NodeGX does: `nodegx.project.json → metadata.cloudservices`
 * (`{instanceId, endpoint, appId, type}`). A backend is "local" when `instanceId` is a folder under the backends root;
 * anything else (a deployed backend, Noodl Cloud) is shown and talked to, never started or stopped.
 *
 * STU-065: that one is the app's development database. Its live one, when it has one, is a second backend named in
 * `metadata.cloudservicesLive` in the same shape: Studio's word, since the NodeGX editor and the MCP server know one
 * backend per project. It is made by the same provision, owned by the same project id, and named "<app> live backend".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { kit as pieces, nodegxRepo, studioRoot } from './nodegx.mjs';

const require = createRequire(import.meta.url);

/**
 * The esbuild options that bundle the kit's backend modules from a checkout into `outfile`: the MCP server's
 * provisioning and runtime record, and the backend's own validator of a security policy (the importer's gate reads
 * it). `npm run vendor` and the NODEGX_REPO path below build the same thing.
 */
export function bundleOptions(repo, outfile) {
  return {
    stdin: {
      contents: [
        "export * from './provision'; export * from './runtimeRecord'; export { backendsRoot } from './client'; export { ensureProjectId } from './projectIdentity';",
        `export { validateSecurityConfig } from ${JSON.stringify(join(repo, 'packages/nodegx-backend/src/security/model.ts'))};`
      ].join('\n'),
      resolveDir: join(repo, 'packages/noodl-mcp/src/backend'),
      loader: 'ts'
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile,
    logLevel: 'warning'
  };
}

let loaded = null;
/** The kit's backend modules: vendor/backend.cjs, or bundled from NODEGX_REPO. Throws with what is missing. */
export async function kit() {
  if (loaded) return loaded;
  if (!process.env.NODEGX_BACKEND_ENTRY) {
    if (!existsSync(pieces.backendCli)) throw new Error(`no nodegx-backend at ${pieces.backendCli} (${nodegxRepo ? 'npm run build in packages/nodegx-backend' : 'npm install'})`);
    // bundled, the kit's own search for the service starts from the bundle's folder and finds nothing
    process.env.NODEGX_BACKEND_ENTRY = pieces.backendCli;
  }
  let outfile = pieces.backendKit;
  if (!outfile) {
    const source = join(nodegxRepo, 'packages/noodl-mcp/src/backend');
    if (!existsSync(join(source, 'provision.ts'))) throw new Error(`no NodeGX backend code at ${source}`);
    const { buildSync } = await import(join(nodegxRepo, 'node_modules/esbuild/lib/main.js'));
    outfile = join(studioRoot, '.kit', 'backend.cjs');
    mkdirSync(join(studioRoot, '.kit'), { recursive: true });
    buildSync(bundleOptions(nodegxRepo, outfile));
  } else if (!existsSync(outfile)) throw new Error(`no ${outfile} (npm run vendor, with NODEGX_REPO set to a NodeGX checkout)`);
  delete require.cache[outfile];
  loaded = require(outfile);
  return loaded;
}

const readProject = (dir) => JSON.parse(readFileSync(join(dir, 'nodegx.project.json'), 'utf8'));

export const LIVE = 'cloudservicesLive';

/** The project's binding, raw: `{instanceId, endpoint, appId, type}`, or {}. `key` is `cloudservices` or LIVE. */
export function bindingOf(dir, key = 'cloudservices') {
  try {
    const cs = readProject(dir).metadata?.[key];
    return cs && typeof cs === 'object' ? cs : {};
  } catch {
    return {};
  }
}
export const liveBindingOf = (dir) => bindingOf(dir, LIVE);

/** Writes the binding in the shape the NodeGX editor and MCP server write (`ProjectStore.writeCloudServices`). */
function bind(dir, binding, key = 'cloudservices') {
  const file = join(dir, 'nodegx.project.json');
  const text = readFileSync(file, 'utf8');
  const project = JSON.parse(text);
  project.metadata = { ...(project.metadata ?? {}), [key]: { ...(project.metadata?.[key] ?? {}), ...binding } };
  writeFileSync(file, JSON.stringify(project, null, 2) + (text.endsWith('\n') ? '\n' : ''));
}

/**
 * NodeGX's rule for a template that needs a backend (`templateNeedsBackend` in the editor): it ships a security
 * policy, or a cloud function component. Read off the folder, never a hand-written flag.
 */
export function needsBackend(dir) {
  if (existsSync(join(dir, 'nodegx.security.json'))) return true;
  try {
    return Object.keys(JSON.parse(readFileSync(join(dir, 'components/_registry.json'), 'utf8')).components ?? {}).some((name) => /^\/?#?__cloud__\//.test(name)); // the registry writes `__cloud__/name`
  } catch {
    return false;
  }
}

/** The editor's name for a project's backend (`backendNameForProject`), so a backend reads the same in both lists. */
const backendName = (dir) => {
  let name = '';
  try {
    name = readProject(dir).name ?? '';
  } catch { /* unnamed */ }
  name = (name || basename(dir)).replace(/\s+/g, ' ').trim();
  return /backend$/i.test(name) ? name : `${name} backend`;
};

const endpointOf = (port) => `http://127.0.0.1:${port}`;

/**
 * A new project from a template that needs a backend gets one, at creation (the editor's `ensureTemplateBackend`):
 * created, owned by the project's id and bound, but NOT started — opening the project starts it. A project already
 * bound keeps its binding.
 */
export async function attachNewBackend(dir) {
  if (!needsBackend(dir)) return { status: 'not-needed' };
  const now = bindingOf(dir);
  if (now.endpoint) return { status: 'already-bound', endpoint: now.endpoint };
  const k = await kit();
  const { id } = k.ensureProjectId(dir);
  const name = backendName(dir);
  const config = k.findReusableBackend(k.listBackendConfigs(), name, id) ?? (await k.createBackendDir(name, id));
  bind(dir, { instanceId: config.id, endpoint: endpointOf(config.port), appId: config.id, type: 'nodegx' });
  return { status: 'attached', backendId: config.id, endpoint: endpointOf(config.port) };
}

/** The local backend the project is bound to, from its own config.json, or null (unbound, or not on this machine). */
export async function localBackendOf(dir, key = 'cloudservices') {
  const { instanceId } = bindingOf(dir, key);
  if (!instanceId) return null;
  const k = await kit();
  return k.readBackendConfig(instanceId) ?? null;
}

/**
 * Starts the project's local backend, or adopts it when it already runs (the editor's or Claude Code's, or this
 * Studio's from a moment ago). Resolves with `{ phase: 'running' | 'adopted', id, name, endpoint, pid }`.
 */
export async function startFor(dir, config) {
  const k = await kit();
  const record = k.readRuntimeRecord(config.id);
  if (record && k.processIsAlive(record.pid) && k.verifyIsOurBackend(record) === 'verified') {
    return { phase: 'adopted', id: config.id, name: config.name, endpoint: record.endpoint, pid: record.pid };
  }
  k.installExitHooks(); // SIGTERM / SIGINT stop what this process started; --parent-pid covers a SIGKILL
  const started = await k.startBackend(config, { projectDir: dir });
  return { phase: 'running', id: started.backendId, name: started.name, endpoint: started.endpoint, pid: started.pid };
}

/** Stops a backend this process started. One it adopted is left running: it is not ours to stop. */
export async function stop(id) {
  const k = await kit();
  if (!k.ownedBackendIds().includes(id)) return { stopped: false, how: 'not started by Studio' };
  return k.stopBackend(id);
}

/**
 * A project that is bound to nothing gets a backend of its own on request (the Data tab's button): NodeGX's
 * provision — reused if this project already owns one of that name, adopted if it runs — seeded with the project's
 * declared types, and bound.
 */
export async function provisionFor(dir) {
  const now = bindingOf(dir);
  if (now.endpoint) throw new Error(`This project already points at ${now.endpoint}. Nothing was created.`);
  const k = await kit();
  const identity = k.ensureProjectId(dir);
  const collections = (readProject(dir).metadata?.dbCollections ?? []).map((c) => ({ name: c.name, columns: (c.columns ?? []).map(({ name, type }) => ({ name, type })) }));
  k.installExitHooks();
  const result = await k.provisionBackend({ name: backendName(dir), collections, projectId: identity.id, projectDir: dir, identity: { reason: identity.reason, minted: identity.outcome === 'minted' } });
  bind(dir, { instanceId: result.backendId, endpoint: result.endpoint, appId: result.backendId, type: 'nodegx' });
  return { phase: result.adopted ? 'adopted' : 'running', id: result.backendId, name: result.name, endpoint: result.endpoint, pid: result.pid, warnings: result.warnings };
}

/**
 * STU-065: the app's live backend, made on request (Data's "Make a live database"): NodeGX's provision under the name
 * "<app> live backend", owned by the project, started, and named in `metadata.cloudservicesLive`. It starts with no
 * tables: development's schema reaches it through Deploy to live (lib/live.mjs), as every later change does. The
 * project's policy file is its first policy, as it is for any backend started on the project.
 */
export async function provisionLiveFor(dir) {
  const now = liveBindingOf(dir);
  if (now.endpoint) throw new Error(`This app already has a live database at ${now.endpoint}. Nothing was created.`);
  if (!bindingOf(dir).endpoint) throw new Error('This app has no development database yet. Start one first; live is made from it.');
  const k = await kit();
  const identity = k.ensureProjectId(dir);
  k.installExitHooks();
  const name = backendName(dir).replace(/ backend$/i, ' live backend');
  const result = await k.provisionBackend({ name, collections: [], projectId: identity.id, projectDir: dir, identity: { reason: identity.reason, minted: identity.outcome === 'minted' } });
  bind(dir, { instanceId: result.backendId, endpoint: result.endpoint, appId: result.backendId, type: 'nodegx' }, LIVE);
  return { phase: result.adopted ? 'adopted' : 'running', id: result.backendId, name: result.name, endpoint: result.endpoint, pid: result.pid, warnings: result.warnings };
}

/** The admin credential a local backend minted for itself (`secrets.json`), for the Data tab's own requests. Read, never written. */
export async function adminTokenOf(id) {
  const k = await kit();
  try {
    return JSON.parse(readFileSync(join(k.backendsRoot(), id, 'secrets.json'), 'utf8')).adminToken || null;
  } catch {
    return null;
  }
}
