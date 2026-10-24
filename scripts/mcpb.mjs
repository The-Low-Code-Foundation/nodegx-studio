/**
 * P125 CCN-006 — the NodeGX Desktop Extension: one `.mcpb` that Claude Desktop installs by double-click.
 *
 *   npm run mcpb                 writes dist/nodegx-<version>.mcpb (version = the pinned @nodegx/mcp)
 *   npm run mcpb -- --stage-only writes dist/mcpb-stage/ and stops (to drive the server as Desktop would start it)
 *
 * What is in it (Richard's ruling, CCN-006): the server AND Studio's web files, so the person installs one thing and
 * Studio opens inside the conversation; the desktop app is offered later, when they need Studio on its own.
 *   studio/         editor/, lib/, import/*.mjs, vendor/ and package.json, with `npm ci --omit=dev` beside them: the
 *                   pinned @nodegx/mcp, @nodegx/preview and @nodegx/backend-map. Not app/ (Electron's).
 *   manifest.json   the server is that @nodegx/mcp, started on Desktop's own Node (a `node` server), so the Node on
 *                   the person's PATH never matters (P125 s5: Desktop's PATH found Node 16, and the bundle needs 20+).
 *                   NODEGX_STUDIO points open_studio at studio/; NODEGX_DEPLOY_CLI points deploy_to_vm at the bundled
 *                   preview's engine, so nothing is fetched with npx (a Desktop-run Node may have no npx beside it).
 *
 * Packed with @anthropic-ai/mcpb (pinned below, run through npx; not a dependency of Studio).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { studioRoot } from '../lib/nodegx.mjs';

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';
const dist = join(studioRoot, 'dist');
const stage = join(dist, 'mcpb-stage');
const studio = join(stage, 'studio');
const pkg = JSON.parse(readFileSync(join(studioRoot, 'package.json'), 'utf8'));
const mcpVersion = pkg.dependencies['@nodegx/mcp'];
const server = 'studio/node_modules/@nodegx/mcp/bin/noodl-mcp.js';

rmSync(stage, { recursive: true, force: true });
mkdirSync(studio, { recursive: true });
const skip = (src) => /check\.mjs$|\.DS_Store$/.test(src);
for (const dir of ['editor', 'lib', 'vendor']) cpSync(join(studioRoot, dir), join(studio, dir), { recursive: true, filter: (src) => !skip(src) });
mkdirSync(join(studio, 'import'));
for (const f of readdirSync(join(studioRoot, 'import'))) if (f.endsWith('.mjs') && !skip(f)) cpSync(join(studioRoot, 'import', f), join(studio, 'import', f));
for (const f of ['package.json', 'package-lock.json', 'LICENSE']) cpSync(join(studioRoot, f), join(studio, f));
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: studio, stdio: 'inherit' });
// npm leaves the dev dependencies' scope folders behind, empty
for (const d of readdirSync(join(studio, 'node_modules'))) if (d.startsWith('@') && !readdirSync(join(studio, 'node_modules', d)).length) rmSync(join(studio, 'node_modules', d), { recursive: true });
cpSync(join(studioRoot, 'app', 'icon.png'), join(stage, 'icon.png'));
if (!existsSync(join(stage, server))) throw new Error(`mcpb: ${server} is missing after npm ci`);

const manifest = {
  manifest_version: '0.3',
  name: 'nodegx',
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
        NODEGX_STUDIO: '${__dirname}/studio',
        NODEGX_DEPLOY_CLI: '${__dirname}/studio/node_modules/@nodegx/preview/dist/nodegx-deploy.cjs'
      }
    }
  },
  tools_generated: true,
  keywords: ['app builder', 'no-code', 'visual editor', 'full stack', 'nodegx'],
  compatibility: { platforms: ['darwin', 'win32'], runtimes: { node: '>=20.0.0' } }
};
writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const size = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
console.log(`mcpb: staged ${(size(stage) / 1e6).toFixed(1)} MB at ${stage}`);
if (process.argv.includes('--stage-only')) process.exit(0);

const out = join(dist, `nodegx-${mcpVersion}.mcpb`);
rmSync(out, { force: true });
execFileSync('npx', ['-y', MCPB_CLI, 'validate', join(stage, 'manifest.json')], { stdio: 'inherit' });
execFileSync('npx', ['-y', MCPB_CLI, 'pack', stage, out], { stdio: 'inherit' });
console.log(`mcpb: ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
