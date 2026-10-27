/**
 * P125 CCN-006 — the NodeGX Desktop Extension: one `.mcpb` that Claude Desktop installs by double-click.
 *
 *   npm run mcpb                 writes dist/nodegx-<version>.mcpb (version = the pinned @nodegx/mcp)
 *   npm run mcpb -- --stage-only writes dist/mcpb-stage/ and stops (to drive the server as Desktop would start it)
 *   npm run mcpb -- --mcp-tarball <@nodegx/mcp .tgz>   a test build on an unpublished server (version from the tarball)
 *   npm run mcpb -- --node darwin-x64                   the Node to bundle (default: this machine's platform-arch)
 *
 * What is in it (Richard's ruling, CCN-006): the server AND Studio's web files, so the person installs one thing and
 * Studio opens inside the conversation; the desktop app is offered later, when they need Studio on its own.
 *   studio/         editor/, lib/, import/*.mjs, vendor/ and package.json, with `npm ci --omit=dev` beside them: the
 *                   pinned @nodegx/mcp, @nodegx/preview and @nodegx/backend-map. Not app/ (Electron's).
 *   manifest.json   the server is that @nodegx/mcp, started on Desktop's own Node (a `node` server), so the Node on
 *                   the person's PATH never matters (P125 s5: Desktop's PATH found Node 16, and the bundle needs 20+).
 *                   NODEGX_STUDIO points open_studio at studio/; NODEGX_DEPLOY_CLI points deploy_to_vm at the bundled
 *                   preview's engine, so nothing is fetched with npx (a Desktop-run Node may have no npx beside it).
 *   node/           Node.js's own signed binary (NODE_VERSION, checksum-checked against nodejs.org's SHASUMS256.txt)
 *                   and its LICENSE. NODEGX_NODE names it, and the server starts its children on it: Studio, the
 *                   render harness, the backend, deploy. Desktop's built-in Node is an Electron utility process whose
 *                   execPath is Claude's helper binary, which refuses to run a script (P128-S3-HELPERNODE, Richard's
 *                   AC8 run 2026-10-27: Studio and the render never started). The server itself stays on Desktop's Node.
 *                   One platform-arch per bundle, so the file name carries it.
 *
 * Packed with @anthropic-ai/mcpb (pinned below, run through npx; not a dependency of Studio).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { studioRoot } from '../lib/nodegx.mjs';

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';
const dist = join(studioRoot, 'dist');
const stage = join(dist, 'mcpb-stage');
const studio = join(stage, 'studio');
const pkg = JSON.parse(readFileSync(join(studioRoot, 'package.json'), 'utf8'));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const mcpTarball = arg('--mcp-tarball') && resolve(arg('--mcp-tarball'));
const mcpVersion = mcpTarball
  ? JSON.parse(execFileSync('tar', ['-xOzf', mcpTarball, 'package/package.json'], { encoding: 'utf8' })).version
  : pkg.dependencies['@nodegx/mcp'];
const NODE_VERSION = 'v22.22.0';
const nodeTarget = arg('--node') ?? `${process.platform}-${process.arch}`;
const [nodePlatform] = nodeTarget.split('-');

/** Node.js's official binary for `nodeTarget`, checksum-checked, into `<stage>/node/` beside its LICENSE. */
function bundleNode() {
  if (nodePlatform !== 'darwin') throw new Error(`mcpb: bundling Node for ${nodeTarget} is not built yet (darwin-arm64, darwin-x64)`);
  const name = `node-${NODE_VERSION}-${nodeTarget}`;
  const cache = join(dist, 'node-cache');
  mkdirSync(cache, { recursive: true });
  const tgz = join(cache, `${name}.tar.gz`);
  if (!existsSync(tgz)) execFileSync('curl', ['-fsSL', '-o', tgz, `https://nodejs.org/dist/${NODE_VERSION}/${name}.tar.gz`], { stdio: 'inherit' });
  const sums = execFileSync('curl', ['-fsSL', `https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`], { encoding: 'utf8' });
  const want = sums.split('\n').find((l) => l.endsWith(`  ${name}.tar.gz`))?.split(' ')[0];
  const have = createHash('sha256').update(readFileSync(tgz)).digest('hex');
  if (!want || want !== have) {
    rmSync(tgz, { force: true });
    throw new Error(`mcpb: ${name}.tar.gz does not match nodejs.org's SHASUMS256.txt (${have} vs ${want})`);
  }
  mkdirSync(join(stage, 'node'), { recursive: true });
  execFileSync('tar', ['-xzf', tgz, '-C', join(stage, 'node'), '--strip-components=1', `${name}/bin/node`, `${name}/LICENSE`]);
}
const server = 'studio/node_modules/@nodegx/mcp/bin/noodl-mcp.js';

rmSync(stage, { recursive: true, force: true });
mkdirSync(studio, { recursive: true });
const skip = (src) => /check\.mjs$|\.DS_Store$/.test(src);
for (const dir of ['editor', 'lib', 'vendor']) cpSync(join(studioRoot, dir), join(studio, dir), { recursive: true, filter: (src) => !skip(src) });
mkdirSync(join(studio, 'import'));
for (const f of readdirSync(join(studioRoot, 'import'))) if (f.endsWith('.mjs') && !skip(f)) cpSync(join(studioRoot, 'import', f), join(studio, 'import', f));
for (const f of ['package.json', 'package-lock.json', 'LICENSE']) cpSync(join(studioRoot, f), join(studio, f));
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: studio, stdio: 'inherit' });
if (mcpTarball) execFileSync('npm', ['install', '--no-save', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', mcpTarball], { cwd: studio, stdio: 'inherit' });
// npm leaves the dev dependencies' scope folders behind, empty
for (const d of readdirSync(join(studio, 'node_modules'))) if (d.startsWith('@') && !readdirSync(join(studio, 'node_modules', d)).length) rmSync(join(studio, 'node_modules', d), { recursive: true });
cpSync(join(studioRoot, 'app', 'icon.png'), join(stage, 'icon.png'));
if (!existsSync(join(stage, server))) throw new Error(`mcpb: ${server} is missing after npm ci`);
bundleNode();

// P128-S3-NAMEMISMATCH: the server answers `initialize` with this name too. A Claude Desktop report says an
// extension's tools reach the chat only when the manifest's `name` and the server's `serverInfo.name` match.
const extensionName = 'nodegx';

const manifest = {
  manifest_version: '0.3',
  name: extensionName,
  display_name: 'NodeGX',
  version: mcpVersion,
  description: 'Build an app with Claude and watch it come together in NodeGX Studio, right in the conversation. Stop Claude any time, change something yourself, and it carries on from your change.',
  long_description: `NodeGX apps are plain files on your computer: pages, workflows, data and privacy rules you can open and change in NodeGX Studio, with or without Claude. This extension carries the NodeGX server (@nodegx/mcp ${mcpVersion}) and Studio's editor (nodegx-studio ${pkg.version}), so nothing else needs installing. Ask Claude to make you an app; Studio opens beside the conversation. Press Hold in Studio and Claude stops writing until you release it.`,
  author: { name: 'The Low-Code Foundation', url: 'https://nodegx.io' },
  homepage: 'https://nodegx.io',
  repository: { type: 'git', url: 'https://github.com/The-Low-Code-Foundation/nodegx-studio' },
  license: 'GPL-3.0-only',
  icon: 'icon.png',
  server: {
    type: 'node',
    entry_point: server,
    mcp_config: {
      command: 'node',
      args: [`\${__dirname}/${server}`, '--allow-writes'],
      env: {
        NODEGX_SERVER_NAME: extensionName,
        NODEGX_STUDIO: '${__dirname}/studio',
        NODEGX_NODE: '${__dirname}/node/bin/node',
        NODEGX_DEPLOY_CLI: '${__dirname}/studio/node_modules/@nodegx/preview/dist/nodegx-deploy.cjs'
      }
    }
  },
  tools_generated: true,
  keywords: ['app builder', 'no-code', 'visual editor', 'full stack', 'nodegx'],
  compatibility: { platforms: [nodePlatform], runtimes: { node: '>=20.0.0' } }
};
writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const size = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
console.log(`mcpb: staged ${(size(stage) / 1e6).toFixed(1)} MB at ${stage}`);
if (process.argv.includes('--stage-only')) process.exit(0);

const out = join(dist, `nodegx-${mcpVersion}-${nodeTarget}.mcpb`);
rmSync(out, { force: true });
execFileSync('npx', ['-y', MCPB_CLI, 'validate', join(stage, 'manifest.json')], { stdio: 'inherit' });
execFileSync('npx', ['-y', MCPB_CLI, 'pack', stage, out], { stdio: 'inherit' });
console.log(`mcpb: ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
