/**
 * STU-004 — the project's backend, run by Studio.
 *
 * Studio does not have its own way of running a backend. It uses NodeGX's: the backends live where the NodeGX editor
 * and the NodeGX MCP server keep theirs (`~/.noodl/backends/<id>/`, or NODEGX_BACKENDS_DIR), each one owned by the
 * projects named in its `config.json`, started as `nodegx-backend serve` on that folder with `--project-dir` (so the
 * project's `nodegx.security.json` is the policy a new backend starts on) and `--parent-pid`, and recorded in a
 * runtime file that every spawner reads before it starts anything, so a backend that the editor or Claude Code
 * already runs is adopted, never started twice on one database. That code is the MCP server's
 * (`packages/noodl-mcp/src/backend/`): this module bundles it from the NodeGX checkout on every start (esbuild, about
 * 0.2 s), so Studio never runs an older copy than the checkout holds.
 *
 * The project names its backend the way NodeGX does: `nodegx.project.json → metadata.cloudservices`
 * (`{instanceId, endpoint, appId, type}`). A backend is "local" when `instanceId` is a folder under the backends root;
 * anything else (a deployed backend, Noodl Cloud) is shown and talked to, never started or stopped.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { nodegxRepo, studioRoot } from './nodegx.mjs';

const require = createRequire(import.meta.url);
const SOURCE = join(nodegxRepo, 'packages/noodl-mcp/src/backend');
const SERVICE = join(nodegxRepo, 'packages/nodegx-backend/dist/cli.js');

let loaded = null;
/** The kit's backend modules, bundled from the checkout. Throws with what is missing. */
export async function kit() {
  if (loaded) return loaded;
  if (!existsSync(join(SOURCE, 'provision.ts'))) throw new Error(`no NodeGX backend code at ${SOURCE}`);
  if (!process.env.NODEGX_BACKEND_ENTRY) {
    if (!existsSync(SERVICE)) throw new Error(`no nodegx-backend at ${SERVICE} (npm run build in packages/nodegx-backend)`);
    // bundled, the kit's own search for the service starts from .kit/ and finds nothing
    process.env.NODEGX_BACKEND_ENTRY = SERVICE;
  }
  const { buildSync } = await import(join(nodegxRepo, 'node_modules/esbuild/lib/main.js'));
  const outfile = join(studioRoot, '.kit', 'backend.cjs');
  mkdirSync(join(studioRoot, '.kit'), { recursive: true });
  buildSync({
    stdin: {
      contents: "export * from './provision'; export * from './runtimeRecord'; export { backendsRoot } from './client'; export { ensureProjectId } from './projectIdentity';",
      resolveDir: SOURCE,
      loader: 'ts'
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile,
    logLevel: 'warning'
  });
  delete require.cache[outfile];
  loaded = require(outfile);
  return loaded;
}

const readProject = (dir) => JSON.parse(readFileSync(join(dir, 'nodegx.project.json'), 'utf8'));

/** The project's binding, raw: `{instanceId, endpoint, appId, type}`, or {}. */
export function bindingOf(dir) {
  try {
    const cs = readProject(dir).metadata?.cloudservices;
    return cs && typeof cs === 'object' ? cs : {};
  } catch {
    return {};
  }
}

/** Writes the binding in the shape the NodeGX editor and MCP server write (`ProjectStore.writeCloudServices`). */
function bind(dir, binding) {
  const file = join(dir, 'nodegx.project.json');
  const text = readFileSync(file, 'utf8');
  const project = JSON.parse(text);
  project.metadata = { ...(project.metadata ?? {}), cloudservices: { ...(project.metadata?.cloudservices ?? {}), ...binding } };
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
export async function localBackendOf(dir) {
  const { instanceId } = bindingOf(dir);
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

/** The admin credential a local backend minted for itself (`secrets.json`), for the Data tab's own requests. Read, never written. */
export async function adminTokenOf(id) {
  const k = await kit();
  try {
    return JSON.parse(readFileSync(join(k.backendsRoot(), id, 'secrets.json'), 'utf8')).adminToken || null;
  } catch {
    return null;
  }
}
