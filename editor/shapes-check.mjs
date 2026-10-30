/**
 * NodeGX Studio — what another writer leaves in the project, read as Studio reads its own.
 *
 * 1. A declared rule for values, in either of the two shapes a project file holds it (P123-STU-TWOSHAPES).
 *
 * `metadata.dbCollections[].checks` is Studio's shape (`{ field, oneOf }`) when Studio or the agent wrote it, and the
 * backend's entry (`{ name, rule, declared }`) when the NodeGX editor or provision_backend cached it. Studio read only
 * the first: with the second, Start a backend was refused ("checks[0]: expected …"), so the backend took any value, and
 * Data types showed the Choice as Text, with or without a backend.
 *
 * First on fixtures (no browser): data.mjs's declaredRules reads both and drops the backend's undeclared drift.
 * Then for each shape, a copy of NodeGX's todo-list template declaring Task.status as a Choice (open, done): Studio's
 * Start a backend (POST /api/backend-provision) sets the rule on the backend; Data types reads the field as a Choice
 * with its values; adding a value through the field's drawer leaves the project file one rule for the field, in
 * Studio's shape, and the backend the same. Assertions read the backend's admin API and the project file.
 *
 * 2. An option set the agent made (P128-S2-OPTSETSHAPE): NodeGX's MCP server, started on a copy as an agent's client
 * starts it, writes the published example's `/Option sets/Languages` with `create_component` (`{ Label, Value }` rows,
 * the fields a Dropdown reads, and no `metadata.optionSet`). Data → Option sets shows its columns and options, not one
 * blank `display`, and a Choice takes its values from it.
 *
 * 3. An option set Studio makes (Richard, 2026-10-30: Label + Value): New option set, two options typed in Studio; the
 * file holds `{ Label }` rows under the columns Label and Value, and the example's page, placed by the agent on that
 * set, draws a Dropdown whose options are the two labels (read in the running app's frame).
 *
 * 4. A Choice taken from an option set (P123-GH-OPTSETCHOICE, Richard 2026-10-30: a record stores the option's Value):
 * Task.language from Languages holds `en`, `fr`; the backend takes `fr` (what the Dropdown sends) and refuses
 * `Français`; App data and Data types show the labels; a Value changed in Option sets, with a row holding the old one,
 * asks first, then moves the row, the rule (project file and backend) and the set; a held option is not removed.
 *
 * 5. An option set that points at another (STU-094, Richard's Greenhouse note 5): Languages' `size` is an option of
 * Sizes and `sizes` a list of them, picked in its table and held as Sizes' Values; a Value changed in Sizes moves them,
 * an option they hold is not removed. Then ⚡ on a page reads the first Task's language through Languages, and on
 * through Sizes ("a task's language's size's Label", P123-GH-CHOICELABEL): one Function node, and the running app
 * shows Large.
 *
 *   node editor/shapes-check.mjs          PASS n/n and exit 0, or the failing lines and exit 1
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { declaredRules } from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.NODEGX_REPO ? process.env.NODEGX_REPO : join(here, '..', '..', 'OpenNoodl');
const { kit } = await import('../lib/nodegx.mjs');
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((done) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => done(p)); }); });

/** One tool call as an agent makes it: NodeGX's MCP server started on the project as an agent's client starts it. */
async function asAgent(project, name, args) {
  const mcp = spawn(process.execPath, [kit.mcpServer, project, '--allow-writes'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NODEGX_NO_UPDATE_CHECK: '1' } });
  let buf = '', id = 0;
  const waiting = new Map();
  mcp.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); waiting.get(m.id)?.(m); } catch { /* not a message */ } } });
  const rpc = (method, params) => new Promise((done, no) => { const n = ++id; const t = setTimeout(() => no(new Error(`${method}: no answer in 30 s`)), 30000); waiting.set(n, (m) => { clearTimeout(t); done(m); }); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  try {
    await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nodegx-studio-check', version: '0' } });
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return await rpc('tools/call', { name, arguments: args });
  } finally { mcp.kill(); }
}

const tmp = mkdtempSync(join(tmpdir(), 'studio-shapes-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // the server inherits it: nothing is written to ~/.noodl
const rule = { field: 'status', oneOf: ['open', 'done'] };
const SHAPES = {
  'Studio\'s': [rule],
  'the backend\'s': [{ name: 'chk_Task_oneof_status', rule, declared: true }, { name: 'drift', rule: { field: 'title', maxLength: 3 }, declared: false }]
};

console.log('check: declaredRules, on fixtures');
ok(JSON.stringify(declaredRules(SHAPES['Studio\'s'])) === JSON.stringify([rule]), 'Studio\'s shape reads as it is');
ok(JSON.stringify(declaredRules(SHAPES['the backend\'s'])) === JSON.stringify([rule]), 'the backend\'s shape reads as its rule, and its undeclared drift is no rule');
ok(declaredRules(undefined).length === 0 && declaredRules([null]).length === 0, 'no checks, or a hole, is no rule');

let b;
const children = [];
try {
  for (const [shape, checks] of Object.entries(SHAPES)) {
    console.log(`check: Task.status declared as a Choice in ${shape} shape`);
    const project = join(tmp, `todo-${Object.keys(SHAPES).indexOf(shape)}`);
    cpSync(join(kit.templates, 'todo-list'), project, { recursive: true });
    const pf = join(project, 'nodegx.project.json');
    const pj = () => JSON.parse(readFileSync(pf, 'utf8'));
    const start = pj();
    start.metadata.dbCollections = [{ name: 'Task', columns: [{ name: 'title', type: 'String' }, { name: 'status', type: 'String' }], checks }];
    writeFileSync(pf, JSON.stringify(start, null, 2));

    const port = await freePort();
    const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(server);
    let log = '';
    server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
    for (let i = 0; i < 100 && !log.includes('nodegx-studio: http'); i++) await wait(100);
    const url = `http://127.0.0.1:${port}/`;

    const made = await (await fetch(url + 'api/backend-provision', { method: 'POST' })).json();
    const bind = pj().metadata.cloudservices;
    const token = JSON.parse(readFileSync(join(process.env.NODEGX_BACKENDS_DIR, bind.instanceId, 'secrets.json'), 'utf8')).adminToken;
    const backendRules = async () => (await (await fetch(`${made.endpoint.replace(/\/$/, '')}/admin/schema`, { headers: { Authorization: `Bearer ${token}` } })).json()).tables?.find((t) => t.name === 'Task')?.checks?.map((c) => c.rule) ?? [];
    const set = await backendRules();
    ok(made.phase === 'running' && set.some((r) => r.field === 'status' && r.oneOf?.join() === 'open,done') && !(made.warnings ?? []).some((w) => /rules for its values were not set/.test(w)), 'Start a backend sets the Choice\'s values on the backend', { checks: set, warnings: made.warnings });
    ok(!set.some((r) => r.maxLength === 3), 'and not the backend\'s undeclared drift', set);

    b = await browser({ port: await freePort(), width: 1400, height: 900 });
    await b.goto(url);
    await b.waitTitle((t) => t.startsWith('ready'), 90000);
    await wait(800);
    await b.evaluate(`document.querySelector('[data-tab=data]').click()`); await wait(800);
    await b.until(`!!document.querySelector('#types .row[data-type="Task"]')`, 10000);
    await b.evaluate(`document.querySelector('#types .row[data-type="Task"]').click()`); await wait(800);
    const row = () => b.evaluate(`[...document.querySelectorAll('#datamain tr[data-field=status] td')].map(t => t.textContent.trim()).join(' | ')`);
    const before = await row();
    ok(/Choice/.test(before) && /open, done/.test(before), 'Data types reads it as a Choice with its values', before);

    await b.evaluate(`document.querySelector('#datamain tr[data-field=status] button[title="Change this field"]').click()`);
    const drawer = await b.until(`!!document.querySelector('#drawer:not([hidden]) [data-input=values]')`, 6000);
    ok(drawer, 'its drawer opens on the Choice\'s values');
    if (drawer) {
      await b.evaluate(`(() => { const v = document.querySelector('#drawer [data-input=values]'); v.value = 'open\\ndone\\nlater'; v.dispatchEvent(new Event('input')); })()`);
      await wait(200);
      await b.evaluate(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`);
      await b.until(`document.getElementById('drawer').hidden`, 8000); await wait(600);
      const file = pj().metadata.dbCollections.find((c) => c.name === 'Task').checks;
      ok(JSON.stringify(file) === JSON.stringify([{ field: 'status', oneOf: ['open', 'done', 'later'] }]), 'adding a value leaves the file one rule for the field, in Studio\'s shape (no stale entry beside it)', file);
      const after = await backendRules();
      ok(after.some((r) => r.field === 'status' && r.oneOf?.join() === 'open,done,later'), 'and the backend has the new values', after);
    }
    await b.close(); b = null;
    server.kill('SIGTERM'); await wait(1500); // the server stops the backends it started on SIGTERM
  }

  console.log('check: an option set the agent made');
  const project = join(tmp, 'todo-agent');
  cpSync(join(kit.templates, 'todo-list'), project, { recursive: true });
  const pf = join(project, 'nodegx.project.json');
  const start = JSON.parse(readFileSync(pf, 'utf8'));
  start.metadata.dbCollections = [{ name: 'Task', columns: [{ name: 'title', type: 'String' }] }];
  writeFileSync(pf, JSON.stringify(start, null, 2));
  // section 5's page reads the first Task with nobody signed in: the template lets only someone signed in read one
  const security = JSON.parse(readFileSync(join(project, 'nodegx.security.json'), 'utf8'));
  Object.assign(security.collections.Task.permissions, { find: 'public', get: 'public' });
  writeFileSync(join(project, 'nodegx.security.json'), JSON.stringify(security, null, 2));
  const example = JSON.parse(readFileSync(join(repo, 'docs/node-catalog/examples/option-set.json'), 'utf8')).components[0];
  const made = await asAgent(project, 'create_component', { path: example.name, type: 'logic', nodes: example.nodes, connections: example.connections });
  ok(!made.result?.isError && !made.error, 'the agent writes the example\'s option set', made.result?.content?.[0]?.text?.slice(0, 160));

  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(server);
  let log = '';
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('nodegx-studio: http'); i++) await wait(100);
  const url = `http://127.0.0.1:${port}/`;
  await fetch(url + 'api/backend-provision', { method: 'POST' }); // a new field is made on the backend too
  b = await browser({ port: await freePort(), width: 1400, height: 900 });
  await b.goto(url);
  await b.waitTitle((t) => t.startsWith('ready'), 90000);
  await wait(800);
  await b.evaluate(`document.querySelector('[data-tab=data]').click()`); await wait(500);
  await b.evaluate(`document.querySelector('[data-sub=options]').click()`); await wait(500);
  await b.until(`[...document.querySelectorAll('#optsets .row')].some((r) => r.textContent.includes('Languages'))`, 8000);
  await b.evaluate(`[...document.querySelectorAll('#optsets .row')].find((r) => r.textContent.includes('Languages')).click()`); await wait(500);
  const grid = await b.evaluate(`(() => { const t = [...document.querySelectorAll('#optmain table')]; const rows = [...t[1].querySelectorAll('tr')].slice(1); return { header: [...t[1].querySelectorAll('th')].map((th) => th.textContent).filter(Boolean), rows: rows.map((r) => [...r.querySelectorAll('input')].map((i) => i.value)) }; })()`);
  ok(grid.header.join() === 'Label,Value' && JSON.stringify(grid.rows) === JSON.stringify([['English', 'en'], ['Français', 'fr']]), 'Option sets shows its columns, Label and Value, and its two options', grid);
  await b.evaluate(`document.querySelector('[data-sub=types]').click()`); await wait(500);
  await b.until(`!!document.querySelector('#types .row[data-type="Task"]')`, 8000);
  await b.evaluate(`document.querySelector('#types .row[data-type="Task"]').click()`); await wait(600);
  await b.evaluate(`[...document.querySelectorAll('#datamain .bar button')].find(e => e.textContent.includes('New field')).click()`);
  await b.until(`!!document.querySelector('#drawer:not([hidden]) .kinds')`, 6000);
  await b.evaluate(`document.querySelector('#drawer .kinds [data-kind=choice]').click()`); await wait(300);
  const choices = await b.evaluate(`(() => { const sel = [...document.querySelectorAll('#drawer label.f')].find((l) => l.textContent.startsWith('Take the choices'))?.querySelector('select'); const o = sel && [...sel.options].find((x) => x.textContent.includes('Languages')); if (!o) return null; sel.value = o.value; sel.dispatchEvent(new Event('change')); return document.querySelector('#drawer [data-input=values]').value; })()`);
  // P123-GH-OPTSETCHOICE (Richard, 2026-10-30): a record stores the option's Value, which a Dropdown of the set sends
  ok(choices === 'en\nfr', 'a Choice takes its choices from it as its options\' Values', choices);
  await b.evaluate(`document.querySelector('#drawer .dfoot button')?.click()`); await wait(300); // Cancel

  console.log('check: an option set Studio made, in a Dropdown');
  await b.evaluate(`document.querySelector('[data-sub=options]').click()`); await wait(400);
  await b.evaluate(`document.getElementById('newoptset').click()`);
  if (!(await b.until(`!!document.querySelector('.ask [data-input=askname]')`, 4000))) throw new Error('no name asked for the option set');
  await b.evaluate(`document.querySelector('.ask [data-input=askname]').focus()`); await b.type('Sizes'); await b.key('Enter', 'Enter', 13);
  await b.until(`!!document.querySelector('#optmain input[placeholder^="New option"]')`, 8000);
  for (const name of ['Small', 'Large']) { await b.evaluate(`(() => { const i = document.querySelector('#optmain input[placeholder^="New option"]'); i.focus(); i.value = ''; })()`); await b.type(name); await b.key('Enter', 'Enter', 13); await wait(700); }
  const setDir = join(project, 'components', 'Option sets', 'Sizes');
  const rows = JSON.parse(JSON.parse(readFileSync(join(setDir, 'nodes.json'), 'utf8')).nodes.find((n) => n.type === 'Static Data').parameters.json);
  const columns = JSON.parse(readFileSync(join(setDir, 'component.json'), 'utf8')).metadata?.optionSet?.attributes?.map((a) => a.name);
  ok(JSON.stringify(rows) === JSON.stringify([{ Label: 'Small' }, { Label: 'Large' }]) && columns?.join() === 'Label,Value', 'a set made in Studio has the columns Label and Value, and its options are Label rows', { rows, columns });
  const page = JSON.parse(readFileSync(join(repo, 'docs/node-catalog/examples/option-set.json'), 'utf8')).components[1];
  const nodes = page.nodes.map((n) => (n.type === '/Option sets/Languages' ? { ...n, type: '/Option sets/Sizes' } : n.type === 'Page' ? { ...n, parameters: { ...n.parameters, title: 'Sizes', urlPath: 'sizes' } } : n));
  const placed = await asAgent(project, 'create_component', { path: '/Pages/Sizes', type: 'page', nodes, connections: page.connections });
  ok(!placed.result?.isError && !placed.error, 'the agent places the example\'s page on that set', placed.result?.content?.[0]?.text?.slice(0, 160));
  await b.until(`[...document.getElementById('pagepick').options].some((o) => o.value === 'Pages/Sizes')`, 15000);
  await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sizes'; s.dispatchEvent(new Event('change')); })()`);
  const drawn = await b.until(`(() => { try { const o = [...__ob.preview.frame.contentDocument.querySelectorAll('select option')].map((x) => x.textContent).filter((t) => t && !/^Choose/.test(t)); return o.length ? o : false; } catch { return false; } })()`, 15000);
  ok(JSON.stringify(drawn) === JSON.stringify(['Small', 'Large']), 'its Dropdown, in the running app, offers Small and Large', drawn);

  console.log('check: a Choice from an option set holds its Values');
  {
    const rules = () => declaredRules(JSON.parse(readFileSync(pf, 'utf8')).metadata.dbCollections.find((c) => c.name === 'Task').checks).find((r) => r.field === 'language')?.oneOf?.join();
    const token = JSON.parse(readFileSync(join(process.env.NODEGX_BACKENDS_DIR, JSON.parse(readFileSync(pf, 'utf8')).metadata.cloudservices.instanceId, 'secrets.json'), 'utf8')).adminToken;
    const endpoint = JSON.parse(readFileSync(pf, 'utf8')).metadata.cloudservices.endpoint.replace(/\/$/, '');
    const onBackend = async () => (await (await fetch(`${endpoint}/admin/schema`, { headers: { Authorization: `Bearer ${token}` } })).json()).tables?.find((t) => t.name === 'Task')?.checks?.map((c) => c.rule).find((r) => r.field === 'language')?.oneOf?.join();
    await b.evaluate(`document.querySelector('[data-tab=data]').click()`); await wait(600);
    await b.evaluate(`document.querySelector('[data-sub=types]').click()`); await wait(500);
    await b.evaluate(`document.querySelector('#types .row[data-type="Task"]').click()`); await wait(600);
    await b.evaluate(`[...document.querySelectorAll('#datamain .bar button')].find(e => e.textContent.includes('New field')).click()`);
    await b.until(`!!document.querySelector('#drawer:not([hidden]) .kinds')`, 6000);
    await b.evaluate(`document.querySelector('#drawer .kinds [data-kind=choice]').click()`); await wait(300);
    await b.evaluate(`(() => { const i = document.querySelector('#drawer [data-input=name]'); i.value = 'language'; i.dispatchEvent(new Event('input')); const s = document.querySelector('#drawer [data-input=fromset]'); s.value = [...s.options].find((o) => o.textContent.includes('Languages')).value; s.dispatchEvent(new Event('change')); })()`); await wait(300);
    const note = await b.evaluate(`[...document.querySelectorAll('#drawer .note')].map((n) => n.textContent).find((t) => /Value/.test(t)) ?? null`);
    await b.evaluate(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`);
    await b.until(`document.getElementById('drawer').hidden`, 8000); await wait(800);
    ok(rules() === 'en,fr' && (await onBackend()) === 'en,fr' && /Dropdown of Languages sends/.test(note || ''), 'Task.language, its choices from Languages, is one of en, fr in the project file and on the backend, and the drawer says why', { file: rules(), backend: await onBackend(), note });
    const put = async (v) => (await fetch(url + 'api/backend/classes/Task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `probe ${v}`, language: v }) })).status;
    const sent = await put('fr'), label = await put('Français');
    ok(sent < 300 && label >= 400, 'the backend takes fr, what a Dropdown of Languages sends, and refuses the label Français', { sent, label });
    const details = await b.evaluate(`document.querySelector('#datamain tr[data-field=language] td.note')?.textContent`);
    ok(/^from Languages: English, Français/.test(details || ''), 'Data types says the field is from Languages, by its labels', details);
    await b.evaluate(`document.querySelector('[data-sub=app]').click()`); await wait(500);
    await b.until(`!!document.querySelector('#apptypes .row[data-type=Task]')`, 6000);
    await b.evaluate(`document.querySelector('#apptypes .row[data-type=Task]').click()`);
    const cell = await b.until(`(() => [...document.querySelectorAll('#appmain tr[data-row] td[data-field=language]')].map((td) => td.textContent).find(Boolean) || false)()`, 8000);
    ok(cell === 'Français', 'App data shows the stored fr as Français', cell);
    await b.evaluate(`document.querySelector('[data-sub=options]').click()`); await wait(400);
    await b.evaluate(`[...document.querySelectorAll('#optsets .row')].find((r) => r.textContent.includes('Languages')).click()`); await wait(500);
    const setRows = () => JSON.parse(JSON.parse(readFileSync(join(project, 'components', 'Option sets', 'Languages', 'nodes.json'), 'utf8')).nodes.find((n) => n.type === 'Static Data').parameters.json).map((o) => o.Value).join();
    const held = async () => (await (await fetch(url + 'api/backend/classes/Task?keys=language&limit=50')).json()).results.map((r) => r.language).filter(Boolean).join();
    const editFr = (v) => b.evaluate(`(() => { const t = [...document.querySelectorAll('#optmain table')][1]; const i = [...t.querySelectorAll('tr')][2].querySelectorAll('input')[1]; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('change')); })()`);
    const asked = () => b.until(`document.querySelector('.surescrim')?.textContent || false`, 8000);
    await editFr('fra');
    const ask = await asked();
    await b.evaluate(`document.querySelector('.surescrim [data-act=no]').click()`); await wait(800);
    ok(/1 record of Task with language fr/.test(ask || '') && setRows() === 'en,fr' && rules() === 'en,fr' && (await held()) === 'fr', 'fr\'s Value changed to fra while a Task holds fr: Studio asks first, and Cancel changes nothing', { ask, set: setRows(), file: rules(), held: await held() });
    await b.evaluate(`[...document.querySelectorAll('#optsets .row')].find((r) => r.textContent.includes('Languages')).click()`); await wait(500);
    await editFr('fra'); await asked();
    await b.evaluate(`document.querySelector('.surescrim [data-act=yes]').click()`);
    let moved = null; for (let i = 0; i < 40 && setRows() !== 'en,fra'; i++) await wait(200);
    moved = await onBackend();
    ok(setRows() === 'en,fra' && rules() === 'en,fra' && moved === 'en,fra' && (await held()) === 'fra', 'and Change them moves the Task to fra, the rule (project file and backend), then the set', { set: setRows(), file: rules(), backend: moved, held: await held() });
    await b.evaluate(`(() => { const t = [...document.querySelectorAll('#optmain table')][1]; [...t.querySelectorAll('tr')][2].querySelector('button.danger').click(); })()`); await wait(1500);
    const refused = await b.evaluate(`document.getElementById('toast').textContent`);
    ok(setRows() === 'en,fra' && rules() === 'en,fra' && /1 record of Task has language fra/.test(refused), 'removing Français while a Task holds fra is refused in words, and the set keeps it', { set: setRows(), file: rules(), refused });
  }

  console.log('check: an option set that points at another (STU-094)');
  {
    const setFile = (name) => { const dir = join(project, 'components', 'Option sets', name); return { rows: JSON.parse(JSON.parse(readFileSync(join(dir, 'nodes.json'), 'utf8')).nodes.find((n) => n.type === 'Static Data').parameters.json), attrs: JSON.parse(readFileSync(join(dir, 'component.json'), 'utf8')).metadata?.optionSet?.attributes } };
    const openSet = async (name) => { await b.evaluate(`[...document.querySelectorAll('#optsets .row')].find((r) => r.textContent.includes(${JSON.stringify(name)})).click()`); await wait(500); };
    const inRow = (row, sel) => `[...[...document.querySelectorAll('#optmain table')][1].querySelectorAll('tr')][${row}].querySelector(${JSON.stringify(sel)})`;
    const choose = (sel, v) => b.evaluate(`(() => { const s = ${sel}; s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); })()`);
    const settle = async (cond) => { for (let i = 0; i < 40 && !cond(); i++) await wait(200); };
    const newAttr = async (name) => {
      await b.evaluate(`[...document.querySelectorAll('#optmain .bar button')].find((x) => x.textContent.includes('New attribute')).click()`);
      await b.until(`!!document.querySelector('.ask [data-input=askname]')`, 4000);
      await b.evaluate(`document.querySelector('.ask [data-input=askname]').focus()`); await b.type(name); await b.key('Enter', 'Enter', 13); await wait(800);
    };
    await b.evaluate(`document.querySelector('[data-sub=options]').click()`); await wait(400);
    await openSet('Sizes');
    for (const [row, v] of [[1, 's'], [2, 'l']]) { await b.evaluate(`(() => { const i = ${inRow(row, 'td[data-attr=Value] input')}; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('change')); })()`); await wait(800); }
    ok(setFile('Sizes').rows.map((o) => o.Value).join() === 's,l', 'Sizes is given Values: Small s, Large l', setFile('Sizes').rows);
    await openSet('Languages');
    await newAttr('size');
    const offered = await b.evaluate(`[...document.querySelector('#optmain select[data-attrtype=size]').options].map((o) => o.textContent)`);
    ok(offered.includes('an option of Sizes') && offered.includes('a list of options of Sizes') && !offered.some((t) => /of Languages/.test(t)), 'a new attribute of Languages can be an option, or a list of options, of another set (not of itself)', offered);
    await choose(`document.querySelector('#optmain select[data-attrtype=size]')`, 'option:Option sets/Sizes'); await wait(800);
    await choose(inRow(1, 'select[data-link=size]'), 'l'); await wait(800);
    await newAttr('sizes');
    await choose(`document.querySelector('#optmain select[data-attrtype=sizes]')`, 'options:Option sets/Sizes'); await wait(800);
    for (const v of ['s', 'l']) { await choose(inRow(2, '[data-link=sizes] select.add'), v); await wait(800); }
    let lang = setFile('Languages');
    ok(JSON.stringify(lang.attrs.filter((a) => a.of)) === JSON.stringify([{ name: 'size', type: 'option', of: 'Option sets/Sizes' }, { name: 'sizes', type: 'options', of: 'Option sets/Sizes' }]) && lang.rows[0].size === 'l' && JSON.stringify(lang.rows[1].sizes) === '["s","l"]',
      'picked in the table, English\'s size holds Large\'s Value l and Français\'s sizes the list s, l; the attributes name the set they point at', lang);
    const shown = await b.evaluate(`({ one: (() => { const s = ${inRow(1, 'select[data-link=size]')}; return s.options[s.selectedIndex].textContent; })(), list: [...${inRow(2, '[data-link=sizes]')}.querySelectorAll('.chip')].map((c) => c.textContent) })`);
    ok(shown.one === 'Large' && shown.list.join() === 'Small,Large', 'the table shows them by their labels', shown);
    await openSet('Sizes');
    await b.evaluate(`(() => { const i = ${inRow(2, 'td[data-attr=Value] input')}; i.value = 'xl'; i.dispatchEvent(new Event('change')); })()`);
    await settle(() => setFile('Languages').rows[0].size === 'xl');
    const followed = await b.evaluate(`document.getElementById('toast').textContent`);
    lang = setFile('Languages');
    ok(setFile('Sizes').rows[1].Value === 'xl' && lang.rows[0].size === 'xl' && JSON.stringify(lang.rows[1].sizes) === '["s","xl"]' && /Languages's size, sizes follows Sizes/.test(followed), 'Large\'s Value changed to xl: English\'s size and Français\'s sizes follow it, and Studio says so', { sizes: setFile('Sizes').rows, rows: lang.rows, followed });
    await b.evaluate(`${inRow(2, 'button.danger')}.click()`); await wait(1200);
    const refused = await b.evaluate(`document.getElementById('toast').textContent`);
    ok(setFile('Sizes').rows.length === 2 && /English in Languages \(its size\), Français in Languages \(its sizes\) hold Large/.test(refused), 'removing Large while Languages\' options hold it is refused in words, and Sizes keeps it', { rows: setFile('Sizes').rows, refused });

    console.log('check: ⚡ reads a Choice through its set, and on through a set it points at (STU-094, P123-GH-CHOICELABEL)');
    const posted = await fetch(url + 'api/backend/classes/Task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'A first task', language: 'en' }) });
    ok(posted.status < 300, 'a Task in English is on the backend', posted.status);
    const clickText = async (sel, text) => { const at = await b.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`); if (!at) throw new Error(`nothing to click: ${sel} "${text}"`); await b.click(at.x, at.y); await wait(250); };
    const setIn = async (sel, value, event = 'input') => { await b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)})); })()`); await wait(event === 'input' ? 800 : 500); };
    await b.evaluate(`document.querySelector('[data-tab=design]').click()`); await wait(600);
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sizes'; s.dispatchEvent(new Event('change')); })()`); await wait(1500);
    await b.clickSel('#newpagedata');
    await b.until('document.querySelector(".menu.newitem")', 4000);
    await setIn('.menu.newitem input[aria-label=Name]', 'a task');
    await setIn('.menu.newitem select[aria-label=Type]', 'Task', 'change');
    await clickText('.menu.newitem .seg button', 'The first one'); await wait(200);
    const button = await b.evaluate(`document.querySelector('.menu.newitem .foot .primary').textContent`);
    await clickText('.menu.newitem .foot button', button); await wait(1000);
    await clickText('#right .pageitem button', 'Sort by'); await wait(500);
    await setIn('#right .pageitem .cond.sort input', 'title');
    const at = await b.until(`(() => { const el = __ob.preview.elementsOf('prompt')[0]; if (!el || !el.getBoundingClientRect().height) return false; const r = el.getBoundingClientRect(); const o = document.getElementById('overlay').getBoundingClientRect(); return { x: Math.round(o.left + r.left + r.width / 2), y: Math.round(o.top + r.top + r.height / 2) }; })()`, 15000);
    if (!at) throw new Error('the Sizes page has no prompt Text on screen');
    const textField = `[...document.querySelectorAll('#right .field')].some((f) => f.querySelector('label')?.textContent === 'Text')`;
    for (let i = 0; i < 3 && !(await b.evaluate(textField)); i++) { await b.click(at.x, at.y); await b.until(textField, 3000); }
    const bolt = await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Text'); const btn = f?.querySelector('.bolt'); if (!btn) return null; btn.scrollIntoView({ block: 'nearest' }); const r = btn.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!bolt) throw new Error('no ⚡ on the prompt\'s Text');
    await b.click(bolt.x, bolt.y);
    await b.until(`document.querySelectorAll('.menu .item').length > 0`, 4000);
    const items = await b.evaluate(`[...document.querySelectorAll('.menu .item')].map((e) => e.textContent)`);
    const want = "a task's language's size's Label";
    ok(items.some((t) => t.startsWith("a task's language's Label")) && items.some((t) => t.startsWith(want)), 'the ⚡ menu offers the first Task\'s language by its Label, and its size\'s Label', items.filter((t) => t.startsWith("a task's language")));
    const n0 = await b.evaluate('__ob.shows || 0');
    await clickText('.menu .item', want);
    await b.until(`(__ob.shows || 0) > ${n0} && document.getElementById("status").textContent.startsWith("App on screen")`, 30000);
    const page = JSON.parse(readFileSync(join(project, 'components', 'Pages', 'Sizes', 'nodes.json'), 'utf8')).nodes;
    const wires = JSON.parse(readFileSync(join(project, 'components', 'Pages', 'Sizes', 'connections.json'), 'utf8')).connections;
    const fn = page.find((n) => n.metadata?.optionRead);
    const into = (port) => wires.find((c) => c.toId === fn?.id && c.toProperty === port);
    const typeOf = (id) => page.find((n) => n.id === id)?.type;
    ok(fn?.type === 'JavaScriptFunction' && into('in-value')?.fromProperty === 'prop-language' && typeOf(into('in-set0')?.fromId) === '/Option sets/Languages' && typeOf(into('in-set1')?.fromId) === '/Option sets/Sizes' && wires.some((c) => c.fromId === fn.id && c.fromProperty === 'out-result' && c.toId === 'prompt' && c.toProperty === 'text'),
      'one Function node reads it: the record\'s language in, Languages and Sizes beside it, its result into the Text', { fn: fn && { type: fn.type, label: fn.label }, value: into('in-value'), set0: typeOf(into('in-set0')?.fromId), set1: typeOf(into('in-set1')?.fromId) });
    const onScreen = await b.until(`(() => { const t = __ob.preview.elementsOf('prompt')[0]?.innerText.trim(); return t === 'Large' ? t : false; })()`, 15000);
    ok(onScreen === 'Large', 'the running app shows Large: A first task\'s language en, English\'s size xl, its Label', onScreen || await b.evaluate(`(() => { const w = __ob.preview.frame.contentWindow; const objs = Object.values(w.Noodl?.Objects ?? {}).filter((o) => o && o.title !== undefined).map((o) => ({ title: o.title, language: o.language })); return { text: __ob.preview.elementsOf('prompt')[0]?.innerText, status: document.getElementById('status').textContent, row: document.querySelector('#pagedata .row[data-item]')?.innerText, requests: (w.__studioLog || []).filter((r) => /Task/.test(r.url || '')).map((r) => [r.status, r.rows, r.body && String(r.body).slice(0, 200)]), objs }; })()`));
    const chip = await b.evaluate(`[...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Text')?.querySelector('.chip')?.textContent`);
    ok(chip === want, 'the Text field says where its words come from in the same words', chip);
  }
} catch (err) {
  ok(false, `the gate stopped: ${err.stack || err.message}`);
} finally {
  await b?.close();
  for (const c of children) c.kill('SIGTERM');
  await wait(1500);
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
