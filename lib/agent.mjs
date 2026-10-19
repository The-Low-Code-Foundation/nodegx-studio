/**
 * STU-005 — Work with Claude Code.
 *
 * Studio does not have its own way of registering the NodeGX MCP server for a project. It uses the NodeGX editor's,
 * bundled from the checkout on every start, the way `lib/backend.mjs` bundles the backend code:
 *
 *   - the editor's front door (`main/src/mcp/mcpFrontDoor.js`): where the server bundle is, what can run it (`node`,
 *     or this Electron binary with ELECTRON_RUN_AS_NODE), and whether the folder is a project the server will open;
 *   - `buildProjectRegistration` (`SettingsPanel/sections/mcpCommands.ts`): the registration that follows from that,
 *     under the per-project name `nodegx-<folder>` (a bare `nodegx` would be shadowed by a user-scope one);
 *   - `backfillAgentConfig` (`models/template/agentConfig.ts`): the writer of `.mcp.json`, `CLAUDE.md`, `AGENTS.md`
 *     and the `.gitignore` line, with its rules — nothing that is already there is overwritten, and a folder the
 *     server would refuse to open gets no registration naming it.
 *
 * So a project Studio connects carries the same three files, in the same words, as one the NodeGX editor opened.
 * What is Studio's own is only the filesystem under the writer and `stateOf`, which reads a `.mcp.json` that is
 * already there so the panel can say what it does — the writer keeps such a file, and keeping one that registers
 * NodeGX for another folder (a copied project) would otherwise read as "connected".
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { nodegxRepo, studioRoot } from './nodegx.mjs';

const require = createRequire(import.meta.url);
const EDITOR = join(nodegxRepo, 'packages/noodl-editor/src');
const SOURCES = {
  frontDoor: join(EDITOR, 'main/src/mcp/mcpFrontDoor.js'),
  commands: join(EDITOR, 'editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts'),
  agentConfig: join(EDITOR, 'editor/src/models/template/agentConfig.ts')
};

let loaded = null;
/** The editor's front door, registration and writer, bundled from the checkout. Throws with what is missing. */
export async function kit() {
  if (loaded) return loaded;
  for (const at of Object.values(SOURCES)) if (!existsSync(at)) throw new Error(`no NodeGX editor code at ${at}`);
  const { buildSync } = await import(join(nodegxRepo, 'node_modules/esbuild/lib/main.js'));
  const outfile = join(studioRoot, '.kit', 'agent.cjs');
  mkdirSync(join(studioRoot, '.kit'), { recursive: true });
  buildSync({
    stdin: {
      contents: [
        `export { describeMcpFrontDoor } from ${JSON.stringify(SOURCES.frontDoor)};`,
        `export { buildProjectRegistration, quoteArg } from ${JSON.stringify(SOURCES.commands)};`,
        `export { backfillAgentConfig, AGENT_CONFIG_PATHS } from ${JSON.stringify(SOURCES.agentConfig)};`
      ].join('\n'),
      resolveDir: EDITOR,
      loader: 'ts'
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    // the front door asks Electron for the app's paths when it can; this server is Electron running as Node, where
    // `require('electron')` is only the binary's path, and the answers it would give are the NodeGX editor's anyway
    external: ['electron'],
    outfile,
    logLevel: 'warning'
  });
  delete require.cache[outfile];
  loaded = require(outfile);
  return loaded;
}

/** The writer's three primitives over `fs`, rooted at the project. Writes are atomic: a half-written `.mcp.json` is a client that will not start. */
function host(dir, written) {
  const at = (rel) => join(dir, ...rel.split('/'));
  return {
    exists: (rel) => existsSync(at(rel)),
    read: (rel) => readFileSync(at(rel), 'utf8'),
    write: (rel, content) => {
      const file = at(rel);
      mkdirSync(dirname(file), { recursive: true });
      written?.(rel, content);
      const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
      writeFileSync(tmp, content, 'utf8');
      renameSync(tmp, file);
    }
  };
}

const isNodegxServer = (entry) =>
  Array.isArray(entry?.args) && entry.args.some((a) => typeof a === 'string' && (/noodl-mcp\.cjs$/.test(a) || a.startsWith('@nodegx/mcp')));

/**
 * What connecting this folder means now.
 *
 * `state` is one of:
 *   connected    `.mcp.json` registers the NodeGX server for this folder (`name` is what it is called there)
 *   none         no `.mcp.json`: the button writes one
 *   elsewhere    `.mcp.json` registers the NodeGX server for another folder (`elsewhere`) — a copied project
 *   other        `.mcp.json` registers other servers only
 *   broken       `.mcp.json` is not JSON the client can read
 *   unavailable  the server bundle was not found (`probed` is where NodeGX looked) or the folder is not a project it opens
 */
export async function stateOf(dir) {
  dir = resolve(dir);
  const k = await kit();
  const door = k.describeMcpFrontDoor(dir, { packagesRoots: [join(nodegxRepo, 'packages')], userProfilePath: null, isPackaged: false });
  const { serverName, registration } = k.buildProjectRegistration(door, dir);
  const base = {
    serverName,
    registration,
    command: `cd ${k.quoteArg(dir)} && claude`,
    runtime: registration ? (registration.command === 'node' ? 'node' : 'electron') : null
  };
  if (door.project?.format !== 'v2') return { ...base, state: 'unavailable', reason: door.project?.message ?? 'Not a NodeGX project.' };
  if (!registration) {
    return { ...base, state: 'unavailable', reason: `The NodeGX MCP server was not found. Looked in: ${door.servers['noodl-mcp'].probed.join(', ')}` };
  }
  const file = join(dir, k.AGENT_CONFIG_PATHS.mcp);
  if (!existsSync(file)) return { ...base, state: 'none' };
  let servers;
  try {
    servers = JSON.parse(readFileSync(file, 'utf8')).mcpServers ?? {};
  } catch (err) {
    return { ...base, state: 'broken', reason: `.mcp.json is not valid JSON: ${err.message}` };
  }
  const ours = Object.entries(servers).filter(([, entry]) => isNodegxServer(entry));
  const here = ours.find(([, entry]) => entry.args.some((a) => typeof a === 'string' && resolve(a) === dir));
  if (here) return { ...base, state: 'connected', name: here[0], registered: here[1] };
  if (ours.length) {
    const [name, entry] = ours[0];
    const folder = entry.args.find((a) => typeof a === 'string' && (a.startsWith('/') || /^[A-Za-z]:[\\/]/.test(a)) && !/\.c?js$/.test(a));
    return { ...base, state: 'elsewhere', name, elsewhere: folder ?? null };
  }
  return { ...base, state: 'other', others: Object.keys(servers) };
}

/**
 * "Connect Claude Code": the NodeGX editor's writer, on a folder with no `.mcp.json`. Any other state is reported, not
 * written over — the writer would keep the file and then write a CLAUDE.md telling the agent a server is registered
 * that is not. `onWrite(rel, text)` is called before each file is written, so the caller can know its own writes.
 */
export async function connect(dir, onWrite) {
  dir = resolve(dir);
  const before = await stateOf(dir);
  if (before.state !== 'none') return { ...before, files: [] };
  const k = await kit();
  const report = await k.backfillAgentConfig(host(dir, onWrite), {
    projectName: dir.split(/[\\/]/).pop(),
    serverName: before.serverName,
    registration: before.registration
  });
  return { ...(await stateOf(dir)), files: report.files };
}
