/**
 * The welcome screen's Blank app (lib/blank.mjs through app/actions.mjs createFromTemplate('blank')): a project that opens,
 * named after its folder, its Router listing the one Home page, every length written as the format's unit object (a "48px"
 * string is dropped by the runtime, and Studio says so over the page); a folder that holds files is refused. Then, as
 * Swapshop was built (STU-090): a type with a Choice declared, a backend started for the app (lib/backend.mjs
 * provisionFor, under a backends folder of the check's own), and the backend refuses a value the Choice does not list
 * (P123-STU-CHOICELOST: it took any).
 *
 *   node app/blank-check.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFromTemplate, templates } from './actions.mjs';

let pass = 0, fail = 0;
const ok = (cond, what, detail) => { if (cond) { pass++; console.log(`  ok  ${what}`); } else { fail++; console.log(`  FAIL ${what}`, detail ?? ''); } };
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

const root = mkdtempSync(join(tmpdir(), 'nodegx-studio-blank-'));
process.env.NODEGX_BACKENDS_DIR = join(root, 'backends'); // nothing is written to ~/.noodl
let backend = null, started = null;
try {
  const list = templates();
  ok(list[0]?.slug === 'blank' && list[0].available && !list[0].needsBackend, 'Blank app is first on the welcome screen, available, and needs no backend', list[0]);

  const dir = join(root, 'Swapshop');
  const made = await createFromTemplate('blank', dir);
  ok(made.dir === dir && made.backend?.status === 'none', 'it is made in the folder named, with no backend', made);
  const pj = json(join(dir, 'nodegx.project.json'));
  ok(pj.name === 'Swapshop' && pj.settings?.htmlTitle === 'Swapshop' && pj.settings?.bodyScroll === true, 'the project carries the folder\'s name, and scrolls', pj.settings);
  const app = json(join(dir, 'components/App/nodes.json'));
  const router = app.nodes.find((n) => n.type === 'Router');
  ok(router && pj.rootNodeId === router.id && router.parameters.pages.startPage === '/Pages/Home' && router.parameters.pages.routes.join() === '/Pages/Home', 'its root is a Router that starts at, and lists, Home', router?.parameters);
  const home = json(join(dir, 'components/Pages/Home/nodes.json'));
  const page = home.nodes.find((n) => n.type === 'Page');
  ok(page && home.visualRoots.join() === page.id, 'Home is built around a Page node', home.visualRoots);
  const lengths = home.nodes.flatMap((n) => Object.entries(n.parameters || {}).filter(([k]) => /^(padding|margin|fontSize|rowGap)/.test(k)).map(([, v]) => v));
  ok(lengths.length && lengths.every((v) => v && typeof v === 'object' && typeof v.value === 'number' && v.unit === 'px'), 'every length is a unit object, never a "48px" string', lengths);
  const reg = json(join(dir, 'components/_registry.json'));
  ok(Object.keys(reg.components).sort().join() === 'App,Pages/Home', 'the registry lists App and Pages/Home', Object.keys(reg.components));
  ok(json(join(dir, 'components/Pages/Home/component.json')).id === home.componentId && json(join(dir, 'components/App/component.json')).id === app.componentId, 'each component\'s files name the same id');

  const full = join(root, 'full');
  mkdirSync(full); writeFileSync(join(full, 'notes.txt'), 'mine');
  let refused = null;
  try { await createFromTemplate('blank', full); } catch (e) { refused = e.message; }
  ok(/already holds 1 item/.test(refused || '') && !existsSync(join(full, 'nodegx.project.json')), 'a folder that holds files is refused, and nothing is written into it', refused);

  // a type with a Choice, declared as Studio's field drawer writes it, then Data's Start a backend
  const file = join(dir, 'nodegx.project.json');
  const declared = json(file);
  const choices = ['Furniture', 'Books', 'Clothes', 'Electronics'];
  declared.metadata = { ...declared.metadata, dbCollections: [{ name: 'Listing', columns: [{ name: 'title', type: 'String' }, { name: 'category', type: 'String' }], checks: [{ field: 'category', oneOf: choices }] }] };
  writeFileSync(file, JSON.stringify(declared, null, 2));
  backend = await import('../lib/backend.mjs');
  started = await backend.provisionFor(dir);
  const token = await backend.adminTokenOf(started.id);
  const call = async (method, path, body) => {
    const r = await fetch(started.endpoint.replace(/\/$/, '') + path, { method, headers: { Authorization: `Bearer ${token}`, 'X-Parse-Master-Key': token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const table = (await call('GET', '/admin/schema')).json?.tables?.find((t) => t.name === 'Listing');
  ok(table?.checks?.some((c) => c.rule?.field === 'category' && c.rule.oneOf?.join() === choices.join()) && !started.warnings.length, 'Start a backend: the table carries the Choice the project declares', { checks: table?.checks, warnings: started.warnings });
  const bad = await call('POST', '/classes/Listing', { title: 'A car', category: 'Cars' });
  const good = await call('POST', '/classes/Listing', { title: 'A chair', category: 'Furniture' });
  ok(bad.status === 400 && bad.json?.reason === 'check-failed' && good.status === 201, 'and the backend refuses a value the Choice does not list, and takes one it does', { bad, good: good.status });
} finally {
  if (started) await backend.stop(started.id).catch(() => {});
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
