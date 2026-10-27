/**
 * NodeGX Studio — Data's gate (M6: STU-060, 061, 063, 064, 065). A copy of NodeGX's todo-list template, its backend
 * started by Studio's own "Start a backend" (under a backends folder of the gate's own), the editor driven in headless
 * Chrome. Every assertion reads the running backends' admin API, the project's files or the page's table — never the
 * Data tab's own claim.
 *
 *   1. the map is Data's: four rail tabs; a type says who can reach it in the map's words, and opens the map on itself
 *   2. a type and its fields are made on the development backend and in the project together: a Choice is a String
 *      with the backend's one-of check, a Link a Pointer at its type; a rename takes the check with it; a kind change
 *      converts; a delete drops the column
 *   3. a field added outside Studio (as Claude Code would) is named as drift, and declared from the card; a Required the
 *      project and the backend disagree on is drift too, agreed either way (the backend's way only once no row is empty)
 *   4. App data: 120 rows paged 50 at a time with the count, a search, a Choice edited through its select, an import
 *      checked first, rows deleted together; the importer's backend/data/ files checked and loaded
 *   5. Privacy: a type made readable by anyone, through the map: the backend lets someone not signed in find it, and
 *      nodegx.security.json says the same
 *   6. live: made from Data; development's types and rules reach it; its rules hold on this computer; a new field
 *      reaches it only through Deploy to live; a field development dropped is lost on live only after the yes; rows
 *      copied after a dry run
 *   7. STU-062, a rename follows the app: rename.mjs over the todo template; then the todo app's Task.closingNote
 *      renamed in Studio, with the code that reads it ticked — the backend keeps the values, every Record node and
 *      the ticked code follow, validate_project finds no error and the app still shows its rows; then, with live there,
 *      a field and a type renamed in development reach live through Deploy to live as renames, live's rows kept
 *   8. Required on a stored field: refused while rows have nothing in it, those rows shown in App data, then made so on
 *      the backend and in the project; on live through Deploy to live, held while live has rows without it
 *   9. App data's User: the people with an account, through the backend's Users API — the one who signed up in the
 *      app, a field of the app's own and a yes / no changed, a person added who can then sign in, and deleted
 *
 *   node editor/data-check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node editor/data-check.mjs --shots    also writes ../docs/look/stu-06x-*.png
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { typesOf, driftOf, toWire, searchWhere, cellWords } from './data.mjs';
import { fieldReaders, typeReaders, renameField, renameType, fieldMentions, appFields } from './rename.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.argv.includes('--shots');
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-data-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // the server inherits it: nothing is written to ~/.noodl
const { kit } = await import('../lib/nodegx.mjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const project = join(tmp, 'todo-list');
cpSync(join(kit.templates, 'todo-list'), project, { recursive: true });
// the importer's data files, as import/data-to-nodegx.mjs writes them from a Bubble app's Data tab exports
mkdirSync(join(project, 'backend', 'data'), { recursive: true });
writeFileSync(join(project, 'backend', 'data', 'Task.json'), JSON.stringify({ format: 'nodegx-collection', version: 1, collection: 'Task', schema: { columns: [{ name: 'title', type: 'String' }, { name: 'position', type: 'Number' }] }, count: 3, records: [1, 2, 3].map((n) => ({ objectId: `1792241441972x12542533651485277${n}`, title: `imported ${n}`, position: n })) }, null, 2));
const pj = () => readJson(join(project, 'nodegx.project.json'));
const declared = (name) => pj().metadata?.dbCollections?.find((c) => c.name === name);

/** A backend of the project as its admin, from its binding and the secret its folder holds. */
function adminOf(key) {
  const binding = pj().metadata[key];
  const token = readJson(join(process.env.NODEGX_BACKENDS_DIR, binding.instanceId, 'secrets.json')).adminToken;
  const call = async (method, path, body, asAdmin = true) => {
    const headers = { 'X-Parse-Application-Id': binding.appId, 'Content-Type': 'application/json' };
    if (asAdmin) headers['X-Parse-Master-Key'] = token;
    const r = await fetch(binding.endpoint + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return {
    get: async (p) => (await call('GET', p)).json,
    post: async (p, b) => (await call('POST', p, b)).json,
    put: async (p, b) => (await call('PUT', p, b)).json,
    del: async (p) => (await call('DELETE', p)).json,
    anonymous: (method, p, b) => call(method, p, b, false),
    table: async (name) => ((await call('GET', '/admin/schema')).json.tables || []).find((t) => t.name === name),
    count: async (name) => (await call('GET', `/classes/${name}?count=1&limit=0`)).json.count
  };
}

/** NodeGX's own validator over the project (validate_project through the MCP server, over stdio). */
const mcpBuilt = existsSync(kit.mcpServer);
async function validate() {
  const proc = spawn(process.execPath, [kit.mcpServer, project], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = ''; const waiting = new Map(); let seq = 0;
  proc.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } } catch { /* a log line */ } } });
  const call = (method, params) => new Promise((done) => { const id = ++seq; waiting.set(id, done); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'studio-data-check', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  const r = await call('tools/call', { name: 'validate_project', arguments: {} });
  proc.kill();
  const text = (r.result?.content || []).map((c) => c.text || '').join('\n');
  return JSON.parse(text.replace(/^[^{]*/, '')).diagnostics || [];
}

console.log('check: data.mjs');
{
  const list = typesOf({ declared: [{ name: 'A', columns: [{ name: 'x', type: 'String' }] }], backend: [{ name: 'A', columns: [] }, { name: 'B', columns: [{ name: 'y', type: 'Number' }] }, { name: '_User', columns: [] }], used: new Map([['C', new Set(['z'])]]) });
  ok(list.map((t) => `${t.name}:${t.declared ? 'd' : ''}${t.onBackend ? 'b' : ''}${t.usedByApp ? 'u' : ''}`).join(' ') === 'A:db B:b C:u', 'every type once, with where it is; the backend\'s system tables left out', list.map((t) => t.name));
  const d = driftOf([{ name: 'a', type: 'String' }, { name: 'b', type: 'Number' }, { name: 'p', type: 'Pointer', targetClass: 'X' }], [{ name: 'b', type: 'String' }, { name: 'c', type: 'Date' }, { name: 'p', type: 'Pointer', targetClass: 'Y' }, { name: 'objectId', type: 'String' }]);
  ok(d.onlyProject.map((c) => c.name).join() === 'a' && d.onlyBackend.map((c) => c.name).join() === 'c' && d.retyped.map((r) => r.name).join() === 'b,p' && !d.none, 'drift: only the project, only the backend, and a different type (a Link\'s target counts)', { onlyProject: d.onlyProject, onlyBackend: d.onlyBackend, retyped: d.retyped.map((r) => r.name) });
  const r = driftOf([{ name: 'a', type: 'String', required: true }, { name: 'b', type: 'Number' }, { name: 'c', type: 'Date', required: true }], [{ name: 'a', type: 'String' }, { name: 'b', type: 'Number', required: true }, { name: 'c', type: 'String' }]);
  ok(r.required.map((x) => `${x.name}:${x.project}/${x.backend}`).join() === 'a:true/false,b:false/true' && driftOf([{ name: 'a', type: 'String', required: true }], [{ name: 'a', type: 'String', required: true }]).none, 'drift: a field required in one and not the other, either way (a retyped one is named as retyped only)', r.required);
  ok(toWire({ name: 'n', type: 'Number' }, '4.5').value === 4.5 && toWire({ name: 'n', type: 'Number' }, 'four').error && toWire({ name: 'b', type: 'Boolean' }, 'Yes').value === true && toWire({ name: 'd', type: 'Date' }, '2026-10-22T10:00').value.__type === 'Date' && toWire({ name: 'p', type: 'Pointer', targetClass: 'T' }, 'abc').value.className === 'T' && toWire({ name: 'x', type: 'String' }, '').value === null, 'a typed value goes to the backend in its own shape; a wrong one is refused in words; empty clears');
  ok(JSON.stringify(searchWhere([{ name: 'title', type: 'String' }, { name: 'n', type: 'Number' }], 'a.b')) === '{"$or":[{"title":{"$regex":"a\\\\.b","$options":"i"}}]}' && searchWhere([{ name: 'n', type: 'Number' }], 'x') === null, 'a search looks in the text fields only, the words taken literally');
  ok(cellWords({ type: 'Boolean' }, false) === 'No' && cellWords({ type: 'Pointer' }, { objectId: 'q1' }) === 'q1', 'a cell says Yes / No and a link\'s id');
}

console.log('check: rename.mjs');
const componentsOf = (dir) => {
  const reg = readJson(join(dir, 'components', '_registry.json')).components;
  return Object.entries(reg).map(([key, r]) => { const at = join(dir, 'components', r.path); return { key, files: { nodes: readJson(join(at, 'nodes.json')), connections: existsSync(join(at, 'connections.json')) ? readJson(join(at, 'connections.json')) : { connections: [] } } }; });
};
{
  const todo = componentsOf(join(kit.templates, 'todo-list'));
  ok([...(appFields(todo).get('Task') || [])].includes('closingNote'), 'the fields an app gives a type are read off its wires too (the todo app sets every field by wire)', [...(appFields(todo).get('Task') || [])]);
  const r = fieldReaders(todo, 'Task', 'closingNote');
  ok(r.filter((x) => x.sure).map((x) => x.key).sort().join() === 'Commands/Add task,Commands/Close task,Commands/Reopen task' && r.filter((x) => !x.sure).every((x) => x.kind === 'code'), 'Task.closingNote: the three Record nodes that set it are sure; the code that reads a closingNote is a maybe', r.map((x) => `${x.sure ? 'sure' : 'maybe'} ${x.key}: ${x.line || x.what}`));
  ok(r.filter((x) => x.key === 'Logic/Selected task').length === 1, 'a node\'s own port (Outputs.closingNote) is never taken for a record\'s field: one mention on that line, task.closingNote', r.filter((x) => x.key === 'Logic/Selected task').map((x) => x.line));
  // Richard's ruling, 2026-10-23: one tick for the maybes in code the type's rows are wired to (through component inputs and outputs)
  const dates = fieldReaders(todo, 'RoutineCheck', 'date').filter((x) => !x.sure), dated = dates.filter((x) => x.given);
  const viaChecks = (key) => { const f = todo.find((c) => c.key === key).files; const io = f.nodes.nodes.find((n) => n.type === 'Component Inputs'); return f.connections.connections.some((w) => w.fromId === io?.id && w.fromProperty === 'checks' && w.toProperty === 'in-checks'); };
  ok(dates.length > 200 && dated.map((x) => x.key).sort().join() === 'Logic/Selected routine,Logic/Today rows' && dated.every((x) => viaChecks(x.key)) && r.filter((x) => !x.sure).every((x) => x.given), 'given the rows: of RoutineCheck.date\'s ' + dates.length + ' maybes, the 2 in code the page wires its checks into; every one of Task.closingNote\'s', dated.map((x) => `${x.key}: ${x.line}`));
  const m = fieldMentions("a.title + b?.title + c['title'] + Inputs.title + 1.title + this.title + subtitle", 'title');
  ok(m.length === 3, 'code mentions: .F, ?.F and [\'F\'], not Inputs.F, this.F or a longer word', m);
  const picked = new Set(r.filter((x) => !x.sure).map((x) => x.id));
  const out = renameField(todo, 'Task', 'closingNote', 'closingWords', picked);
  const text = JSON.stringify([...out.changed.values()]);
  ok(out.count === r.length && !text.includes('prop-closingNote') && text.includes('prop-closingWords') && text.includes('Outputs.closingNote = String(task.closingWords'), 'renamed: the prop-closingNote wires become prop-closingWords, the ticked code reads closingWords, a port keeps its name', { count: out.count, changed: [...out.changed.keys()] });
  const none = renameField(todo, 'Task', 'closingNote', 'closingWords');
  ok(none.count === 3 && [...none.changed.keys()].every((k) => k.startsWith('Commands/')), 'nothing ticked: only the sure ones change, the code is left as it was', [...none.changed.keys()]);
  const sorted = renameField(todo, 'Task', 'position', 'rank').changed;
  ok(JSON.stringify([...sorted.values()]).includes('"property": "rank"') || JSON.stringify([...sorted.values()]).includes('"property":"rank"'), 'a query that sorts by the field sorts by the new name');
  const q = [{ key: 'P', files: { nodes: { nodes: [{ id: 'q', type: 'DbCollection2', parameters: { collectionName: 'T', visualFilter: { type: 'and', conditions: [{ field: 'a', operator: 'equalTo', value: 1 }, { type: 'or', conditions: [{ field: 'a' }, { field: 'b' }] }] } } }, { id: 'r', type: 'Model2', parameters: { properties: 'a,b' }, metadata: { pageDataRecord: { item: 'q' } } }, { id: 'x', type: 'Model2', parameters: { properties: 'a' } }] }, connections: { connections: [{ fromId: 'r', fromProperty: 'prop-a', toId: 'e', toProperty: 'value' }] } } }];
  const qr = fieldReaders(q, 'T', 'a');
  const qo = renameField(q, 'T', 'a', 'z').changed.get('P');
  ok(qr.filter((x) => x.sure).length === 2 && qr.find((x) => x.node === 'x')?.sure === false && JSON.stringify(qo.nodes.nodes[0].parameters.visualFilter) === '{"type":"and","conditions":[{"field":"z","operator":"equalTo","value":1},{"type":"or","conditions":[{"field":"z"},{"field":"b"}]}]}' && qo.nodes.nodes[1].parameters.properties === 'z,b' && qo.connections.connections[0].fromProperty === 'prop-z' && qo.nodes.nodes[2].parameters.properties === 'a', 'page data: a filter (groups and all) and its first record follow; an object of no known type waits for a tick');
  const tr = typeReaders(todo, 'Task');
  const to = renameType(todo, 'Task', 'Job');
  ok(tr.filter((x) => x.sure).length === 8 && !JSON.stringify([...to.changed.values()]).includes('"collectionName": "Task"') && !JSON.stringify([...to.changed.values()]).includes('"collectionName":"Task"'), 'a type renamed: every node that names it follows', tr.filter((x) => x.sure).length);
}

const children = [];
let b;
try {
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(server);
  let log = '';
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('nodegx-studio: http'); i++) await wait(100);
  const url = `http://127.0.0.1:${port}/`;
  const api = async (path, init) => { const r = await fetch(url + path.slice(1), init); return r.json(); };

  // the app's backend, made the way a person makes it: Data's Start a backend (POST /api/backend-provision)
  const made = await api('/api/backend-provision', { method: 'POST' });
  ok(made.phase === 'running' && pj().metadata.cloudservices?.endpoint === made.endpoint, 'Start a backend: a backend of the project\'s own, bound', made);
  const dev = adminOf('cloudservices');

  b = await browser({ port: await freePort(), width: 1500, height: 960 });
  await b.goto(url);
  await b.waitTitle((t) => t.startsWith('ready'), 90000);
  await wait(800);
  const ev = (expr) => b.evaluate(expr);
  const clickIn = (sel, text) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const until = (expr, ms = 8000) => b.until(expr, ms);
  const settle = async () => { await wait(500); };
  // P125-MUDDY-NATIVEDIALOG: Studio asks in its own field and card (no prompt()/confirm() to stub), answered as a person does
  const answerName = async (name) => { if (!(await until(`!!document.querySelector('.ask [data-input=askname]')`, 4000))) throw new Error(`no name asked for ${name}`); await ev(`document.querySelector('.ask [data-input=askname]').focus()`); await b.type(name); await b.key('Enter', 'Enter', 13); };
  const yes = async () => { if (!(await until(`!!document.querySelector('.sure [data-act=yes]')`, 6000))) throw new Error('Studio asked no yes'); await ev(`document.querySelector('.sure [data-act=yes]').click()`); };
  const shot = async (name) => { if (shots) { await wait(500); await b.screenshot(join(here, '..', 'docs', 'look', `stu-06${name}.png`)); } };

  console.log('check: STU-060 the map in Data');
  ok((await ev(`[...document.querySelectorAll('#rail [role=tab]')].map(x => x.dataset.tab).join()`)) === 'design,workflow,data,styles', 'the rail has four tabs: the map is no longer one of them');
  await ev(`document.querySelector('[data-tab=data]').click()`); await settle();
  ok((await ev(`[...document.querySelectorAll('#data .subtabs [data-sub]')].map(x => x.textContent).join()`)) === 'Data types,Privacy,App data,Option sets,Map', 'Data\'s sub-tabs: Data types, Privacy, App data, Option sets, Map');

  console.log('check: STU-061 a type and its fields, on the backend and in the project');
  await ev(`document.getElementById('newtype').click()`); await answerName('Note');
  await until(`!!document.querySelector('#types .row[data-type="Note"]')`); await settle();
  ok((await dev.table('Note')) && declared('Note'), 'New type: a table on the development backend and a type in the project', { onBackend: !!(await dev.table('Note')), declared: declared('Note') });
  const addField = async (kind, name, extra = '') => {
    await ev(`[...document.querySelectorAll('#datamain .bar button')].find(e => e.textContent.includes('New field')).click()`);
    await until(`!!document.querySelector('#drawer:not([hidden]) .kinds')`);
    await ev(`document.querySelector('#drawer .kinds [data-kind=${kind}]').click()`);
    await ev(`(() => { const i = document.querySelector('#drawer [data-input=name]'); i.value = ${JSON.stringify(name)}; i.dispatchEvent(new Event('input')); ${extra} })()`);
    await wait(150);
    const why = await ev(`document.querySelector('#drawer .why').textContent`);
    await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`);
    await until(`document.getElementById('drawer').hidden`, 6000); await settle();
    return why;
  };
  await addField('text', 'title');
  const why = await addField('choice', 'status', `const v = document.querySelector('#drawer [data-input=values]'); v.value = 'open\\nclosed'; v.dispatchEvent(new Event('input'));`);
  let note = await dev.table('Note');
  ok(note.columns.some((c) => c.name === 'status' && c.type === 'String') && note.checks.some((c) => c.rule.field === 'status' && c.rule.oneOf?.join() === 'open,closed'), 'a Choice is a String on the backend with its one-of check', { why, columns: note.columns, checks: note.checks.map((c) => c.description) });
  ok(declared('Note').columns.some((c) => c.name === 'status') && declared('Note').checks?.some((r) => r.field === 'status' && r.oneOf), 'and the project declares the field and its check', declared('Note'));
  ok((await ev(`[...document.querySelectorAll('#datamain tr[data-field=status] td')].map(t => t.textContent).join('|')`)).includes('Choice'), 'the field reads as a Choice, in the backend manager\'s words', await ev(`[...document.querySelectorAll('#datamain tr[data-field=status] td')].map(t => t.textContent).join('|')`));
  await addField('link', 'task', `const s = [...document.querySelectorAll('#drawer select')].find(x => [...x.options].some(o => o.value === 'Note')); s.value = 'Note'; s.dispatchEvent(new Event('change'));`);
  note = await dev.table('Note');
  ok(note.columns.some((c) => c.name === 'task' && c.type === 'Pointer' && c.targetClass === 'Note'), 'a Link is a Pointer at its type', note.columns);
  await addField('text', 'count');
  await dev.post('/classes/Note', { title: 'one', status: 'open', count: '7' });
  // rename status → state: the check comes off and goes back on under the new name
  await ev(`document.querySelector('#datamain tr[data-field=status] button[title="Change this field"]').click()`);
  await until(`!!document.querySelector('#drawer:not([hidden]) [data-input=name]')`);
  await ev(`(() => { const i = document.querySelector('#drawer [data-input=name]'); i.value = 'state'; i.dispatchEvent(new Event('input')); })()`); await wait(150);
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  note = await dev.table('Note');
  ok(note.columns.some((c) => c.name === 'state') && !note.columns.some((c) => c.name === 'status') && note.checks.some((c) => c.rule.field === 'state' && c.rule.oneOf) && (await dev.get('/classes/Note')).results[0].state === 'open', 'a rename renames the column, keeps its values, and its check follows', { columns: note.columns.map((c) => c.name), checks: note.checks.map((c) => c.description) });
  // count: Text → Number, the value converted
  await ev(`document.querySelector('#datamain tr[data-field=count] button[title="Change this field"]').click()`);
  await until(`!!document.querySelector('#drawer:not([hidden]) .kinds')`);
  await ev(`document.querySelector('#drawer .kinds [data-kind=number]').click()`); await wait(150);
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await yes(); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  note = await dev.table('Note');
  ok(note.columns.find((c) => c.name === 'count')?.type === 'Number' && (await dev.get('/classes/Note')).results[0].count === 7 && declared('Note').columns.find((c) => c.name === 'count')?.type === 'Number', 'a kind change converts the values, on the backend and in the project', { type: note.columns.find((c) => c.name === 'count')?.type, value: (await dev.get('/classes/Note')).results[0].count });
  await ev(`document.querySelector('#datamain tr[data-field=count] button[title="Delete this field"]').click()`); await yes(); await settle();
  ok(!(await dev.table('Note')).columns.some((c) => c.name === 'count') && !declared('Note').columns.some((c) => c.name === 'count'), 'Delete field: the column goes from the backend and the project');
  await shot('1-types');

  console.log('check: Required on a stored field');
  await dev.post('/classes/Note', { state: 'open' }); await dev.post('/classes/Note', { state: 'closed' });
  const openTitle = async () => { await ev(`document.querySelector('#datamain tr[data-field=title] button[title="Change this field"]').click()`); await until(`!!document.querySelector('#drawer:not([hidden]) [data-input=required]')`); };
  await openTitle();
  await ev(`document.querySelector('#drawer [data-input=required]').click()`);
  await until(`!!document.querySelector('#drawer [data-empty]')`);
  const emptyNote = await ev(`document.querySelector('#drawer [data-empty]').textContent`);
  await shot('1-required');
  ok(emptyNote.startsWith('2 records') && (await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().disabled`)), 'Required on title: the two rows with nothing in it are counted first, and Save waits', emptyNote);
  await ev(`document.querySelector('#drawer [data-act=show-empty]').click()`);
  await until(`(document.querySelector('#appmain [data-pages]')?.textContent || '').includes('with nothing in title')`); await settle();
  ok((await ev(`document.querySelector('#appmain [data-pages]').textContent`)) === '1–2 of 2 with nothing in title', 'Show them in App data: only those two rows', await ev(`document.querySelector('#appmain [data-pages]').textContent`));
  await ev(`[...document.querySelectorAll('#appmain tr[data-row] td.pick input')].forEach(i => i.click())`); await settle();
  await ev(`document.querySelector('#appmain [data-act=delete]').click()`); await yes();
  await until(`(document.querySelector('#appmain .empty')?.textContent || '') === 'Every row has a title now.'`);
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  await ev(`document.querySelector('#types .row[data-type=Note]').click()`); await settle();
  await openTitle();
  await ev(`document.querySelector('#drawer [data-input=required]').click()`); await wait(400);
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  const titleCol = (await dev.table('Note')).columns.find((c) => c.name === 'title');
  ok(titleCol?.required === true && declared('Note').columns.find((c) => c.name === 'title')?.required === true && !!(await dev.post('/classes/Note', { state: 'open' }))?.error && (await dev.count('Note')) === 1, 'then made required on the backend and in the project; a row without one is refused', { backend: titleCol, project: declared('Note').columns.find((c) => c.name === 'title') });

  console.log('check: STU-061 drift');
  await dev.post('/admin/schema', { action: 'addColumn', table: 'Note', column: { name: 'pinned', type: 'Boolean' } }); // as Claude Code would
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  const driftText = await ev(`[...document.querySelectorAll('#datamain .card.drift p')].map(p => p.textContent).join(' / ')`);
  ok(driftText.includes('not in the project: pinned (Boolean)'), 'a field added outside Studio is named as drift', driftText);
  await clickIn('#datamain .card.drift button', 'Declare them'); await settle();
  ok(declared('Note').columns.some((c) => c.name === 'pinned' && c.type === 'Boolean') && !(await ev(`!!document.querySelector('#datamain .card.drift')`)), 'Declare them: the project has it, and the card goes');
  // s18: Required is drift too (the backend's diff never compares it): title made optional on the backend from outside
  const setReq = (on) => dev.post('/admin/schema', { action: 'setRequired', table: 'Note', columns: { title: on } });
  const driftNow = async () => { await ev(`document.querySelector('[data-sub=types]').click()`); await settle(); return ev(`[...document.querySelectorAll('#datamain .card.drift p')].map(p => p.textContent).join(' / ')`); };
  await setReq(false);
  const blank = await dev.post('/classes/Note', { state: 'open' });
  const reqDrift = await driftNow();
  await ev(`document.querySelector('#datamain .card.drift [data-act=required-backend]').click()`);
  await until(`(document.querySelector('#datamain .card.drift p')?.textContent || '').includes('nothing in title')`);
  const refused = await ev(`document.querySelector('#datamain .card.drift p').textContent`);
  ok(reqDrift.includes('title is required in the project and optional on the development database.') && refused.startsWith('1 record on the development database has nothing in title') && !(await dev.table('Note')).columns.find((c) => c.name === 'title').required, 'Required as drift: named, and making it required on the backend first counts the rows without one and stops', { reqDrift, refused });
  await dev.del(`/classes/Note/${blank.objectId}`);
  await ev(`document.querySelector('#datamain .card.drift [data-act=required-backend]').click()`); await settle();
  ok((await dev.table('Note')).columns.find((c) => c.name === 'title').required === true && !(await ev(`!!document.querySelector('#datamain .card.drift')`)), 'with that row gone, Make it required on the backend does, and the card goes');
  await setReq(false); await driftNow();
  await ev(`document.querySelector('#datamain .card.drift [data-act=required-project]').click()`); await settle();
  const optionalNow = !declared('Note').columns.find((c) => c.name === 'title').required;
  await setReq(true);
  const otherWay = await driftNow();
  await ev(`document.querySelector('#datamain .card.drift [data-act=required-project]').click()`); await settle();
  ok(optionalNow && otherWay.includes('title is optional in the project and required on the development database.') && declared('Note').columns.find((c) => c.name === 'title').required === true && !(await ev(`!!document.querySelector('#datamain .card.drift')`)), 'the other way to agree: the project takes the backend\'s Required, either way', otherWay);

  console.log('check: STU-060 who can reach it, the map');
  await until(`!!document.querySelector('#datamain .reach')`, 15000);
  ok((await ev(`document.querySelector('#datamain .reach')?.textContent || ''`)).includes('Someone not signed in'), 'a type says who can reach it, in the map\'s words', await ev(`document.querySelector('#datamain .reach')?.textContent`));
  await clickIn('#datamain h2 button', 'Open on the map'); await settle();
  ok((await ev(`document.getElementById('mapframe').getAttribute('src')`)).endsWith('#t:Note') && !(await ev(`document.getElementById('data-map').hidden`)), 'Open on the map: the Map sub-tab, on that table', await ev(`document.getElementById('mapframe').getAttribute('src')`));
  ok(await until(`(() => { try { return document.getElementById('mapframe').contentWindow.__map?.byId?.['t:Note'] ? true : false; } catch { return false; } })()`, 20000), 'the map draws the type Studio just made');
  await shot('0-map');

  console.log('check: STU-063 App data');
  const many = Array.from({ length: 120 }, (_, i) => ({ title: `row ${String(i).padStart(3, '0')}`, state: i % 2 ? 'open' : 'closed' }));
  await dev.post('/admin/import/Note', { format: 'json', content: JSON.stringify(many), dryRun: false });
  await ev(`document.querySelector('[data-sub=app]').click()`); await settle();
  await ev(`document.querySelector('#apptypes .row[data-type=Note]').click()`);
  await until(`!!document.querySelector('#appmain [data-pages]')`); await settle();
  ok((await ev(`document.querySelector('#appmain [data-pages]').textContent`)) === '1–50 of 121' && (await ev(`document.querySelectorAll('#appmain tr[data-row]').length`)) === 50, 'every row, 50 a page, with the count', await ev(`document.querySelector('#appmain [data-pages]').textContent`));
  await ev(`document.querySelector('#appmain [data-act=next]').click()`); await settle();
  ok((await ev(`document.querySelector('#appmain [data-pages]').textContent`)) === '51–100 of 121', 'the next page', await ev(`document.querySelector('#appmain [data-pages]').textContent`));
  await ev(`(() => { const s = document.querySelector('#appmain [data-input=search]'); s.value = 'ROW 01'; s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await settle();
  ok((await ev(`document.querySelector('#appmain [data-pages]').textContent`)).startsWith('1–10 of 10'), 'a search finds the rows whose text holds it, case aside', await ev(`document.querySelector('#appmain [data-pages]').textContent`));
  const first = await ev(`document.querySelector('#appmain tr[data-row]').dataset.row`);
  await ev(`document.querySelector('#appmain tr[data-row] td[data-field=state]').click()`);
  await until(`!!document.querySelector('#appmain td[data-field=state] select')`);
  const opts = await ev(`[...document.querySelector('#appmain td[data-field=state] select').options].map(o => o.value).join()`);
  await ev(`(() => { const s = document.querySelector('#appmain td[data-field=state] select'); s.value = 'open'; s.dispatchEvent(new Event('change')); })()`); await settle();
  ok(opts === ',open,closed' && (await dev.get(`/classes/Note/${first}`)).state === 'open', 'a Choice is edited through its own values, and the backend has the new one', { opts });
  // an import, checked first
  await ev(`(() => { const s = document.querySelector('#appmain [data-input=search]'); s.value = ''; s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await settle();
  await ev(`(() => { const orig = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type !== 'file') return orig.call(this); const dt = new DataTransfer(); dt.items.add(new File(['title,state\\nimported a,open\\nimported b,closed\\n'], 'more.csv', { type: 'text/csv' })); this.files = dt.files; this.dispatchEvent(new Event('change')); HTMLInputElement.prototype.click = orig; }; document.querySelector('#appmain [data-act=import]').click(); })()`);
  await until(`!!document.querySelector('#drawer [data-act=import-go]')`, 6000);
  const dry = await ev(`document.querySelector('#drawer .dbody').textContent`);
  const before = await dev.count('Note');
  ok(dry.includes('2 new') && before === 121, 'an import is checked first, and nothing is written by the check', { dry: dry.slice(0, 120), before });
  await ev(`document.querySelector('#drawer [data-act=import-go]').click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  ok((await dev.count('Note')) === 123, 'then imported', await dev.count('Note'));
  await ev(`[...document.querySelectorAll('#appmain tr[data-row] td.pick input')].slice(0, 3).forEach(i => i.click())`); await settle();
  await ev(`document.querySelector('#appmain [data-act=delete]').click()`); await yes(); await wait(1500);
  ok((await dev.count('Note')) === 120, 'three rows ticked and deleted together', await dev.count('Note'));
  await shot('3-appdata');
  ok(await until(`(document.querySelector('#appmain [data-card=imported]')?.textContent || '').includes('Task (3)')`), 'the importer\'s data files are offered in App data', await ev(`document.querySelector('#appmain [data-card=imported]')?.textContent`));
  await ev(`document.querySelector('#appmain [data-act=imported]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=imported-go]:not([disabled])')`, 10000);
  const taskBefore = await dev.count('Task');
  await ev(`document.querySelector('#drawer [data-act=imported-go]').click()`);
  await until(`(document.querySelector('#drawer .dbody')?.textContent || '').includes('Loaded into the development database')`, 10000);
  ok(taskBefore === 0 && (await dev.count('Task')) === 3 && (await dev.get('/classes/Task/1792241441972x125425336514852772')).title === 'imported 2', 'checked first (nothing written), then loaded, the importer\'s ids kept', { before: taskBefore, after: await dev.count('Task') });
  await ev(`document.querySelector('#drawer .dfoot .primary').click()`); await settle();

  console.log('check: STU-064 Privacy');
  const anonBefore = (await dev.anonymous('GET', '/classes/Note')).status;
  await ev(`document.querySelector('[data-sub=privacy]').click()`);
  await until(`!!document.querySelector('#privtypes .row[data-type=Note]')`, 15000);
  await ev(`document.querySelector('#privtypes .row[data-type=Note]').click()`);
  await until(`!!document.querySelector('#privmain select[data-rule=read]')`, 15000); await settle();
  await ev(`(() => { for (const [k, v] of [['read', 'public'], ['change', 'nobody']]) { const s = document.querySelector('#privmain select[data-rule=' + k + ']'); s.value = v; s.dispatchEvent(new Event('change')); } })()`);
  await ev(`document.querySelector('#privmain [data-act=make]').click()`); await wait(1500);
  const sec = readJson(join(project, 'nodegx.security.json'));
  const anonFind = await dev.post('/admin/permissions/check', { principal: { kind: 'anonymous' }, collection: 'Note', op: 'find' });
  const anonAdd = await dev.post('/admin/permissions/check', { principal: { kind: 'anonymous' }, collection: 'Note', op: 'create' });
  const anonAfter = (await dev.anonymous('GET', '/classes/Note')).status;
  ok(anonBefore >= 400 && anonAfter === 200 && anonFind.allowed && !anonAdd.allowed && sec.collections?.Note?.permissions?.find === 'public' && sec.collections.Note.permissions.create === 'nobody', 'Make it so: someone not signed in was refused Note\'s rows and now gets them, nobody may add one, and nodegx.security.json says the same', { anonBefore, anonAfter, anonAdd: anonAdd.reason, file: sec.collections?.Note });
  await shot('4-privacy');

  console.log('check: STU-062 a rename follows the app (the todo app\'s Task)');
  // Task as the todo app keeps it: the importer's rows (title, position), and the fields its commands set, added as Claude Code would
  for (const name of ['status', 'deadline', 'closingNote', 'closedAt']) await dev.post('/admin/schema', { action: 'addColumn', table: 'Task', column: { name, type: 'String' } });
  await dev.post('/classes/Task', { title: 'Paint the fence', position: 9, status: 'done', closingNote: 'Painted it green', closedAt: '2026-10-22T10:00:00.000Z' });
  // a visitor signs up in the app (Todo sends a signed-out visitor to Sign in) and adds a task
  const W = '__ob.preview.frame.contentWindow';
  const typeInto = (expr, text) => ev(`(() => { const w = ${W}; const input = ${expr}; if (!input) return false; input.focus(); w.Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new w.Event('input', { bubbles: true })); return true; })()`);
  const inputOf = (id) => `(() => { const el = __ob.preview.elementsOf(${JSON.stringify(id)})[0]; return el && (el.matches('input') ? el : el.querySelector('input')); })()`;
  // the app is driven where a person sees it: on the Design tab (Data hides the app's frame)
  const addTask = async (title) => {
    await ev(`document.querySelector('[data-tab=design]').click()`); await settle();
    const typed = await typeInto(`[...${W}.document.querySelectorAll('input[type=text], input:not([type])')].find(i => i.offsetParent)`, title);
    await wait(300);
    const pressed = await ev(`(() => { const btn = [...${W}.document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Add' && e.offsetParent); if (!btn) return false; btn.click(); return true; })()`);
    const shown = !!(await until(`${W}.document.body.innerText.includes(${JSON.stringify(title)})`, 10000));
    await ev(`document.querySelector('[data-tab=data]').click()`); await settle();
    return typed && pressed && shown;
  };
  const signNodes = readJson(join(project, 'components', 'Pages', 'Sign in', 'nodes.json')).nodes, idOf = (l) => signNodes.find((n) => n.label === l)?.id;
  await until(`(() => { try { return !!__ob.preview.elementsOf(${JSON.stringify(idOf('Email'))})[0]; } catch { return false; } })()`, 20000);
  const visitor = `rename${Date.now()}@example.com`;
  await typeInto(inputOf(idOf('Email')), visitor); await typeInto(inputOf(idOf('Password')), 'rename-password-1');
  await wait(300);
  await ev(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(idOf('Create account'))})[0]; (el.matches('button') ? el : el.querySelector('button') || el).click(); })()`);
  const signedUp = await until(`${W}.__studioLog.some(e => e.kind === 'nav' && /todo/i.test(e.path))`, 15000);
  await wait(2500);
  const firstAdd = await addTask('Before the rename');
  ok(signedUp && firstAdd, 'in the app: a visitor signs up and adds a task', { signedUp });
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  await ev(`document.querySelector('#types .row[data-type=Task]').click()`); await settle();
  await clickIn('#datamain .card.drift button', 'Declare Task'); await settle();
  ok(declared('Task')?.columns.some((c) => c.name === 'closingNote'), 'Task declared from the development database', declared('Task')?.columns.map((c) => c.name));
  const validateErrors = mcpBuilt ? (await validate()).filter((d) => d.severity === 'error') : null;
  await ev(`document.querySelector('#datamain tr[data-field=closingNote] button[title="Change this field"]').click()`);
  await until(`!!document.querySelector('#drawer:not([hidden]) .readers')`);
  const sureRows = await ev(`[...document.querySelectorAll('#drawer .readers li[data-reader]')].map(li => li.textContent)`);
  const maybeNodes = await ev(`[...document.querySelectorAll('#drawer .readers [data-pick-node]')].map(i => i.dataset.pickNode)`);
  ok(sureRows.length === 3 && sureRows.every((t) => t.includes('sets it')) && maybeNodes.length === 3, 'Used by: the three commands that set it, and three pieces of code that read a closingNote, each to tick', { sureRows, maybeNodes });
  const givenWords = await ev(`document.querySelector('#drawer .readers label.given')?.textContent || ''`);
  await ev(`document.querySelector('#drawer .readers [data-pick-given]').click()`);
  const allTicked = await ev(`[...document.querySelectorAll('#drawer .readers [data-pick-node], #drawer .readers [data-pick]')].every(i => i.checked)`);
  ok(givenWords.startsWith('Tick the 3 lines in code given Task’s rows') && allTicked, 'one tick takes every line in code given Task\'s rows, and each node\'s boxes show it', givenWords);
  await ev(`(() => { const i = document.querySelector('#drawer [data-input=name]'); i.value = 'closingWords'; i.dispatchEvent(new Event('input')); })()`); await wait(150);
  await shot('2-rename');
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await wait(2000);
  const done = (await dev.get('/classes/Task?where=' + encodeURIComponent(JSON.stringify({ status: 'done' })))).results[0];
  ok(done?.closingWords === 'Painted it green' && !('closingNote' in done) && declared('Task').columns.some((c) => c.name === 'closingWords'), 'the backend renamed the column and kept its value; the project says the same', done);
  const onDisk = componentsOf(project);
  const allText = JSON.stringify(onDisk);
  ok(!allText.includes('prop-closingNote') && (allText.match(/prop-closingWords/g) || []).length === 3, 'every Record node that set closingNote sets closingWords, on disk', (allText.match(/prop-closingWords/g) || []).length);
  const code = (key) => JSON.stringify(onDisk.find((c) => c.key === key).files.nodes);
  ok(code('Logic/Task rows').includes('c.closingWords') && code('Logic/Selected task').includes('Outputs.closingNote = String(task.closingWords') && !code('Logic/Projects').includes('ct.closingNote'), 'the ticked code reads closingWords; the node\'s own output keeps its name', null);
  if (mcpBuilt) {
    const after = (await validate()).filter((d) => d.severity === 'error');
    ok(after.length === 0, `validate_project: 0 errors after the rename (${validateErrors.length} before)`, after.map((d) => `${d.code} ${d.location?.component}: ${d.message}`));
  } else console.log(`  skip validate_project — no NodeGX MCP server at ${kit.mcpServer}`);
  await until(`(() => { try { return ${W}.document.body.innerText.includes('Before the rename'); } catch { return false; } })()`, 30000);
  const shown = await ev(`${W}.document.body.innerText`);
  const added = await addTask('After the rename');
  const after = (await dev.get('/classes/Task?where=' + encodeURIComponent(JSON.stringify({ title: 'After the rename' })))).results?.[0];
  ok(shown.includes('Before the rename') && added && after && 'closingWords' in after && !('closingNote' in after) && !(await dev.table('Task')).columns.some((c) => c.name === 'closingNote'), 'the app still shows its rows, and a task added now is written with closingWords (closingNote does not come back)', { shown: shown.slice(0, 160), after });

  console.log('check: App data\'s User');
  await dev.post('/admin/schema', { action: 'addColumn', table: '_User', column: { name: 'nickname', type: 'String' } }); // a field of the app's own, as Claude Code would add it
  await ev(`document.querySelector('[data-sub=app]').click()`); await settle();
  await ev(`document.querySelector('#apptypes .row[data-type=_User]').click()`);
  await until(`!!document.querySelector('#appmain tr[data-row]')`); await settle();
  const people = await ev(`[...document.querySelectorAll('#appmain tr[data-row] td[data-field=email]')].map(td => td.textContent)`);
  const heads = await ev(`[...document.querySelectorAll('#appmain th')].map(th => th.textContent).join()`);
  ok(people.length === 1 && people[0] === visitor && heads.includes('nickname') && heads.includes('emailVerified'), 'User: the one who signed up in the app, with the account\'s fields and the app\'s own', { people, heads });
  const editIn = async (field, value) => {
    await ev(`document.querySelector('#appmain tr[data-row] td[data-field=${field}]').click()`);
    await until(`!!document.querySelector('#appmain td[data-field=${field}] input, #appmain td[data-field=${field}] select')`);
    await ev(`(() => { const c = document.querySelector('#appmain td[data-field=${field}] input, #appmain td[data-field=${field}] select'); c.value = ${JSON.stringify(value)}; c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input')); c.dispatchEvent(new Event('blur')); })()`); // the app's frame had the focus: a blur() would not fire
    await wait(800);
  };
  await editIn('nickname', 'Paint person'); await editIn('emailVerified', 'yes');
  const signedUpRow = (await dev.get('/admin/users')).users.find((u) => u.email === visitor);
  ok(signedUpRow?.nickname === 'Paint person' && signedUpRow.emailVerified === true, 'a field of the app\'s own and a yes / no, changed in a cell, through the Users API', signedUpRow);
  await ev(`document.querySelector('#appmain [data-act=new]').click()`);
  await until(`!!document.querySelector('#drawer [data-input=password]')`);
  await ev(`(() => { for (const [k, v] of [['email', 'added@example.com'], ['password', 'added-password-1']]) { const i = document.querySelector('#drawer [data-input=' + k + ']'); i.value = v; i.dispatchEvent(new Event('input')); } })()`);
  await ev(`document.querySelector('#drawer [data-act=create]').click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  const login = await dev.anonymous('POST', '/login', { username: 'added@example.com', password: 'added-password-1' });
  ok((await dev.get('/admin/users')).total === 2 && login.status === 200, 'New person: an account whose password signs in (kept hashed by the backend)', { status: login.status, total: (await dev.get('/admin/users')).total });
  await ev(`[...document.querySelectorAll('#appmain tr[data-row]')].find(tr => tr.textContent.includes('added@example.com')).querySelector('td.pick input').click()`); await settle();
  await ev(`document.querySelector('#appmain [data-act=delete]').click()`); await yes(); await wait(1500);
  ok((await dev.get('/admin/users')).total === 1 && (await dev.anonymous('POST', '/login', { username: 'added@example.com', password: 'added-password-1' })).status >= 400, 'ticked and deleted: that person can no longer sign in, the one from the app stays');
  await shot('3-users');

  console.log('check: STU-065 development and live');
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  await ev(`document.querySelector('#envbar [data-act=make-live]').click()`); await yes();
  await until(`!!document.querySelector('#envbar [data-env=live]:not([disabled])')`, 60000); await settle();
  const live = adminOf('cloudservicesLive');
  const liveNote = await live.table('Note');
  ok(pj().metadata.cloudservicesLive?.endpoint && pj().metadata.cloudservicesLive.endpoint !== pj().metadata.cloudservices.endpoint, 'Make a live database: a second backend, named in the project as cloudservicesLive', pj().metadata.cloudservicesLive);
  ok(liveNote && liveNote.columns.some((c) => c.name === 'state') && liveNote.checks.some((c) => c.rule.field === 'state' && c.rule.oneOf) && (await live.count('Note')) === 0, 'development\'s types, fields and checks are on live; its rows start empty', { columns: liveNote?.columns.map((c) => c.name), rows: await live.count('Note') });
  ok((await live.get('/admin/permissions')).config.devOpen === false && (await live.anonymous('POST', '/classes/Note', { title: 'x' })).status >= 400 && (await live.anonymous('GET', '/classes/Note')).status === 200, 'live keeps its rules on this computer: anyone may read Note, nobody may add (no devOpen)', { devOpen: (await live.get('/admin/permissions')).config.devOpen });
  // a new field reaches live only through Deploy to live
  await ev(`document.querySelector('#types .row[data-type=Note]').click()`); await settle();
  await addField('date', 'due');
  ok(!(await live.table('Note')).columns.some((c) => c.name === 'due'), 'a field added in development is not on live yet');
  await ev(`document.querySelector('#envbar [data-act=deploy-live]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=deploy-go]')`, 10000);
  const planText = await ev(`document.querySelector('#drawer .dbody').textContent`);
  await ev(`document.querySelector('#drawer [data-act=deploy-go]').click()`);
  await until(`(document.querySelector('#drawer h3')?.textContent || '') === 'Deployed to live'`, 10000);
  ok(planText.includes("Note's field due") && (await live.table('Note')).columns.some((c) => c.name === 'due' && c.type === 'Date'), 'Deploy to live says what it adds, and live has it after', planText.slice(0, 160));
  await ev(`document.querySelector('#drawer .dfoot .primary').click()`); await settle();
  // a dropped field is lost on live only after the yes
  await ev(`document.querySelector('#datamain tr[data-field=pinned] button[title="Delete this field"]').click()`); await yes(); await settle();
  await ev(`document.querySelector('#envbar [data-act=deploy-live]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=deploy-lose]')`, 10000);
  ok((await ev(`document.querySelector('#drawer .dbody').textContent`)).includes("Note's field pinned, in every row") && (await live.table('Note')).columns.some((c) => c.name === 'pinned'), 'a field development dropped is named as lost, and live still has it until the yes');
  await ev(`document.querySelector('#drawer [data-act=deploy-lose]').click()`);
  await until(`(document.querySelector('#drawer h3')?.textContent || '') === 'Deployed to live'`, 10000);
  ok(!(await live.table('Note')).columns.some((c) => c.name === 'pinned'), 'after the yes, it is gone from live');
  await ev(`document.querySelector('#drawer .dfoot .primary').click()`); await settle();
  // rows: development → live, checked first
  await ev(`document.querySelector('#envbar [data-act=copy-rows]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=copy-check]')`);
  await ev(`document.querySelector('#drawer [data-act=copy-check]').click()`);
  await until(`!document.querySelector('#drawer [data-act=copy-go]').disabled`, 10000);
  const copyDry = await live.count('Note');
  await ev(`document.querySelector('#drawer [data-act=copy-go]').click()`); await wait(2000);
  ok(copyDry === 0 && (await live.count('Note')) === (await dev.count('Note')), 'Copy rows: checked first (nothing written), then live has development\'s rows', { afterCheck: copyDry, live: await live.count('Note'), dev: await dev.count('Note') });
  await ev(`document.querySelector('#drawer .dhead button')?.click()`);
  await ev(`document.querySelector('#envbar [data-env=live]').click()`); await settle();
  await ev(`document.querySelector('#apptypes .row[data-type=Note]')?.click()`);
  await until(`!!document.querySelector('#appmain .livebar')`); await settle();
  ok((await ev(`document.querySelector('#appmain [data-pages]')?.textContent`)) === `1–50 of ${await live.count('Note')}` && (await ev(`document.querySelector('#appmain h2 .badge').textContent`)) === 'live', 'App data on live: live\'s rows, said to be live\'s', await ev(`document.querySelector('#appmain [data-pages]')?.textContent`));
  await shot('5-live');

  console.log('check: STU-062 renames reach live as renames');
  await ev(`document.querySelector('#envbar [data-env=development]')?.click()`); await settle();
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  await ev(`document.querySelector('#types .row[data-type=Note]').click()`); await settle();
  const liveRows = await live.count('Note');
  await ev(`document.querySelector('#datamain tr[data-field=title] button[title="Change this field"]').click()`);
  await until(`!!document.querySelector('#drawer:not([hidden]) [data-input=name]')`);
  await ev(`(() => { const i = document.querySelector('#drawer [data-input=name]'); i.value = 'heading'; i.dispatchEvent(new Event('input')); })()`); await wait(150);
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  await ev(`document.querySelector('#datamain [data-act=rename-type-open]').click()`);
  await until(`!!document.querySelector('#drawer [data-input=type-name]')`);
  await ev(`(() => { const i = document.querySelector('#drawer [data-input=type-name]'); i.value = 'Memo'; i.dispatchEvent(new Event('input')); })()`); await wait(150);
  await ev(`document.querySelector('#drawer [data-act=rename-type]').click()`); await until(`document.getElementById('drawer').hidden`, 8000); await settle();
  const memo = await dev.table('Memo');
  const devRules = (await dev.get('/admin/permissions')).config.collections || {};
  const sec2 = readJson(join(project, 'nodegx.security.json'));
  ok(memo && !(await dev.table('Note')) && memo.columns.some((c) => c.name === 'heading') && memo.checks.some((c) => c.rule.field === 'state' && c.rule.oneOf) && (await dev.count('Memo')) === liveRows, 'Note renamed Memo on development: its rows, its renamed field and its Choice\'s check kept', { columns: memo?.columns.map((c) => c.name), checks: memo?.checks.map((c) => c.description) });
  ok(devRules.Memo && !devRules.Note && sec2.collections?.Memo?.permissions?.find === 'public' && !sec2.collections?.Note, 'its rule for who may reach it moved with it, on the backend and in nodegx.security.json', { backend: Object.keys(devRules), file: Object.keys(sec2.collections || {}) });
  ok(declared('Memo')?.columns.find((c) => c.name === 'task')?.targetClass === 'Memo' && !declared('Note'), 'the project: Memo, and its Link points at Memo', declared('Memo')?.columns);
  ok(JSON.stringify(pj().metadata.cloudservicesLive.renames) === JSON.stringify([{ table: 'Note', from: 'title', to: 'heading' }, { table: 'Note', to: 'Memo' }]), 'both renames are kept for Deploy to live', pj().metadata.cloudservicesLive.renames);
  await ev(`document.querySelector('#envbar [data-act=deploy-live]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=deploy-go], #drawer [data-act=deploy-lose]')`, 10000);
  const renamePlan = await ev(`document.querySelector('#drawer .dbody').textContent`);
  ok(renamePlan.includes("Note's field title renamed heading") && renamePlan.includes('the type Note renamed Memo') && !(await ev(`!!document.querySelector('#drawer [data-act=deploy-lose]')`)), 'Deploy to live names both renames and loses nothing', renamePlan.slice(0, 300));
  await ev(`document.querySelector('#drawer [data-act=deploy-go]').click()`);
  await until(`(document.querySelector('#drawer h3')?.textContent || '') === 'Deployed to live'`, 15000); await wait(800);
  const liveMemo = await live.table('Memo');
  const oneLive = (await live.get('/classes/Memo?limit=1')).results?.[0];
  ok(liveMemo && !(await live.table('Note')) && (await live.count('Memo')) === liveRows && typeof oneLive?.heading === 'string' && !('title' in oneLive) && liveMemo.checks.some((c) => c.rule.field === 'state'), 'live: Memo, every row kept, its titles now its headings, its check back', { rows: await live.count('Memo'), was: liveRows, row: oneLive });
  ok(!pj().metadata.cloudservicesLive.renames, 'and the renames are cleared from the project once live has them');
  await ev(`document.querySelector('#drawer .dfoot .primary').click()`); await settle();

  console.log('check: Required reaches live');
  ok((await live.table('Memo')).columns.find((c) => c.name === 'heading')?.required === true, 'title was required in development before live was made: live\'s heading is required too, through the rename');
  await ev(`document.querySelector('#types .row[data-type=Memo]').click()`); await settle();
  await ev(`document.querySelector('#datamain tr[data-field=state] button[title="Change this field"]').click()`);
  await until(`!!document.querySelector('#drawer:not([hidden]) [data-input=required]')`);
  await ev(`document.querySelector('#drawer [data-input=required]').click()`); await wait(400);
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  const stray = await live.post('/classes/Memo', { heading: 'on live, no state' });
  await ev(`document.querySelector('#envbar [data-act=deploy-live]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=deploy-go]')`, 10000);
  const heldText = await ev(`document.querySelector('#drawer [data-held]')?.textContent || ''`);
  await ev(`document.querySelector('#drawer [data-act=deploy-go]').click()`);
  await until(`(document.querySelector('#drawer h3')?.textContent || '') === 'Deployed to live'`, 10000);
  ok((await dev.table('Memo')).columns.find((c) => c.name === 'state')?.required === true && heldText.includes("Memo's state stays optional on live: 1 row there has nothing in it") && !(await live.table('Memo')).columns.find((c) => c.name === 'state')?.required, 'state made required in development; live has a row without one, so Deploy to live says so and leaves it optional there', heldText);
  await ev(`document.querySelector('#drawer .dfoot .primary').click()`); await settle();
  await live.put(`/classes/Memo/${stray.objectId}`, { state: 'open' });
  await ev(`document.querySelector('#envbar [data-act=deploy-live]').click()`);
  await until(`!!document.querySelector('#drawer [data-act=deploy-go]')`, 10000);
  const reqPlan = await ev(`document.querySelector('#drawer .dbody').textContent`);
  await ev(`document.querySelector('#drawer [data-act=deploy-go]').click()`);
  await until(`(document.querySelector('#drawer h3')?.textContent || '') === 'Deployed to live'`, 10000);
  ok(reqPlan.includes("Memo's state made required") && (await live.table('Memo')).columns.find((c) => c.name === 'state')?.required === true, 'once that row has one, Deploy to live makes it required on live', reqPlan.slice(0, 200));
} catch (err) {
  ok(false, `the gate stopped: ${err.stack || err.message}`);
} finally {
  await b?.close();
  for (const c of children) c.kill('SIGTERM');
  await wait(1500); // the server stops the backends it started on SIGTERM
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
