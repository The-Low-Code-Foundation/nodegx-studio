/**
 * STU-006 — where Studio's NodeGX kit pieces are.
 *
 * NodeGX Studio is built from the NodeGX kit: the deploy runtime, `@nodegx/preview`'s in-page bundle, the look and
 * specs modules, the backend (the service, and the MCP server's code that provisions and adopts one), the MCP server and
 * the editor's writer of its registration, the phrasebook and the templates. A fresh clone gets them from two places,
 * both pinned:
 *
 *   node_modules/   what NodeGX publishes to npm, at the exact versions in package.json: `@nodegx/preview` (the
 *                   deploy runtime) and `@nodegx/mcp` (the MCP server, the backend service)
 *   vendor/         what it does not publish (and the in-page bundle, until npm's has a fix), built from one NodeGX
 *                   commit by `npm run vendor` and committed;
 *                   vendor/NODEGX.json names the commit and every file's hash
 *
 * Set NODEGX_REPO to a NodeGX checkout to use the checkout's pieces instead, as built there (working on the kit and
 * Studio together; `npm run vendor` reads it too). Nothing else looks for a checkout.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const vendorDir = join(studioRoot, 'vendor');
export const nodegxRepo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : null;

/** Where a checkout builds the Orbit prototype's look and specs modules (its prototype/real/build.sh). */
export const ORBIT = 'dev-docs/tasks/phase-112-your-own-nodegx/prototype/real';

const repo = (p) => join(nodegxRepo, p);
const npm = (p) => join(studioRoot, 'node_modules', p);
const vendor = (p) => join(vendorDir, p);

export const kit = nodegxRepo
  ? {
      from: `the NodeGX checkout at ${nodegxRepo}`,
      runtimeDir: repo('packages/noodl-editor/src/external/deploy'),
      previewBundle: repo('packages/noodl-preview/dist/browser/noodl-preview-in-page.js'),
      look: repo(`${ORBIT}/look.js`),
      specs: repo(`${ORBIT}/specs.js`),
      phrasebook: repo('scripts/bubble-phrasebook/rows.js'),
      templates: repo('templates'),
      mcpServer: repo('packages/noodl-mcp/dist/noodl-mcp.cjs'),
      backendCli: repo('packages/nodegx-backend/dist/cli.js'),
      // bundled from the checkout's sources on every start, into the ignored .kit/ (lib/backend.mjs, lib/agent.mjs)
      backendKit: null,
      agentKit: null
    }
  : {
      from: 'vendor/ and node_modules/',
      runtimeDir: npm('@nodegx/preview/dist/external/deploy'),
      // built from the vendored commit until a release has P123-S2-VARIANTLOST's fix (scripts/vendor.mjs PREVIEW_FIXED_IN)
      previewBundle: vendor('preview/noodl-preview-in-page.js'),
      look: vendor('look.js'),
      specs: vendor('specs.js'),
      phrasebook: vendor('phrasebook/rows.js'),
      templates: vendor('templates'),
      mcpServer: npm('@nodegx/mcp/dist/noodl-mcp.cjs'),
      backendCli: npm('@nodegx/mcp/dist/backend/cli.js'),
      backendKit: vendor('backend.cjs'),
      agentKit: vendor('agent.cjs')
    };
