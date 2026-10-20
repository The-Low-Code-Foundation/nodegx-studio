/**
 * NodeGX Studio — the run timeline's gate (STU-031).
 *
 * First on fixtures (no browser): ./timeline.mjs reads a request into a page data row with its start and end, a card's
 * event and the signals into what it reaches into one workflow row, a signal no card explains into a minor row,
 * changes to one element close together into one screen row, and leaves out what happened before Record.
 *
 * Then on the todo-list template, with a backend, in headless Chrome: a visitor signs up in the app and adds a task;
 * Todo is opened in Studio and "Record the page opening" pressed; Stop. Every assertion is checked against a witness
 * read straight from the app's frame, not from Studio's rows: the probe's own request log, the runtime's own trace
 * and the frame's document.
 *   - the Task query's row starts and ends on the millisecond the request did (the probe's log), and names the query
 *     node whose `items` came out with the answer (the trace), linking to the element on the page that holds it;
 *   - the task list's row is after the Task query's end and carries the task's title, which the list holds now;
 *   - the page-open workflow is one row, linked to its card; clicking it opens that card, clicking the query's row
 *     selects its element in Design;
 *   - then Record from now, a second task added: the Add button's card is a row, before the create request's row.
 *
 *   node editor/timeline-check.mjs [--shots]     PASS n/n and exit 0, or the failing lines and exit 1
 *   TIMELINE_DUMP=1 node editor/timeline-check.mjs   also prints every row of the page opening's recording
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { buildTimeline } from './timeline.mjs';
import { nodegxRepo } from '../lib/nodegx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.argv.includes('--shots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, cond ? 300 : 2400) : ''}`); };

console.log('timeline: fixtures');
{
  const label = (id) => ({ btn: 'Save', step1: 'Create a record', step2: 'Go to the list', list: 'Task list', inner: 'Row text', js: 'Run JavaScript' }[id] ?? id);
  const pageNode = (id) => (id === 'inner' ? 'list' : ['btn', 'step1', 'step2', 'list'].includes(id) ? id : null);
  const cards = [{ node: 'btn', port: 'onClick', name: 'Save → Go to the list', when: 'When Save: Click', reach: new Set(['step1', 'step2']) }];
  const trace = [
    { seq: 1, t: 90, kind: 'signal', fromNode: 'btn', fromPort: 'onClick', toNode: 'step1', toPort: 'store' }, // before Record
    { seq: 2, t: 110, kind: 'signal', fromNode: 'btn', fromPort: 'onClick', toNode: 'step1', toPort: 'store' },
    { seq: 3, t: 112, kind: 'value', fromNode: 'btn', fromPort: 'label', toNode: 'step1', toPort: 'x' },
    { seq: 4, t: 140, kind: 'signal', fromNode: 'step1', fromPort: 'stored', toNode: 'step2', toPort: 'navigate' },
    { seq: 5, t: 150, kind: 'signal', fromNode: 'js', fromPort: 'done', toNode: 'inner', toPort: 'refresh' },
    { seq: 6, t: 141, kind: 'value', fromNode: 'q1', fromPort: 'items', toNode: 'list', toPort: 'items' }
  ];
  const log = [
    { kind: 'request', method: 'POST', path: '/classes/Task', body: { _method: 'GET' }, t0: 80, t1: 95, status: 200, rows: 2 }, // before Record
    { kind: 'request', method: 'POST', path: '/classes/Task', body: { _method: 'GET' }, t0: 120, t1: 140.4, status: 200, rows: 3 },
    { kind: 'request', method: 'POST', path: '/classes/Project', body: { _method: 'GET' }, t0: 125, t1: 160, status: 200, rows: 0 },
    { kind: 'request', method: 'POST', path: '/classes/Task', body: { title: 'x' }, t0: 111, t1: 130, status: 201 },
    { kind: 'nav', path: '/todo', t: 145 }
  ];
  const screen = [{ t: 141, node: 'list', added: 2, removed: 0, text: 'Buy milk' }, { t: 150, node: 'list', added: 1, removed: 0, text: 'Water the plants' }, { t: 200, node: 'list', added: 0, removed: 0, text: '' }, { t: 151, node: null, added: 4, removed: 3, text: '' }];
  const asked = [];
  const asker = (collection, e) => { asked.push(collection); return collection === 'Task' ? { name: 'Tasks', link: { node: 'list' } } : null; };
  const tl = buildTimeline({ t0: 100, t1: 300, trace, log, screen, cards, label, pageNode, asker });
  const of = (lane) => tl.rows.filter((r) => r.lane === lane);
  const q = of('data').find((r) => r.collection === 'Task' && r.text.includes('asks'));
  ok(q && q.t === 20 && Math.abs(q.end - 40.4) < 1e-9 && q.text === 'Tasks asks for Task' && q.link?.node === 'list' && /3 rows/.test(q.sub), 'a query is one page data row: its start and end from Record, its rows, named by the query that asked', q);
  ok(!of('data').some((r) => r.t < 0) && of('data').length === 3, 'a request made before Record is not in the recording', of('data').map((r) => r.text));
  const js = of('data').find((r) => r.collection === 'Project');
  ok(js && js.text === 'JavaScript asks for Project' && js.link === null, 'a query no query node asks for was asked from JavaScript, and links nowhere', js);
  ok(of('data').some((r) => r.text === 'The app creates a Task' && !asked.includes(undefined)) && asked.length === 2, 'a write is said as what it does, and only a query is given an asker', { asked });
  const runs = of('workflow').filter((r) => !r.minor);
  ok(runs.length === 1 && runs[0].t === 10 && runs[0].end === 40 && runs[0].link?.card?.node === 'btn' && /2 steps/.test(runs[0].sub), "a card's event and the signals into what it reaches are one workflow row, linked to the card", runs);
  const minor = of('workflow').filter((r) => r.minor);
  ok(minor.length === 1 && minor[0].link?.node === 'list' && tl.loose === 1, 'a signal no card starts is a minor row, linked to the page element holding it', minor);
  const sc = of('screen');
  const listRow = sc.find((r) => r.node === 'list' && r.t === 41);
  ok(listRow && /3 elements drawn/.test(listRow.sub) && listRow.texts.join('|') === 'Buy milk|Water the plants', 'changes to one element within 30 ms are one screen row, its elements and its words added up', listRow);
  ok(sc.some((r) => r.node === 'list' && r.t === 100 && /empty/.test(r.sub)) && sc.some((r) => r.text === 'The page draws' && r.link === null) && sc.some((r) => r.text === 'The app goes to /todo'), 'a later change to the same element is its own row, a change outside every element is the page, a move is a row', sc.map((r) => `${r.t} ${r.text} ${r.sub}`));
  ok(tl.rows.every((r, i, a) => i === 0 || a[i - 1].t <= r.t), 'the rows are in the order things happened', tl.rows.map((r) => r.t));
  ok(tl.length === 200 && tl.span >= 100 && tl.span < 110 && tl.from === 0, 'the axis runs to the last thing that happened, not to Stop', { length: tl.length, span: tl.span, from: tl.from });
  const late = buildTimeline({ t0: 0, t1: 3000, log: [{ kind: 'request', method: 'POST', path: '/classes/Event', body: {}, t0: 2000, t1: 2100, status: 201 }], label, pageNode, asker });
  ok(late.from > 1900 && late.from < 2000 && late.rows[0].text === 'The app creates an Event', 'recorded from now, the axis starts at the first thing that happened; a word starting with a vowel takes "an"', { from: late.from, text: late.rows[0]?.text });
}

// ---------------- the drive
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const lineFrom = (proc, pattern, ms = 30000) => new Promise((res, rej) => {
  let out = ''; const t = setTimeout(() => rej(new Error(`no "${pattern}" in ${ms} ms:\n${out.slice(-800)}`)), ms);
  const on = (d) => { out += d; const m = out.match(pattern); if (m) { clearTimeout(t); res(m); } };
  proc.stdout.on('data', on); proc.stderr.on('data', on);
});
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-timeline-'));
const project = join(tmp, 'todo-list');
cpSync(join(nodegxRepo, 'templates/todo-list'), project, { recursive: true });
const children = [];
let b;
try {
  console.log('timeline: the todo template');
  const backendPort = await freePort();
  const backend = spawn(process.execPath, [join(nodegxRepo, 'packages/nodegx-backend/bin/nodegx-backend.js'), 'serve', '--data-dir', join(tmp, 'backend'), '--port', String(backendPort), '--token', 'nodegx-studio-timeline', '--backend-id', 'nodegx_studio_timeline', '--backend-name', 'NodeGX Studio timeline', '--ephemeral'], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(backend);
  await lineFrom(backend, /NODEGX_BACKEND_READY/);
  const pjPath = join(project, 'nodegx.project.json');
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  pj.metadata ??= {};
  pj.metadata.cloudservices = { instanceId: 'studio_timeline', endpoint: `http://127.0.0.1:${backendPort}`, appId: 'studio_timeline', type: 'nodegx' };
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(server);
  await lineFrom(server, /nodegx-studio: http/);
  b = await browser({ port: await freePort(), width: 1600, height: 1000 });
  await b.goto(`http://127.0.0.1:${port}/`);
  await b.waitTitle((t) => t.startsWith('ready'), 90000);
  await wait(1500);

  const W = '__ob.preview.frame.contentWindow';
  const files = (key) => ({ nodes: JSON.parse(readFileSync(join(project, 'components', key, 'nodes.json'), 'utf8')).nodes, connections: JSON.parse(readFileSync(join(project, 'components', key, 'connections.json'), 'utf8')).connections });
  const shows = () => b.evaluate('__ob.shows || 0');
  const rebuilt = async (n0) => { await b.until(`(__ob.shows || 0) > ${n0} && document.getElementById("status").textContent.startsWith("App on screen")`, 30000); await wait(400); };
  const typeInto = (expr, text) => b.evaluate(`(() => { const w = ${W}; const input = ${expr}; if (!input) return false; input.focus(); w.Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new w.Event('input', { bubbles: true })); return true; })()`);
  const inputOf = (id) => `(() => { const el = __ob.preview.elementsOf(${JSON.stringify(id)})[0]; return el && (el.matches('input') ? el : el.querySelector('input')); })()`;
  const addTask = async (title) => {
    const typed = await typeInto(`[...${W}.document.querySelectorAll('input[type=text], input:not([type])')].find(i => i.offsetParent)`, title);
    await wait(300);
    const pressed = await b.evaluate(`(() => { const btn = [...${W}.document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Add' && e.offsetParent); if (!btn) return false; btn.click(); return true; })()`);
    const shown = await b.until(`${W}.document.body.innerText.includes(${JSON.stringify(title)})`, 10000);
    return typed && pressed && !!shown;
  };
  const rowsNow = async () => JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('#tlrows .tlrow')].map(r => ({ lane: r.dataset.lane, t: Number(r.dataset.t), end: r.dataset.end === undefined ? null : Number(r.dataset.end), link: r.dataset.link || null, text: r.querySelector('.what').firstChild.textContent, sub: r.querySelector('small').textContent })))`));
  const recState = () => b.evaluate(`document.getElementById('recbtn').textContent`);

  // a visitor signs up in the app (Todo sends a signed-out visitor to Sign in) and adds a task
  const sign = files('Pages/Sign in').nodes, idOf = (l) => sign.find((n) => n.label === l)?.id;
  await typeInto(inputOf(idOf('Email')), `timeline${Date.now()}@example.com`); await typeInto(inputOf(idOf('Password')), 'timeline-password-1');
  await wait(300);
  await b.evaluate(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(idOf('Create account'))})[0]; (el.matches('button') ? el : el.querySelector('button') || el).click(); })()`);
  const signedUp = await b.until(`${W}.__studioLog.some(e => e.kind === 'nav' && /todo/i.test(e.path))`, 15000);
  await wait(2500);
  const TITLE = 'Read the run timeline';
  ok(signedUp && await addTask(TITLE), 'the visitor signs up in the app and adds a task', { signedUp });

  // Todo opened in Studio; the visitor is still signed in, so the app stays on it
  let n0 = await shows();
  await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Todo'; s.dispatchEvent(new Event('change')); })()`);
  await rebuilt(n0); await wait(1200);
  ok((await b.evaluate('document.getElementById("pagepick").value')) === 'Pages/Todo' && (await b.evaluate(`${W}.document.body.innerText.includes(${JSON.stringify(TITLE)})`)), 'Studio shows Todo, signed in, the task in its list');

  // ---- Record the page opening, Stop
  await b.clickSel('#recbtn'); await wait(300);
  ok(/^Stop/.test(await recState()) && !(await b.evaluate(`document.getElementById('timeline').hidden`)), 'Record starts a recording and opens the timeline under the page');
  n0 = await shows();
  await b.clickSel('#tlopen');
  await rebuilt(n0);
  await b.until(`/^Stop/.test(document.getElementById('recbtn').textContent)`, 10000);
  await wait(4000); // the Todo page's queries and the lists drawn from them
  await b.clickSel('#recbtn'); await wait(500);
  ok(/^Record/.test(await recState()), 'Stop ends it', await recState());
  const rows = await rowsNow();

  // the witnesses, read from the frame: the probe's requests, the runtime's trace, the document
  const truth = JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const w = ${W}, ctx = w.Noodl.Navigation._noodlRuntime.context;
    const reqs = w.__studioLog.filter(e => e.kind === 'request' && /\\/classes\\/Task$/.test(e.path) && e.body && e.body._method === 'GET');
    const outs = ctx.getTraceEvents(0).filter(e => e.fromPort === 'items').map(e => ({ node: e.fromNode, t: e.t }));
    return { reqs: reqs.map(e => ({ t0: e.t0, t1: e.t1, rows: e.rows })), outs, fresh: w.performance.now() };
  })())`));
  // the query node: a Task query in the files whose items came out with the first Task answer
  const where = new Map();
  for (const key of Object.keys(JSON.parse(readFileSync(join(project, 'components/_registry.json'), 'utf8')).components)) for (const n of files(key).nodes) where.set(n.id, { key, node: n });
  const taskQueries = [...where.values()].filter(({ node }) => node.type === 'DbCollection2' && node.parameters?.collectionName === 'Task');
  const first = truth.reqs[0];
  const asked = first && taskQueries.find(({ node }) => truth.outs.some((o) => o.node === node.id && Math.abs(o.t - first.t1) <= 5));
  const todo = files('Pages/Todo').nodes;
  const holderOf = (key) => todo.find((n) => n.type === '/' + key)?.id;
  const holder = asked && (holderOf(asked.key) ?? null);
  const dataRow = first && rows.find((r) => r.lane === 'data' && r.t === Math.round(first.t0));
  ok(first && dataRow && dataRow.end === Math.round(first.t1), "the Task query's row starts and ends where the request did (the probe's log)", { first, dataRow });
  ok(asked && dataRow?.text.startsWith(asked.node.label || 'Query Task') && dataRow.link === `node:${holder}`, "it names the query whose items came out with the answer (the trace) and links to the element holding it", { asked: asked?.node.label, key: asked?.key, holder, row: dataRow && { text: dataRow.text, link: dataRow.link } });
  const listId = todo.find((n) => n.type === '/Todo/Task list')?.id;
  // the copy draws through its roots (the preview maps no element to a copy): read them off the runtime
  const listHolds = await b.evaluate(`(() => { const c = ${W}.Noodl.Navigation._noodlRuntime.context.rootComponent.nodeScope.getNodesWithIdRecursive(${JSON.stringify(listId)})[0]; return (c?.getRoots?.() || []).some((r) => (r.getDOMElement?.()?.innerText || '').includes(${JSON.stringify(TITLE)})); })()`);
  const listRow = rows.find((r) => r.lane === 'screen' && r.link === `node:${listId}` && r.sub.includes(TITLE));
  ok(listHolds && listRow && listRow.t >= dataRow?.end, "the task list draws its task after the query's answer (the list holds it now)", { listHolds, listRow, queryEnd: dataRow?.end, screen: rows.filter((r) => r.lane === 'screen').slice(0, 12).map((r) => `${r.t} ${r.link} ${r.text} | ${r.sub.slice(0, 60)}`) });
  // the page-open workflow: the Page's Did Mount, wired in the files
  const pageNode = todo.find((n) => n.type === 'Page')?.id;
  const opens = files('Pages/Todo').connections.filter((c) => c.fromId === pageNode && /mount/i.test(c.fromProperty));
  const openRow = rows.find((r) => r.lane === 'workflow' && opens.some((c) => r.link === `card:${pageNode}.${c.fromProperty}`));
  ok(opens.length && openRow, "the page's own workflow on open is a row, linked to its card", { opens: opens.map((c) => c.fromProperty), openRow });
  ok(rows.length && rows.every((r, i) => i === 0 || rows[i - 1].t <= r.t), 'the rows are in time order', rows.slice(0, 6).map((r) => r.t));
  if (shots) await b.screenshot(join(here, '..', 'docs', 'look', 'stu-031-timeline.png'));
  if (process.env.TIMELINE_DUMP) console.log(rows.map((r) => `    ${String(r.t).padStart(5)} ${r.lane.padEnd(8)} ${r.text} | ${r.sub}`).join('\n'));

  // the links: the query's row selects its element in Design; the workflow's row opens its card
  if (dataRow) {
    await b.evaluate(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.lane === 'data' && Number(r.dataset.t) === ${dataRow.t}).click()`); await wait(500);
    const selected = await b.evaluate(`document.querySelector('#right .head input')?.value`);
    ok(selected === (where.get(holder)?.node.label || 'Todo data'), "clicking the query's row selects the element holding it", { selected, want: where.get(holder)?.node.label });
  }
  if (openRow) {
    await b.evaluate(`document.querySelector('#tlrows .tlrow[data-link=${JSON.stringify(openRow.link)}]').click()`); await wait(600);
    const card = JSON.parse(await b.evaluate(`JSON.stringify({ shown: !document.getElementById('workflow').hidden, title: document.querySelector('#steps .wf h2')?.textContent })`));
    ok(card.shown && card.title === openRow.text, 'clicking the workflow row opens its card', card);
    await b.clickSel('[data-tab=design]'); await wait(400);
  }

  // ---- Record from now: a second task added
  await b.clickSel('#recbtn'); await wait(300);
  const SECOND = 'Second task, recorded';
  const added = await addTask(SECOND);
  await wait(1500);
  await b.clickSel('#recbtn'); await wait(500);
  const rows2 = await rowsNow();
  // the Add button is inside the task list: its card is the reusable's, shown here as the list's
  const addBtn = files('Todo/Task list').nodes.find((n) => n.type === 'net.noodl.controls.button' && n.label === 'Add')?.id;
  const addRow = rows2.find((r) => r.lane === 'workflow' && r.link?.startsWith(`card:${addBtn}.`));
  const create = rows2.find((r) => r.lane === 'data' && r.text === 'The app creates a Task');
  const drawn = rows2.find((r) => r.lane === 'screen' && r.sub.includes(SECOND));
  ok(added && addRow && create && addRow.t <= create.t && drawn && rows2.every((r) => r.t >= 0) && !rows2.some((r) => r.text === 'The app opens'), "recorded from now: the Add button's card, then the create request, and the new task drawn; nothing from before Record", { addBtn, addRow, create, drawn: !!drawn, rows: rows2.length, workflow: JSON.parse(await b.evaluate(`JSON.stringify(__ob.timeline.rows.filter((r) => r.lane === 'workflow').map((r) => r.t.toFixed(0) + ' ' + r.text + ' | ' + r.sub))`)) });
  if (shots) await b.screenshot(join(here, '..', 'docs', 'look', 'stu-031-timeline-add.png'));

  const problems = b.problems.filter((p) => !/Invalid connection|doesn't have a port|Failed to load resource|fonts\.g|^\[noodl\]/.test(p));
  ok(problems.length === 0, 'no exceptions in the editor page', problems.slice(0, 3));
} catch (err) {
  ok(false, `the gate itself: ${err.message.split('\n')[0]}`);
  console.log(err.stack?.split('\n').slice(0, 4).join('\n'));
} finally {
  try { await b?.close(); } catch { /* gone */ }
  for (const c of children) try { c.kill(); } catch { /* gone */ }
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`timeline: ${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
