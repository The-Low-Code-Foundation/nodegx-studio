/**
 * NodeGX Studio — the page data format's gate (STU-010). On a copy of the todo-list template's Todo page: an item is
 * written as edits, saved to disk, read back from disk and must be the item that was written — a list item, a first
 * item with a condition whose value comes from the page, an update (list → first, renamed, a condition dropped) and a
 * removal; readers are counted off the wires (a Text, and a composed Expression counting as its element); an identical
 * question is found whatever the order of its conditions. Then NodeGX's own validator (validate_project through the
 * MCP server, skipped by name when packages/noodl-mcp/dist is not built) must say nothing about the item's nodes and
 * nothing new about the page. It cannot grade the value wires: Query Records takes ANY wired input name (the runtime keeps
 * an unknown one as a setting; the spec's `discover` ends in `GENERIC_SETTING`), so a wire to `qp-nope` validates clean
 * (measured). The wires are this gate's own round-trip; whether the app then asks the backend the right question is
 * `check:editor`'s, which runs it.
 *
 *   node editor/pagedata-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { applyEdit } from './edits.mjs';
import { createEdits, normalise, readFrom, readItems, readersOf, removeEdits, sameAs, signature, updateEdits, describe } from './pagedata.mjs';
import { nodegxRepo } from '../lib/nodegx.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };
const skip = (what, why) => console.log(`  skip ${what} — ${why}`);

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-pagedata-'));
const project = join(tmp, 'todo-list');
cpSync(join(nodegxRepo, 'templates/todo-list'), project, { recursive: true });
const dir = join(project, 'components/Pages/Todo');
const component = 'Pages/Todo';
const readDisk = () => ({ nodes: JSON.parse(readFileSync(join(dir, 'nodes.json'), 'utf8')), connections: JSON.parse(readFileSync(join(dir, 'connections.json'), 'utf8')) });
const writeDisk = (files) => { writeFileSync(join(dir, 'nodes.json'), JSON.stringify(files.nodes, null, 2)); writeFileSync(join(dir, 'connections.json'), JSON.stringify(files.connections, null, 2)); };
/** One gesture: the edits applied in order, then written once (as the page does through the store). */
const gesture = (list) => { let files = readDisk(); for (const e of list) files = applyEdit(files, e).files; writeDisk(files); };
const items = () => { const f = readDisk(); return readItems(f.nodes.nodes, f.connections.connections); };
const graph = () => { const f = readDisk(); return { nodes: f.nodes.nodes, conns: f.connections.connections }; };
const comparable = (i) => normalise({ ...i, where: i.where.map(({ port, ...c }) => c) });

/* ---------------- validate_project, before anything is written ---------------- */
const mcpBuilt = existsSync(join(nodegxRepo, 'packages/noodl-mcp/dist/noodl-mcp.cjs'));
async function validate() {
  const proc = spawn(process.execPath, [join(nodegxRepo, 'packages/noodl-mcp/bin/noodl-mcp.js'), project], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = ''; const waiting = new Map(); let seq = 0;
  proc.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } } catch { /* a log line */ } } });
  const call = (method, params) => new Promise((done) => { const id = ++seq; waiting.set(id, done); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'studio-pagedata-check', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  const r = await call('tools/call', { name: 'validate_project', arguments: {} });
  proc.kill();
  const text = (r.result?.content || []).map((c) => c.text || '').join('\n');
  return JSON.parse(text.replace(/^[^{]*/, '')).diagnostics || [];
}
const key = (d) => `${d.severity} ${d.code} ${d.location?.component} ${d.location?.nodeId} ${d.location?.port}`;
let before = null;
if (mcpBuilt) before = await validate();

try {
  const g0 = graph();
  const user = g0.nodes.find((n) => n.type === 'net.noodl.user.User');
  const openProject = g0.nodes.find((n) => n.label === 'Which project is open');
  const text = g0.nodes.find((n) => n.type === 'Text' && n.parent !== undefined);
  if (!user || !openProject || !text || !g0.nodes.some((n) => n.type === 'net.noodl.controls.button')) throw new Error('the todo template no longer has the nodes this gate reads (User, "Which project is open", a Text, a button)');
  const wiresBefore = g0.conns.length, nodesBefore = g0.nodes.length;

  console.log('check: a list item');
  const tasks = { name: 'tasks', collection: 'Task', where: [{ field: 'done', op: 'equalTo', value: false }], sort: [{ field: 'position', order: 'ascending' }], first: false, limit: 50 };
  const a = createEdits(tasks, { component });
  gesture(a.edits);
  let got = items();
  ok(got.length === 1 && isDeepStrictEqual(comparable(got[0]), normalise(tasks)), 'written, saved and read back from disk, it is the item that was written', got);
  ok(got[0].id === a.id && !got[0].recordId, 'one Query Records node and nothing else', got[0]);
  let q = graph().nodes.find((n) => n.id === a.id);
  ok(q.type === 'DbCollection2' && q.parent === undefined && q.label === 'tasks' && q.metadata?.pageData?.name === 'tasks', 'it is a Query Records node at the page root, named by its metadata', q);
  ok(q.parameters['runOnChange-collectionName'] === true && q.parameters['runOnChange-querySettings'] === true, 'it says it loads with the page and re-runs when its question changes (written true, so the NodeGX editor\'s migration cannot turn it off)', q.parameters);
  ok(isDeepStrictEqual(q.parameters.visualFilter, { type: 'and', conditions: [{ field: 'done', operator: 'equalTo', value: false, valueSource: 'static' }] }), 'its filter is in the shape the NodeGX editor writes', q.parameters.visualFilter);

  console.log('check: a first item whose condition reads the page');
  const open = { name: 'open project task', collection: 'Task', match: 'all', where: [{ field: 'status', op: 'equalTo', from: { node: openProject.id, port: 'value' } }, { field: 'title', op: 'containsIgnoreCase', value: 'call' }], sort: [{ field: 'position', order: 'descending' }], first: true };
  const b = createEdits(open, { component, y: 170 });
  gesture(b.edits);
  got = items();
  const gotOpen = got.find((i) => i.id === b.id);
  ok(gotOpen && isDeepStrictEqual(comparable(gotOpen), normalise(open)), 'read back from disk, it is the item that was written, its page value included', gotOpen);
  const gb = graph();
  q = gb.nodes.find((n) => n.id === b.id);
  ok(q.parameters.storageEnableLimit === true && q.parameters.storageLimit === 1, '"first" is a limit of 1', q.parameters);
  ok(gb.conns.some((c) => c.fromId === openProject.id && c.fromProperty === 'value' && c.toId === b.id && c.toProperty === 'qp-status') && q.parameters['runOnChange-qp-status'] === true, 'the page value comes in on a wire to qp-status, and a change to it re-runs the item', q.parameters);
  ok(gb.conns.some((c) => c.fromId === b.id && c.fromProperty === 'firstItemId' && c.toId === b.recordId && c.toProperty === 'modelId') && gb.nodes.find((n) => n.id === b.recordId)?.type === 'Model2', 'its first record is an Object node bound to firstItemId', gotOpen);

  console.log('check: readers');
  const field = readFrom(gotOpen, 'title', { component, nodes: gb.nodes });
  ok(field.node === b.recordId && field.port === 'prop-title' && field.text === "open project task's title" && field.edits.length === 1, 'a first item\'s field is read from its record node, which learns the field', field);
  gesture([...field.edits, { edit: 'connect', component, from: { node: field.node, port: field.port }, to: { node: text.id, port: 'text' } }]);
  // a composed expression reading the list's count, feeding another element: it counts as that element
  const other = graph().nodes.find((n) => n.type === 'net.noodl.controls.button');
  const exprId = 'pagedata-check-expr';
  const count = readFrom(items().find((i) => i.id === a.id), 'count', { component, nodes: graph().nodes });
  gesture([{ edit: 'add_node', component, id: exprId, type: 'Expression', label: 'n of tasks', parameters: { expression: 'n + " to do"' }, metadata: { composedFor: { node: other.id, port: 'label' } } }, { edit: 'connect', component, from: { node: count.node, port: count.port }, to: { node: exprId, port: 'n' } }, { edit: 'connect', component, from: { node: exprId, port: 'result' }, to: { node: other.id, port: 'label' } }]);
  let gr = graph();
  got = items();
  ok(isDeepStrictEqual(readersOf(got.find((i) => i.id === b.id), gr.nodes, gr.conns), [text.id]), 'the first item has one reader: the Text wired from its record', readersOf(got.find((i) => i.id === b.id), gr.nodes, gr.conns));
  ok(isDeepStrictEqual(readersOf(got.find((i) => i.id === a.id), gr.nodes, gr.conns), [other.id]), 'the list item has one reader: the button whose label its composed expression feeds', readersOf(got.find((i) => i.id === a.id), gr.nodes, gr.conns));
  ok(got.find((i) => i.id === b.id).fields.includes('title'), 'the record node\'s fields are read back', got.find((i) => i.id === b.id));

  console.log('check: the same question is one item');
  const reordered = { ...open, name: 'another name', where: [...open.where].reverse() };
  ok(sameAs(got, reordered)?.id === b.id, 'an item asking the same thing (conditions in another order, another name) is found', signature(reordered));
  ok(!sameAs(got, { ...open, sort: [{ field: 'position', order: 'ascending' }] }), 'one sorted the other way is a different item');
  ok(!sameAs(got, { ...open, where: [open.where[0], { ...open.where[1], value: 'mail' }] }), 'one with another typed value is a different item');
  ok(!sameAs(got, { ...open, where: [{ ...open.where[0], from: { node: user.id, port: 'id' } }, open.where[1]] }), 'one whose value comes from somewhere else on the page is a different item');
  ok(describe(got.find((i) => i.id === b.id), (f) => `${gr.nodes.find((n) => n.id === f.node)?.label}'s ${f.port}`) === 'first Task where status is ⟨Which project is open\'s value⟩ and title contains "call", by position, descending', 'it reads as a sentence', describe(got.find((i) => i.id === b.id)));

  console.log('check: an update');
  const cur = got.find((i) => i.id === b.id);
  const next = { ...cur, name: 'calls', first: false, limit: 20, where: [cur.where[1]] };
  gesture(updateEdits(cur, next, { component, ...graph() }));
  got = items();
  const upd = got.find((i) => i.id === b.id);
  gr = graph();
  ok(upd && isDeepStrictEqual(comparable(upd), normalise(next)), 'renamed, made a list and a condition dropped, it reads back as the new item', upd);
  ok(!gr.nodes.some((n) => n.id === b.recordId) && !gr.conns.some((c) => c.fromId === b.recordId || c.toId === b.recordId), 'the record node went, and its wires with it (the Text no longer reads a field that is gone)', b.recordId);
  ok(!gr.conns.some((c) => c.toId === b.id && c.toProperty === 'qp-status') && !('runOnChange-qp-status' in gr.nodes.find((n) => n.id === b.id).parameters), 'the dropped condition\'s wire and its run-on-change box went', gr.nodes.find((n) => n.id === b.id).parameters);
  const back = updateEdits(upd, { ...upd, first: true, where: open.where }, { component, ...gr });
  gesture(back);
  got = items();
  ok(got.find((i) => i.id === b.id)?.recordId && got.find((i) => i.id === b.id).where[0].from?.node === openProject.id, 'and back to first, with its page value wired again', got.find((i) => i.id === b.id));

  console.log('check: a reusable\'s item asks while that copy is shown (R8, STU-014)');
  const rc = 'Projects/Money bar', rdir = join(project, 'components', rc);
  const rRead = () => ({ nodes: JSON.parse(readFileSync(join(rdir, 'nodes.json'), 'utf8')), connections: JSON.parse(readFileSync(join(rdir, 'connections.json'), 'utf8')) });
  const rGesture = (list) => { let files = rRead(); for (const e of list) files = applyEdit(files, e).files; writeFileSync(join(rdir, 'nodes.json'), JSON.stringify(files.nodes, null, 2)); writeFileSync(join(rdir, 'connections.json'), JSON.stringify(files.connections, null, 2)); };
  const rGraph = () => { const f = rRead(); return { nodes: f.nodes.nodes, conns: f.connections.connections }; };
  const r0 = rGraph();
  if (!r0.nodes.some((n) => n.id === 'mbBar') || !r0.nodes.some((n) => n.id === 'mbIn')) throw new Error('the todo template\'s Money bar no longer has mbBar / mbIn');
  const dayTasks = { name: 'day tasks', collection: 'Task', where: [{ field: 'day', op: 'equalTo', from: { node: 'mbIn', port: 'id' } }], sort: [], first: false };
  const c = createEdits(dayTasks, { component: rc, root: 'mbBar' });
  rGesture(c.edits);
  let rg = rGraph(), ri = readItems(rg.nodes, rg.conns);
  const rItem = ri.find((i) => i.id === c.id);
  ok(rItem && rItem.whenShown && isDeepStrictEqual(comparable(rItem), normalise({ ...dayTasks, whenShown: true })), 'read back from the reusable\'s files, it is the item that was written, marked as asking while shown', rItem);
  const rq = rg.nodes.find((n) => n.id === c.id);
  const boxes = Object.entries(rq.parameters).filter(([k]) => k.startsWith('runOnChange-'));
  ok(boxes.length === 3 && boxes.every(([, v]) => v === false), 'its query never runs by itself: every run-on-change box is off (collection, question, its page value)', Object.fromEntries(boxes));
  const has = (from, fp, to, tp) => rg.conns.some((w) => w.fromId === from && w.fromProperty === fp && w.toId === to && w.toProperty === tp);
  const sw = rg.nodes.find((n) => n.id === rItem?.shownId), ask = rg.nodes.find((n) => n.id === rItem?.askId);
  ok(sw?.type === 'Switch' && has('mbBar', 'didMount', sw.id, 'on') && has('mbBar', 'willUnmount', sw.id, 'off'), 'a Switch is on while the reusable\'s top element is mounted (Did Mount on, Will Unmount off)', sw);
  ok(ask?.type === 'Expression' && ask.parameters.expression === 'shown === true && [v_day].length > 0' && has(sw?.id, 'state', ask.id, 'shown') && has('mbIn', 'id', ask.id, 'v_day') && has(ask.id, 'isTrueEv', c.id, 'storageFetch') && has('mbIn', 'id', c.id, 'qp-day'), 'the ask reads the switch and the item\'s page value, and its On True Event is the query\'s Do', ask?.parameters);
  rGesture(updateEdits(rItem, { ...rItem, where: [...rItem.where, { field: 'mark', op: 'equalTo', from: { node: 'mbIn', port: 'mark' } }] }, { component: rc, ...rGraph() }));
  rg = rGraph();
  const askU = rg.nodes.find((n) => n.id === rItem.askId);
  ok(askU.parameters.expression === 'shown === true && [v_day, v_mark].length > 0' && rg.conns.some((w) => w.fromId === 'mbIn' && w.fromProperty === 'mark' && w.toId === askU.id && w.toProperty === 'v_mark') && rg.nodes.find((n) => n.id === c.id).parameters['runOnChange-qp-mark'] === false, 'a condition added with a page value: the ask reads it too, and the query still never runs by itself', askU.parameters);
  ok(readItems(rg.nodes, rg.conns).find((i) => i.id === c.id)?.whenShown, 'an update keeps it asking while shown');
  rGesture(removeEdits(readItems(rg.nodes, rg.conns).find((i) => i.id === c.id), { component: rc }));
  rg = rGraph();
  ok(rg.nodes.length === r0.nodes.length && rg.conns.length === r0.conns.length, 'removed, the reusable has the nodes and wires it started with (the switch and the ask went with the item)', { nodes: [r0.nodes.length, rg.nodes.length], wires: [r0.conns.length, rg.conns.length] });
  rGesture(createEdits(dayTasks, { component: rc, root: 'mbBar' }).edits); // kept for the validator below
  const rKept = readItems(rGraph().nodes, rGraph().conns)[0];

  if (mcpBuilt) {
    console.log('check: NodeGX\'s validator');
    const after = await validate();
    const mine = new Set([a.id, b.id, got.find((i) => i.id === b.id).recordId, exprId, rKept.id, rKept.shownId, rKept.askId]);
    const onMine = after.filter((d) => mine.has(d.location?.nodeId) && d.severity !== 'info');
    ok(onMine.length === 0, 'validate_project says nothing about the items\' nodes', onMine.map((d) => `${d.severity} ${d.code}: ${d.message}`));
    const was = new Set(before.map(key));
    const fresh = after.filter((d) => d.severity === 'error' && !was.has(key(d)));
    ok(fresh.length === 0, 'and no new error anywhere in the project', fresh.map((d) => `${d.code}: ${d.message}`));
  } else skip('validate_project', 'packages/noodl-mcp/dist is not built');

  console.log('check: removal');
  for (const i of items()) gesture(removeEdits(i, { component }));
  gesture([{ edit: 'remove_node', component, id: exprId }]);
  gr = graph();
  ok(items().length === 0 && !gr.nodes.some((n) => n.type === 'Model2' && n.metadata?.pageDataRecord), 'removing both leaves no item and no record node', items());
  ok(gr.nodes.length === nodesBefore && gr.conns.length === wiresBefore + 0, 'and the page has the nodes and wires it started with', { nodes: [nodesBefore, gr.nodes.length], wires: [wiresBefore, gr.conns.length] });
} catch (err) {
  ok(false, 'the gate ran to the end', err.stack);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
