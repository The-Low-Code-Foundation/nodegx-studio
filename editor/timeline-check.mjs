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
 *   - step mode (STU-033), armed from that recording's Add task row: a third task added waits before each step, and
 *     the app's own request log has no write until Next lets the record's creation run.
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
import { buildTimeline, msText, shotAt, stepValues } from './timeline.mjs';
import { stepRule } from './stepper.mjs';
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
  ok(runs[0]?.steps?.map((x) => `${x.name}.${x.port}@${x.t}`).join('|') === 'Create a record.store@10|Go to the list.navigate@40', "a run carries its steps, each the node a signal ran, on the recording's clock", runs[0]?.steps);
  // STU-032: a step's inputs and outputs, off the trace
  {
    const tr = [
      { seq: 1, t: 1, kind: 'value', fromNode: 'input', fromPort: 'text', toNode: 'make', toPort: 'title', value: '"Milk"' },
      { seq: 2, t: 2, kind: 'value', fromNode: 'input', fromPort: 'text', toNode: 'make', toPort: 'title', value: '"Buy milk"' },
      { seq: 3, t: 5, kind: 'signal', fromNode: 'btn', fromPort: 'onClick', toNode: 'make', toPort: 'store', value: '' },
      { seq: 4, t: 6, kind: 'value', fromNode: 'make', fromPort: 'id', toNode: 'list', toPort: 'id', value: '"a1"' },
      { seq: 5, t: 7, kind: 'value', fromNode: 'input', fromPort: 'text', toNode: 'make', toPort: 'title', value: '"later"' },
      { seq: 6, t: 25, kind: 'signal', fromNode: 'make', fromPort: 'stored', toNode: 'nav', toPort: 'go', value: '' },
      { seq: 7, t: 25, kind: 'signal', fromNode: 'make', fromPort: 'stored', toNode: 'toast', toPort: 'show', value: '' },
      { seq: 8, t: 40, kind: 'signal', fromNode: 'btn', fromPort: 'onClick', toNode: 'make', toPort: 'store', value: '' },
      { seq: 9, t: 41, kind: 'value', fromNode: 'make', fromPort: 'id', toNode: 'list', toPort: 'id', value: '"b2"' }
    ];
    const io = stepValues(tr)(tr[2], [['collection', 'Task'], ['title', 'unused: wired'], ['store', true]]);
    ok(JSON.stringify(io.ins) === JSON.stringify([{ port: 'title', value: '"Buy milk"' }, { port: 'collection', value: '"Task"', set: true }]),
      "a step's inputs: the last value into each wired input before its signal (not one after), then its settings where nothing is wired", io.ins);
    ok(JSON.stringify(io.outs) === JSON.stringify([{ port: 'id', value: '"a1"', t: 1 }, { port: 'stored', signal: true, t: 20 }]),
      "its outputs: what it sent after its signal and before the next signal into it, a signal once however many wires", io.outs);
    ok(shotAt([{ t: 10 }, { t: 20 }, { t: 30 }], 5) === -1 && shotAt([{ t: 10 }, { t: 20 }, { t: 30 }], 20) === 1 && shotAt([{ t: 10 }, { t: 20 }, { t: 30 }], 29.9) === 1 && shotAt([{ t: 10 }, { t: 20 }, { t: 30 }], 99) === 2,
      'the screen at a moment is the last copy taken at or before it, none before the first');
  }
  // STU-033: which signals step mode holds, the timeline's rule for a run's steps
  {
    const rule = stepRule({ node: 'btn', port: 'onClick', reach: new Set(['make', 'nav', 'toast']) });
    const sig = (t, fromNode, fromPort, toNode) => ({ t, fromNode, fromPort, toNode, toPort: 'x' });
    const a = rule.take(sig(5, 'btn', 'onClick', 'make')), stray = rule.take(sig(6, 'other', 'done', 'nav')), b = rule.take(sig(30, 'make', 'stored', 'nav'));
    ok(a?.hold && a.step.n === 1 && stray === null && b?.hold && b.step.n === 2 && a.run === b.run,
      "step mode holds the card's event's signal as step 1 and a signal on from a node in the run as step 2; a signal into a step from outside the run is not held", { a: a && a.step.n, stray, b: b && b.step.n });
    const via = rule.take({ ...sig(32, 'make', 'stored', 'nav'), kind: 'value' });
    ok(via === null, 'a value from a step is not a step (only the card\'s own event can arrive as a value)', via);
    rule.free();
    const c = rule.take(sig(31, 'make', 'stored', 'toast')), d = rule.take(sig(90, 'btn', 'onClick', 'make'));
    ok(c && !c.hold && c.step.n === 3 && d?.hold && d.step.n === 1 && d.run !== c.run,
      '"Run the rest": the rest of the run goes through, still counted; the next run pauses again from step 1', { c: c && { hold: c.hold, n: c.step.n }, d: d && { hold: d.hold, n: d.step.n } });
  }
  // a card's event through a component's inputs: true then false, values, as Component Inputs sends a signal on
  {
    const cmdCards = [{ node: 'in', port: 'do', name: 'Add the task', when: 'When What to do: do', reach: new Set(['js', 'make']) }];
    const tr = [
      { seq: 1, t: 10, kind: 'value', fromNode: 'in', fromPort: 'title', toNode: 'js', toPort: 'in-title', value: '"Milk"' },
      { seq: 2, t: 10, kind: 'value', fromNode: 'in', fromPort: 'do', toNode: 'js', toPort: 'run', value: 'true' },
      { seq: 3, t: 10, kind: 'value', fromNode: 'in', fromPort: 'do', toNode: 'js', toPort: 'run', value: 'false' },
      { seq: 4, t: 11, kind: 'signal', fromNode: 'js', fromPort: 'out-go', toNode: 'make', toPort: 'store', value: '' }
    ];
    const cmdRuns = buildTimeline({ t0: 0, t1: 100, trace: tr, cards: cmdCards, label: (id) => id, pageNode: () => null, asker: () => null }).rows.filter((r) => r.lane === 'workflow');
    ok(cmdRuns.length === 1 && !cmdRuns[0].minor && cmdRuns[0].steps?.map((x) => x.node).join() === 'js,make' && JSON.stringify(cmdRuns[0].steps[0].ins) === JSON.stringify([{ port: 'in-title', value: '"Milk"' }]),
      "a card started by a signal into its component (a true out of Component Inputs) is a run with its steps, and the true and false are not among the step's inputs", cmdRuns);
  }
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

  // ---- STU-032: the screen as it was. A row clicked moves the playhead to it; the pane draws the probe's copy of
  // the page then. Graded against what the rows say happened (the list draws the task after the query's answer) and
  // against the app itself (at the end the copy says what the app says now)
  const replay = () => b.evaluate(`JSON.stringify((() => { const f = document.getElementById('tlsframe'), d = f.contentDocument; return { pane: !document.getElementById('tlscreen').hidden, at: document.getElementById('tlsat').textContent, note: document.getElementById('tlsnote').textContent, shot: f.dataset.shot, shown: !f.hidden, none: !document.getElementById('tlsnone').hidden, text: f.hidden || !d?.body ? '' : d.body.innerText, fields: f.hidden || !d?.body ? [] : [...d.body.querySelectorAll('input')].map(i => i.value), scripts: f.hidden || !d?.body ? 0 : d.body.querySelectorAll('script').length, ran: !!(f.contentWindow && f.contentWindow.Noodl), seen: { copy: getComputedStyle(f).display !== 'none', none: getComputedStyle(document.getElementById('tlsnone')).display !== 'none', big: (() => { const r = document.getElementById('tlbig').getBoundingClientRect(), p = document.getElementById('tlscreen').getBoundingClientRect(); return r.width > 30 && r.right <= p.right + 0.5; })() } }; })())`).then(JSON.parse);
  const loaded = async (shot) => { if (shot === '-1' || shot === undefined || shot === null) return; await b.until(`document.getElementById('tlsframe').dataset.shot === ${JSON.stringify(String(shot))} && document.getElementById('tlsframe').contentDocument?.readyState === 'complete' && document.getElementById('tlsframe').contentDocument.body?.innerText.length > 0`, 8000); await wait(150); };
  const atRow = async (sel) => { await b.evaluate(`${sel}.click()`); await wait(300); const shot = await b.evaluate(`document.getElementById('tlsframe').dataset.shot`); await loaded(shot); return replay(); };
  const nShots = await b.evaluate(`__ob.timeline.shots?.list.length || 0`);
  const end = await replay();
  const live = await b.evaluate(`${W}.document.body.innerText`);
  ok(nShots >= 2 && end.pane && end.shown && end.text.includes(TITLE) && end.seen.copy && !end.seen.none && end.seen.big && end.text.replace(/\s+/g, ' ').trim() === live.replace(/\s+/g, ' ').trim() && !end.ran,
    'the screen as it was: at the end of the recording the copy says what the app says now, drawn without running the app, on screen with nothing over it and its Larger button whole', { nShots, end: { ...end, text: end.text.slice(0, 120) }, live: live.slice(0, 120) });
  const before = dataRow && await atRow(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.lane === 'data' && Number(r.dataset.t) === ${dataRow.t})`);
  const after = listRow && await atRow(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.lane === 'screen' && Number(r.dataset.t) === ${listRow.t} && r.querySelector('small').textContent.includes(${JSON.stringify(TITLE)}))`);
  ok(before && after && !before.text.includes(TITLE) && before.at === `The screen at ${msText(dataRow.t)}` && after.text.includes(TITLE) && after.at === `The screen at ${msText(listRow.end ?? listRow.t)}` && !after.text.includes('enable JavaScript') && after.scripts === 0,
    "scrubbed to the Task query's start the list has no task on screen; to the row where the list draws it, it does (with its values, and none of the page's scripts or its no-JavaScript notice)", { before: before && { ...before, text: before.text.slice(0, 160) }, after: after && { ...after, text: after.text.slice(0, 160) } });
  // dragging on the axis moves the playhead to where it is let go, and the screen with it
  // pressed on the time labels under the lanes, so the press is never on a row's mark
  const track = JSON.parse(await b.evaluate(`JSON.stringify(document.querySelector('#tlaxis .track').getBoundingClientRect())`));
  const ticks = JSON.parse(await b.evaluate(`JSON.stringify(document.querySelector('#tlaxis .ticks').getBoundingClientRect())`));
  // let go halfway between two rows in the middle of the recording, so some rows are before it and some after
  const aim = JSON.parse(await b.evaluate(`JSON.stringify((() => { const tl = __ob.timeline, ts = [...new Set(tl.rows.filter((r) => !r.minor).map((r) => Math.round(r.t)))].sort((a, b) => a - b), k = Math.floor(ts.length / 2) - 1, t = (ts[k] + ts[k + 1]) / 2; return { t, f: (t - tl.from) / (tl.span - tl.from) }; })())`));
  const y = ticks.y + ticks.height / 2, x0 = track.x + 4, x1 = track.x + track.width * aim.f;
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 5; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * k) / 5, y, button: 'left', buttons: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y, button: 'left', clickCount: 1 });
  await wait(400);
  const dragged = JSON.parse(await b.evaluate(`JSON.stringify({ at: document.getElementById('tlsat').textContent, want: ${aim.t}, later: document.querySelectorAll('#tlrows .tlrow.later').length, rows: document.querySelectorAll('#tlrows .tlrow').length, left: document.getElementById('tlplay').style.left })`));
  const ms = Number(/at ([\d.]+) (m?s)/.exec(dragged.at)?.[1]) * (/ s$/.test(dragged.at) ? 1000 : 1);
  ok(Math.abs(ms - dragged.want) <= Math.max(3, dragged.want * 0.03) && Math.abs(parseFloat(dragged.left) - aim.f * 100) < 1 && dragged.later > 0 && dragged.later < dragged.rows,
    'dragging the playhead along the axis shows the screen at the moment it is let go, the rows after it marked as still to come', { ...dragged, aim });
  if (shots) {
    if (after) await atRow(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.lane === 'screen' && Number(r.dataset.t) === ${listRow.t} && r.querySelector('small').textContent.includes(${JSON.stringify(TITLE)}))`);
    await b.screenshot(join(here, '..', 'docs', 'look', 'stu-032-scrub.png'));
  }
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

  // ---- STU-032: the Add card's step, with what went in and what came out, and the screen when it ran
  const fn = files('Todo/Task list').nodes.find((n) => n.label === 'The title, if one was typed')?.id;
  const sent = JSON.parse(await b.evaluate(`JSON.stringify(${W}.Noodl.Navigation._noodlRuntime.context.getTraceEvents(0).filter(e => e.fromNode === ${JSON.stringify(fn)} && e.kind === 'value').map(e => e.fromPort + ' ' + e.value))`));
  if (addRow) await b.evaluate(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.link === ${JSON.stringify(addRow.link)}).querySelector('button.open').click()`);
  await wait(300);
  const step = JSON.parse(await b.evaluate(`JSON.stringify((() => { const s = document.querySelector('#tlrows .tlstep[data-node=${JSON.stringify(fn)}]'); return s && { t: Number(s.dataset.t), text: s.querySelector('.what').firstChild.textContent, ins: s.querySelector('[data-io=in]').textContent, outs: s.querySelector('[data-io=out]').textContent }; })())`));
  const q2 = JSON.stringify(SECOND);
  ok(fn && step && step.ins.includes(q2) && step.outs.includes(q2) && sent.some((v) => v.startsWith('out-text ') && v.includes(q2)) && /sent/.test(step.outs),
    "the Add card's step shows the typed title going in and coming out, and its signal sent on (the runtime's own trace has that value out of that node)", { fn, step, sent });
  const atStep = step && await (async () => { await b.evaluate(`document.querySelector('#tlrows .tlstep[data-node=${JSON.stringify(fn)}]').click()`); await wait(300); await loaded(await b.evaluate(`document.getElementById('tlsframe').dataset.shot`)); return replay(); })();
  const drawnAt = drawn && await atRow(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.lane === 'screen' && r.querySelector('small').textContent.includes(${q2}))`);
  ok(atStep && drawnAt && atStep.fields.includes(SECOND) && !atStep.text.includes(SECOND) && drawnAt.text.includes(SECOND),
    'scrubbed to that step, the screen has the title typed in the field and not yet in the list; at the row where the list draws it, it is in the list', { atStep: atStep && { ...atStep, text: atStep.text.slice(0, 100) }, drawnAt: drawnAt && { at: drawnAt.at, has: drawnAt.text.includes(SECOND) } });
  if (shots && atStep) { await b.evaluate(`document.querySelector('#tlrows .tlstep[data-node=${JSON.stringify(fn)}]').click()`); await wait(600); await b.screenshot(join(here, '..', 'docs', 'look', 'stu-032-step.png')); }

  // ---- STU-033: step mode. The second task's recording holds a run of the Add task command's card (a reusable the
  // Todo page places, with no element of its own, so only the timeline reaches it); its row arms step mode. A third
  // task added then pauses before each step. Graded against the app's own request log: the write is not made while
  // its step waits, and it is made once Next lets it go
  const cmd = files('Commands/Add task').nodes, cmdId = (l) => cmd.find((n) => n.label === l)?.id;
  const what = cmd.find((n) => n.type === 'Component Inputs')?.id, jsStep = cmdId('Is there anything to write?'), makeStep = cmdId('Add the task'), histStep = cmdId('Write the history line');
  const cmdRow = rows2.find((r) => r.lane === 'workflow' && r.link === `card:${what}.do`);
  if (cmdRow) await b.evaluate(`[...document.querySelectorAll('#tlrows .tlrow')].find(r => r.dataset.link === ${JSON.stringify(cmdRow.link)}).querySelector('button[data-step]').click()`);
  await wait(300);
  // step mode is the timeline's drawer while it is on: its header the card and the buttons, its rows the steps
  const bar = () => b.evaluate(`JSON.stringify((() => { const s = document.getElementById('stepper'), tag = document.querySelector('#sthead .tag'); return { shown: getComputedStyle(s).display !== 'none' && !document.getElementById('timeline').hidden, recording: getComputedStyle(document.getElementById('tlbody')).display !== 'none', title: document.getElementById('sttitle').textContent, tag: tag?.offsetWidth > 0 ? tag.textContent : '', note: document.getElementById('stnote').textContent, next: !document.getElementById('stnext').disabled, steps: [...s.querySelectorAll('.tlstep')].map(x => ({ n: Number(x.dataset.n), node: x.dataset.node, state: x.dataset.state, text: x.textContent, ins: x.querySelector('[data-io=in]')?.textContent ?? null, outs: x.querySelector('[data-io=out]')?.textContent ?? null })) }; })())`).then(JSON.parse);
  const armed = await bar();
  ok(cmdRow && armed.shown && !armed.recording && armed.title === cmdRow.text && /not real timing/i.test(armed.tag) && !armed.next && armed.steps.length === 0 && !/places it/.test(armed.note),
    "a recorded run's row arms step mode for its card: the drawer turns to it, names the card, says it is not real timing, and waits for the app", { cmdRow: cmdRow && { text: cmdRow.text, link: cmdRow.link }, what, armed, workflow: cmdRow ? undefined : rows2.filter((r) => r.lane === 'workflow').map((r) => `${r.link} ${r.text} | ${r.sub}`), loose: cmdRow ? undefined : JSON.parse(await b.evaluate(`JSON.stringify(__ob.timeline.rows.filter((r) => r.minor).map((r) => r.text).slice(0, 20))`)) });
  const creates = () => b.evaluate(`${W}.__studioLog.filter(e => e.kind === 'request' && e.method === 'POST' && /\\/classes\\/Task$/.test(e.path) && !(e.body && e.body._method)).length`);
  const heldNow = async (node) => { await b.until(`!!document.querySelector('#ststeps .tlstep[data-state=held][data-node=${JSON.stringify(node)}]')`, 10000).catch(() => null); await wait(250); return bar(); };
  const THIRD = 'Stepped through, one at a time', q3 = JSON.stringify(THIRD);
  const made0 = await creates();
  await typeInto(`[...${W}.document.querySelectorAll('input[type=text], input:not([type])')].find(i => i.offsetParent)`, THIRD);
  await wait(300);
  await b.evaluate(`[...${W}.document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Add' && e.offsetParent).click()`);
  const s1 = await heldNow(jsStep);
  const h1 = s1.steps.find((x) => x.state === 'held');
  ok(h1?.n === 1 && h1.node === jsStep && h1.ins?.includes(q3) && s1.next && (await creates()) === made0,
    'the third task added: step 1 waits before it runs, showing the typed title it will read; no task is written', { held: h1, made: (await creates()) - made0 });
  await b.clickSel('#stnext');
  const s2 = await heldNow(makeStep);
  const h2 = s2.steps.find((x) => x.state === 'held'), r1 = s2.steps.find((x) => x.n === 1);
  const made2 = await creates();
  ok(h2?.n === 2 && h2.ins?.includes(q3) && r1?.state === 'ran' && r1.outs?.includes(q3) && made2 === made0 && !(await b.evaluate(`${W}.document.body.innerText.includes(${q3})`)),
    "Next: step 1 ran and sent the title on; step 2, the record's creation, waits with that title among what it will read, and the app has still written nothing", { held: h2, ran: r1, made: made2 - made0 });
  await b.clickSel('#stnext');
  const s3 = await heldNow(histStep);
  const h3 = s3.steps.find((x) => x.state === 'held'), r2 = s3.steps.find((x) => x.n === 2);
  const newId = JSON.parse(await b.evaluate(`JSON.stringify(${W}.Noodl.Navigation._noodlRuntime.context.getTraceEvents(0).filter(e => e.fromNode === ${JSON.stringify(makeStep)} && e.fromPort === 'id' && e.kind === 'value').map(e => e.value).at(-1) ?? null)`));
  ok(h3?.n === 3 && (await creates()) === made0 + 1 && newId && h3.ins?.includes(newId) && r2?.outs?.includes(newId),
    "Next: the task is written (one create in the app's log), and step 3 waits holding the new record's id, the id the runtime's trace has out of step 2", { held: h3, ran: r2, newId, made: (await creates()) - made0 });
  if (shots) await b.screenshot(join(here, '..', 'docs', 'look', 'stu-033-step.png'));
  await b.clickSel('#strest');
  const listed = await b.until(`${W}.document.body.innerText.includes(${q3})`, 10000).catch(() => false);
  const rest = await bar();
  ok(listed && !rest.steps.some((x) => x.state === 'held') && !rest.next,
    '"Run the rest": the run goes on without pausing and the task is in the list', { listed, rest: { note: rest.note, steps: rest.steps.map((x) => `${x.n} ${x.state}`) } });
  await b.clickSel('#ststop'); await wait(300);
  const stopped = await bar();
  ok(!stopped.shown && stopped.recording && (await b.evaluate(`document.querySelectorAll('#tlrows .tlrow').length`)) > 0, 'Stop stepping gives the drawer back to the recording', stopped);
  // what was held reached its node whole: the signal's falling edge too, or the command's next run would never start
  const madeBefore = await creates();
  const after4 = await addTask('Added after stepping');
  ok(after4 && (await creates()) === madeBefore + 1, 'with step mode off, the next task is added the ordinary way: the command stepped through still runs', { after4, made: (await creates()) - madeBefore });

  // the Workflow tab's card arms it too, and puts the app in front, ready to use
  const header = todo.find((n) => n.type === '/Todo/Header')?.id;
  await b.clickSel('[data-tab=workflow]'); await wait(400);
  await b.evaluate(`document.querySelector('#events .row[data-node=${JSON.stringify(header)}][data-port=signOut]')?.click()`); await wait(300);
  await b.evaluate(`document.getElementById('stepthis')?.click()`); await wait(400);
  const fromCard = { ...(await bar()), use: await b.evaluate(`document.getElementById('previewmode').checked`), designShown: await b.evaluate(`!document.getElementById('design').hidden`) };
  ok(fromCard.shown && /Sign out|signOut|Header/i.test(fromCard.title) && fromCard.designShown && fromCard.use,
    "a card's Step through in the Workflow tab arms it and goes to the app, with Use the app on", fromCard);
  await b.clickSel('#ststop'); await wait(200);

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
