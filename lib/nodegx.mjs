/**
 * STU-006 — where Studio's NodeGX kit pieces are.
 *
 * NodeGX Studio is built from the NodeGX kit: the deploy runtime, `@nodegx/preview`'s in-page bundle, the look and
 * specs modules, the backend (the service, and the MCP server's code that provisions and adopts one), the MCP server and
 * the editor's writer of its registration, the phrasebook and the templates. A fresh clone gets them from two places,
 * both pinned:
 *
 *   node_modules/   what NodeGX publishes to npm, at the exact versions in package.json: `@nodegx/preview` (the
 *                   deploy runtime, the in-page bundle) and `@nodegx/mcp` (the MCP server, the backend service)
 *   vendor/         what it does not publish, built from one NodeGX commit by `npm run vendor` and committed;
 *                   vendor/NODEGX.json names the commit and every file's hash
 *
 * Set NODEGX_REPO to a NodeGX checkout to use the checkout's pieces instead, as built there (working on the kit and
 * Studio together; `npm run vendor` reads it too). Nothing else looks for a checkout.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const vendorDir = join(studioRoot, 'vendor');
export const nodegxRepo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : null;

/** Where a checkout builds the Orbit prototype's look and specs modules (its prototype/real/build.sh). */
export const ORBIT = 'dev-docs/tasks/phase-112-your-own-nodegx/prototype/real';

/** The esbuild options for the backend manager's field kinds as an ES module (vendor/fields.js, or .kit/fields.js from a checkout). */
export const fieldsBundle = (from) => ({ entryPoints: [join(from, 'packages/nodegx-backend/src/admin/app/fieldKinds.ts')], bundle: true, format: 'esm', platform: 'browser', logLevel: 'warning' });

const repo = (p) => join(nodegxRepo, p);
/** A file of an npm dependency, found as Node finds a package: in Studio's own node_modules, then each one above it.
    Installed as a dependency (`npm install @nodegx/studio`, `npx @nodegx/studio`), npm puts `@nodegx/preview` and
    `@nodegx/mcp` beside Studio, not inside it (P128-BETA-STUDIOHOISTED). Read as a path, never imported: no package's
    `exports` comes into it. */
const npm = (p) => {
  const name = p.split('/').slice(0, p.startsWith('@') ? 2 : 1).join('/');
  for (let dir = studioRoot; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return join(dir, 'node_modules', p);
    if (dirname(dir) === dir) return join(studioRoot, 'node_modules', p); // none: said missing where Studio looked first
  }
};
const vendor = (p) => join(vendorDir, p);

export const kit = nodegxRepo
  ? {
      from: `the NodeGX checkout at ${nodegxRepo}`,
      runtimeDir: repo('packages/noodl-editor/src/external/deploy'),
      deployEngine: repo('packages/noodl-preview/dist/nodegx-deploy.cjs'),
      previewBundle: repo('packages/noodl-preview/dist/browser/noodl-preview-in-page.js'),
      look: repo(`${ORBIT}/look.js`),
      specs: repo(`${ORBIT}/specs.js`),
      // bundled from the checkout's source on the first ask, into the ignored .kit/ (editor/serve.mjs)
      fields: null,
      phrasebook: repo('scripts/bubble-phrasebook/rows.js'),
      templates: repo('templates'),
      // P128 S5 (STU-083): the page Studio's Help draws, the same one every NodeGX surface quotes
      canon: repo('docs/CANON.md'),
      mcpServer: repo('packages/noodl-mcp/dist/noodl-mcp.cjs'),
      backendCli: repo('packages/nodegx-backend/dist/cli.js'),
      // bundled from the checkout's sources on every start, into the ignored .kit/ (lib/backend.mjs, lib/agent.mjs)
      backendKit: null,
      agentKit: null
    }
  : {
      from: 'vendor/ and node_modules/',
      runtimeDir: npm('@nodegx/preview/dist/external/deploy'),
      deployEngine: npm('@nodegx/preview/dist/nodegx-deploy.cjs'),
      previewBundle: npm('@nodegx/preview/dist/browser/noodl-preview-in-page.js'),
      look: vendor('look.js'),
      specs: vendor('specs.js'),
      fields: vendor('fields.js'),
      phrasebook: vendor('phrasebook/rows.js'),
      templates: vendor('templates'),
      canon: vendor('docs/CANON.md'),
      mcpServer: npm('@nodegx/mcp/dist/noodl-mcp.cjs'),
      backendCli: npm('@nodegx/mcp/dist/backend/cli.js'),
      backendKit: vendor('backend.cjs'),
      agentKit: vendor('agent.cjs')
    };
