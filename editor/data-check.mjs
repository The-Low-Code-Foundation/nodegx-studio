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
 *   3. a field added outside Studio (as Claude Code would) is named as drift, and declared from the card
 *   4. App data: 120 rows paged 50 at a time with the count, a search, a Choice edited through its select, an import
 *      checked first, rows deleted together; the importer's backend/data/ files checked and loaded
 *   5. Privacy: a type made readable by anyone, through the map: the backend lets someone not signed in find it, and
 *      nodegx.security.json says the same
 *   6. live: made from Data; development's types and rules reach it; its rules hold on this computer; a new field
 *      reaches it only through Deploy to live; a field development dropped is lost on live only after the yes; rows
 *      copied after a dry run
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
    anonymous: (method, p, b) => call(method, p, b, false),
    table: async (name) => ((await call('GET', '/admin/schema')).json.tables || []).find((t) => t.name === name),
    count: async (name) => (await call('GET', `/classes/${name}?count=1&limit=0`)).json.count
  };
}

console.log('check: data.mjs');
{
  const list = typesOf({ declared: [{ name: 'A', columns: [{ name: 'x', type: 'String' }] }], backend: [{ name: 'A', columns: [] }, { name: 'B', columns: [{ name: 'y', type: 'Number' }] }, { name: '_User', columns: [] }], used: new Map([['C', new Set(['z'])]]) });
  ok(list.map((t) => `${t.name}:${t.declared ? 'd' : ''}${t.onBackend ? 'b' : ''}${t.usedByApp ? 'u' : ''}`).join(' ') === 'A:db B:b C:u', 'every type once, with where it is; the backend\'s system tables left out', list.map((t) => t.name));
  const d = driftOf([{ name: 'a', type: 'String' }, { name: 'b', type: 'Number' }, { name: 'p', type: 'Pointer', targetClass: 'X' }], [{ name: 'b', type: 'String' }, { name: 'c', type: 'Date' }, { name: 'p', type: 'Pointer', targetClass: 'Y' }, { name: 'objectId', type: 'String' }]);
  ok(d.onlyProject.map((c) => c.name).join() === 'a' && d.onlyBackend.map((c) => c.name).join() === 'c' && d.retyped.map((r) => r.name).join() === 'b,p' && !d.none, 'drift: only the project, only the backend, and a different type (a Link\'s target counts)', { onlyProject: d.onlyProject, onlyBackend: d.onlyBackend, retyped: d.retyped.map((r) => r.name) });
  ok(toWire({ name: 'n', type: 'Number' }, '4.5').value === 4.5 && toWire({ name: 'n', type: 'Number' }, 'four').error && toWire({ name: 'b', type: 'Boolean' }, 'Yes').value === true && toWire({ name: 'd', type: 'Date' }, '2026-10-22T10:00').value.__type === 'Date' && toWire({ name: 'p', type: 'Pointer', targetClass: 'T' }, 'abc').value.className === 'T' && toWire({ name: 'x', type: 'String' }, '').value === null, 'a typed value goes to the backend in its own shape; a wrong one is refused in words; empty clears');
  ok(JSON.stringify(searchWhere([{ name: 'title', type: 'String' }, { name: 'n', type: 'Number' }], 'a.b')) === '{"$or":[{"title":{"$regex":"a\\\\.b","$options":"i"}}]}' && searchWhere([{ name: 'n', type: 'Number' }], 'x') === null, 'a search looks in the text fields only, the words taken literally');
  ok(cellWords({ type: 'Boolean' }, false) === 'No' && cellWords({ type: 'Pointer' }, { objectId: 'q1' }) === 'q1', 'a cell says Yes / No and a link\'s id');
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
  await ev(`window.confirm = () => true; window.__prompts = []; window.prompt = () => window.__prompts.shift() ?? null`);
  const shot = async (name) => { if (shots) { await wait(500); await b.screenshot(join(here, '..', 'docs', 'look', `stu-06${name}.png`)); } };

  console.log('check: STU-060 the map in Data');
  ok((await ev(`[...document.querySelectorAll('#rail [role=tab]')].map(x => x.dataset.tab).join()`)) === 'design,workflow,data,styles', 'the rail has four tabs: the map is no longer one of them');
  await ev(`document.querySelector('[data-tab=data]').click()`); await settle();
  ok((await ev(`[...document.querySelectorAll('#data .subtabs [data-sub]')].map(x => x.textContent).join()`)) === 'Data types,Privacy,App data,Option sets,Map', 'Data\'s sub-tabs: Data types, Privacy, App data, Option sets, Map');

  console.log('check: STU-061 a type and its fields, on the backend and in the project');
  await ev(`window.__prompts.push('Note'); document.getElementById('newtype').click()`);
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
  await ev(`[...document.querySelectorAll('#drawer .dfoot button')].pop().click()`); await until(`document.getElementById('drawer').hidden`, 6000); await settle();
  note = await dev.table('Note');
  ok(note.columns.find((c) => c.name === 'count')?.type === 'Number' && (await dev.get('/classes/Note')).results[0].count === 7 && declared('Note').columns.find((c) => c.name === 'count')?.type === 'Number', 'a kind change converts the values, on the backend and in the project', { type: note.columns.find((c) => c.name === 'count')?.type, value: (await dev.get('/classes/Note')).results[0].count });
  await ev(`document.querySelector('#datamain tr[data-field=count] button[title="Delete this field"]').click()`); await settle();
  ok(!(await dev.table('Note')).columns.some((c) => c.name === 'count') && !declared('Note').columns.some((c) => c.name === 'count'), 'Delete field: the column goes from the backend and the project');
  await shot('1-types');

  console.log('check: STU-061 drift');
  await dev.post('/admin/schema', { action: 'addColumn', table: 'Note', column: { name: 'pinned', type: 'Boolean' } }); // as Claude Code would
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  const driftText = await ev(`[...document.querySelectorAll('#datamain .card.drift p')].map(p => p.textContent).join(' / ')`);
  ok(driftText.includes('not in the project: pinned (Boolean)'), 'a field added outside Studio is named as drift', driftText);
  await clickIn('#datamain .card.drift button', 'Declare them'); await settle();
  ok(declared('Note').columns.some((c) => c.name === 'pinned' && c.type === 'Boolean') && !(await ev(`!!document.querySelector('#datamain .card.drift')`)), 'Declare them: the project has it, and the card goes');

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
  await ev(`document.querySelector('#appmain [data-act=delete]').click()`); await wait(1500);
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

  console.log('check: STU-065 development and live');
  await ev(`document.querySelector('[data-sub=types]').click()`); await settle();
  await ev(`document.querySelector('#envbar [data-act=make-live]').click()`);
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
  await ev(`document.querySelector('#datamain tr[data-field=pinned] button[title="Delete this field"]').click()`); await settle();
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
