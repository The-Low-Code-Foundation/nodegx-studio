/**
 * STU-006 — vendor/: the NodeGX kit pieces Studio uses that NodeGX does not publish to npm, at one NodeGX commit.
 *
 *   NODEGX_REPO=../OpenNoodl npm run vendor     rebuilds vendor/ from that checkout's HEAD
 *   npm run check:vendor                        every file in vendor/ is the one vendor/NODEGX.json names, and every
 *                                               kit piece lib/nodegx.mjs names is there
 *
 * What it holds (lib/nodegx.mjs reads it):
 *   templates/<dir>/      the five shelf templates the welcome screen offers (app/actions.mjs TEMPLATES), from git
 *   phrasebook/rows.js    scripts/bubble-phrasebook/rows.js, from git
 *   look.js, specs.js     @nodegx/canvas-look and @nodegx/node-spec's browser entry as ES modules, as the Orbit
 *                         prototype's build.sh bundles them
 *   backend.cjs           the MCP server's provisioning and runtime record, and the backend's policy validator (lib/backend.mjs)
 *   agent.cjs             the NodeGX editor's MCP front door, registration and writer of `.mcp.json` (lib/agent.mjs)
 *   preview/              `@nodegx/preview`'s in-page bundle, built from the commit while the release on npm lacks a
 *                         fix Studio needs (PREVIEW_FIXED_IN below)
 *   NODEGX.json           the commit, the npm versions it sits beside, and every file's sha-256
 *
 * The commit is a promise about content: the build refuses when any file a bundle was built from (esbuild's own list
 * of its inputs) differs from that commit, so a vendor/ never carries a checkout's uncommitted edits under its name.
 * What NodeGX publishes (`@nodegx/preview`, `@nodegx/mcp`) is not here: package.json pins it.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { kit, nodegxRepo, ORBIT, studioRoot, vendorDir } from '../lib/nodegx.mjs';

const MANIFEST = join(vendorDir, 'NODEGX.json');
const BUILTIN = new Set(builtinModules);
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const filesOf = (dir) => Object.fromEntries(walk(dir).filter((f) => f !== join(dir, 'NODEGX.json')).map((f) => [relative(dir, f).split(sep).join('/'), sha(f)]).sort(([a], [b]) => a.localeCompare(b)));

if (process.argv.includes('--check')) {
  const problems = [];
  if (!existsSync(MANIFEST)) problems.push('no vendor/NODEGX.json (npm run vendor)');
  else {
    const want = JSON.parse(readFileSync(MANIFEST, 'utf8')).files;
    const have = filesOf(vendorDir);
    for (const [f, h] of Object.entries(want)) if (have[f] !== h) problems.push(have[f] ? `${f} changed since it was vendored` : `${f} is missing`);
    for (const f of Object.keys(have)) if (!(f in want)) problems.push(`${f} is not in NODEGX.json`);
    const pins = JSON.parse(readFileSync(join(studioRoot, 'package.json'), 'utf8')).dependencies ?? {};
    for (const [name, version] of Object.entries(JSON.parse(readFileSync(MANIFEST, 'utf8')).npm)) {
      if (pins[name] !== version) problems.push(`package.json pins ${name} ${pins[name]}, vendor/ was built beside ${version}`);
      const installed = join(studioRoot, 'node_modules', name, 'package.json');
      if (existsSync(installed) && JSON.parse(readFileSync(installed, 'utf8')).version !== version) problems.push(`node_modules holds ${name} ${JSON.parse(readFileSync(installed, 'utf8')).version}, not ${version} (npm install)`);
    }
  }
  if (!nodegxRepo) {
    for (const [what, at] of Object.entries(kit)) if (what !== 'from' && at && !existsSync(at)) problems.push(`${what}: nothing at ${relative(studioRoot, at)}`);
  }
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(problems.length ? `FAIL vendor/ (${problems.length})` : `PASS vendor/ — ${Object.keys(JSON.parse(readFileSync(MANIFEST, 'utf8')).files).length} files as NODEGX.json names them; the kit is read from ${kit.from}`);
  process.exit(problems.length ? 1 : 0);
}

if (!nodegxRepo) {
  console.error('vendor: set NODEGX_REPO to the NodeGX checkout to vendor from, e.g. NODEGX_REPO=../OpenNoodl npm run vendor');
  process.exit(2);
}
const repo = nodegxRepo;
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const commit = git('rev-parse', 'HEAD').trim();
const { TEMPLATES } = await import('../app/actions.mjs');
const backend = await import('../lib/backend.mjs');
const agent = await import('../lib/agent.mjs');
const esbuild = await import(join(repo, 'node_modules/esbuild/lib/main.js'));

const out = `${vendorDir}.tmp-${process.pid}`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
process.on('exit', (code) => code && rmSync(out, { recursive: true, force: true }));

// from git, at the commit: a peer's uncommitted template edit is not taken
const fromGit = [...TEMPLATES.map((t) => `templates/${t.dir}`), 'scripts/bubble-phrasebook/rows.js'];
execFileSync('tar', ['-x', '-C', out], { input: execFileSync('git', ['-C', repo, 'archive', commit, '--', ...fromGit], { maxBuffer: 1 << 30 }) });
mkdirSync(join(out, 'phrasebook'), { recursive: true });
renameSync(join(out, 'scripts/bubble-phrasebook/rows.js'), join(out, 'phrasebook/rows.js'));
rmSync(join(out, 'scripts'), { recursive: true });

// bundled, each with its list of inputs
const bundles = {
  'look.js': { entryPoints: [join(repo, 'packages/nodegx-canvas-look/src/index.ts')], bundle: true, format: 'esm', platform: 'browser', logLevel: 'warning' },
  'specs.js': { entryPoints: [join(repo, ORBIT, 'specs-entry.ts')], bundle: true, format: 'esm', platform: 'browser', minify: true, logLevel: 'warning' },
  'backend.cjs': backend.bundleOptions(repo, null),
  'agent.cjs': agent.bundleOptions(repo, null)
};
const inputs = new Set();
for (const [name, options] of Object.entries(bundles)) {
  const { metafile } = await esbuild.build({ ...options, outfile: join(out, name), absWorkingDir: repo, metafile: true });
  for (const input of Object.keys(metafile.inputs)) inputs.add(input.replace(/^.*?:/, ''));
}
const sources = [...inputs].filter((f) => !f.split('/').includes('node_modules') && f !== '<stdin>');
const dirty = git('status', '--porcelain', '--', ...sources).trim();
if (dirty) {
  rmSync(out, { recursive: true, force: true });
  console.error(`vendor: these files the bundles are built from differ from ${commit.slice(0, 9)}; commit them or build from a clean checkout:\n${dirty}`);
  process.exit(1);
}
// @nodegx/preview 0.2.2, the release npm has, exports every node without its variant (P123-S2-VARIANTLOST, fixed in
// NodeGX on 2026-10-16, the day after it was published), so no style is ever drawn. Until a release carries the fix,
// the in-page bundle is built here, by the package's own build.mjs, in a worktree of the commit: the checkout's own
// dist/ is a build of whatever its working tree held, and other sessions read it.
const PREVIEW_FIXED_IN = null; // the first @nodegx/preview on npm with the fix: then pin it, drop this step and kit.previewBundle's vendor path
if (!PREVIEW_FIXED_IN) {
  const wt = mkdtempSync(join(tmpdir(), 'nodegx-vendor-'));
  try {
    git('worktree', 'add', '--no-checkout', '--detach', wt, commit);
    execFileSync('git', ['-C', wt, 'sparse-checkout', 'set', '--cone', 'packages', 'scripts'], { stdio: 'pipe' });
    execFileSync('git', ['-C', wt, 'checkout', '--detach', commit], { stdio: 'pipe' });
    // its own node_modules: third-party packages are the checkout's, the workspace's own packages are the worktree's
    const linkAll = (from, to) => {
      mkdirSync(to, { recursive: true });
      for (const e of readdirSync(from, { withFileTypes: true })) {
        const at = join(from, e.name);
        if (e.name.startsWith('@') && e.isDirectory()) { linkAll(at, join(to, e.name)); continue; }
        let target = at;
        if (e.isSymbolicLink()) {
          const real = resolve(dirname(at), readlinkSync(at));
          if (real.startsWith(join(repo, 'packages') + sep)) target = join(wt, relative(repo, real));
        }
        symlinkSync(target, join(to, e.name));
      }
    };
    linkAll(join(repo, 'node_modules'), join(wt, 'node_modules'));
    for (const p of readdirSync(join(wt, 'packages'))) {
      const nested = join(repo, 'packages', p, 'node_modules');
      if (existsSync(nested) && !existsSync(join(wt, 'packages', p, 'node_modules'))) symlinkSync(nested, join(wt, 'packages', p, 'node_modules'));
    }
    execFileSync(process.execPath, [join(wt, 'packages/noodl-preview/build.mjs')], { cwd: join(wt, 'packages/noodl-preview'), stdio: ['ignore', 'ignore', 'inherit'] });
    mkdirSync(join(out, 'preview'), { recursive: true });
    copyFileSync(join(wt, 'packages/noodl-preview/dist/browser/noodl-preview-in-page.js'), join(out, 'preview/noodl-preview-in-page.js'));
  } finally {
    // the links go first, so nothing that removes the folder can follow one into the checkout
    rmSync(join(wt, 'node_modules'), { recursive: true, force: true });
    if (existsSync(join(wt, 'packages'))) for (const p of readdirSync(join(wt, 'packages'))) rmSync(join(wt, 'packages', p, 'node_modules'), { force: true });
    git('worktree', 'remove', '--force', wt);
  }
}

for (const name of ['backend.cjs', 'agent.cjs']) {
  const unbundled = [...new Set([...readFileSync(join(out, name), 'utf8').matchAll(/require\("([^"./][^"]*)"\)/g)].map((m) => m[1]))].filter((m) => !m.startsWith('node:') && !BUILTIN.has(m.split('/')[0]) && !(bundles[name].external ?? []).includes(m));
  if (unbundled.length) console.warn(`vendor: ${name} requires what it does not carry (found at run time or not at all): ${unbundled.join(', ')}`);
}

const pkg = JSON.parse(readFileSync(join(studioRoot, 'package.json'), 'utf8'));
const npm = Object.fromEntries(Object.entries(pkg.dependencies ?? {}).filter(([n]) => n.startsWith('@nodegx/')));
writeFileSync(join(out, 'NODEGX.json'), JSON.stringify({
  nodegx: { repository: 'https://github.com/The-Low-Code-Foundation/NodeGX', commit, committed: git('show', '-s', '--format=%cI', commit).trim(), subject: git('show', '-s', '--format=%s', commit).trim() },
  built: new Date().toISOString(),
  esbuild: esbuild.version,
  npm,
  sources: sources.length,
  files: filesOf(out)
}, null, 2) + '\n');

rmSync(vendorDir, { recursive: true, force: true });
renameSync(out, vendorDir);
const size = walk(vendorDir).reduce((n, f) => n + statSync(f).size, 0);
console.log(`vendor/ from NodeGX ${commit.slice(0, 9)}: ${Object.keys(filesOf(vendorDir)).length} files, ${(size / 1e6).toFixed(1)} MB; ${sources.length} bundle sources, all as committed`);
