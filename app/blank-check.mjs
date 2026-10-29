/**
 * The welcome screen's Blank app (lib/blank.mjs through app/actions.mjs createFromTemplate('blank')): a project that opens,
 * named after its folder, its Router listing the one Home page, every length written as the format's unit object (a "48px"
 * string is dropped by the runtime, and Studio says so over the page); a folder that holds files is refused.
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
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
