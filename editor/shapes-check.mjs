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
  ok(choices === 'English\nFrançais', 'a Choice takes its values from it', choices);
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
