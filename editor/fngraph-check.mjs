/**
 * NodeGX Studio — P127 BKO-004: every cloud function NodeGX ships, laid out by ./fngraph.mjs, with no browser.
 *
 * Reads each template's `components/__cloud__/` from a NodeGX checkout (NODEGX_REPO, or the sibling ../OpenNoodl):
 * the training app's 27 functions and its helpers, and gram, marketplace, members-area and nightbook. For each one:
 * it starts in the first column, its answers are in the last, no function is a single box, every node is placed once,
 * and no wire runs right to left except a loop. The look is graded in Chrome by functions-check.mjs.
 *
 *   node editor/fngraph-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOUD, REQUEST, RESPONSE, functionLayout, functionList, helperKey, requestAsks, responseWords, scriptTableNames, touchesWords } from './fngraph.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : resolve(here, '..', '..', 'OpenNoodl');
const TEMPLATES = ['digital-bricks-training', 'gram', 'marketplace', 'members-area', 'nightbook'];
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); if (!cond || process.argv.includes('-v')) console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
// a guess at a signal from the port's name; Studio asks its node library instead
const SIGNALS = /^(send|run|do|fetch|store|create|save|delete|done|success|failed|out-done|out-failed|run-done|call|received|stored|fetched|created|deleted)$/i;
const guess = (c) => SIGNALS.test(c.fromProperty) || SIGNALS.test(c.toProperty);

if (!existsSync(join(repo, 'templates', TEMPLATES[0]))) {
  console.log(`fngraph-check: no NodeGX checkout at ${repo} (set NODEGX_REPO): nothing to read`);
  process.exit(1);
}

let fns = 0, endpoints = 0, helpers = 0, cols = 0, nodesSeen = 0;
for (const t of TEMPLATES) {
  const root = join(repo, 'templates', t, 'components');
  const keys = [];
  (function walk(d, rel) { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const r = rel ? `${rel}/${e.name}` : e.name; if (existsSync(join(d, e.name, 'nodes.json'))) keys.push(r); walk(join(d, e.name), r); } })(join(root, '__cloud__'), '__cloud__');
  const read = (key, f) => JSON.parse(readFileSync(join(root, key, f), 'utf8'));
  const list = functionList(keys, (k) => read(k, 'nodes.json').nodes);
  ok(list.length === keys.length && list.every((f, i) => !f.endpoint || list.slice(0, i).every((g) => g.endpoint)), `${t}: ${list.length} functions listed, endpoints first`);
  if (t === 'digital-bricks-training') ok(list.filter((f) => f.endpoint).length === 27, 'the training app has its 27 functions', list.filter((f) => f.endpoint).length);
  for (const f of list) {
    fns++; f.endpoint ? endpoints++ : helpers++;
    const nodes = read(f.key, 'nodes.json').nodes, conns = read(f.key, 'connections.json').connections ?? [];
    const L = functionLayout(nodes, conns, guess);
    const at = new Map(); L.columns.forEach((c, i) => c.forEach((id) => at.set(id, i)));
    const all = L.columns.flat();
    const drawn = nodes.filter((n) => n.type !== 'Comment');
    nodesSeen += drawn.length; cols += L.columns.length;
    const name = `${t}/${f.name}`;
    ok(L.columns.length >= 2 && all.length >= 2, `${name}: drawn as more than one box`, { columns: L.columns.length, nodes: all.length });
    ok(all.length === drawn.length && new Set(all).size === all.length, `${name}: every node placed once`, { placed: all.length, nodes: drawn.length });
    const start = nodes.find((n) => n.type === (f.endpoint ? REQUEST : 'Component Inputs'));
    ok(!start || at.get(start.id) === 0 && L.columns[0][0] === start.id, `${name}: starts at the top of the first column`);
    const last = L.columns.length - 1;
    ok(L.answers.every((id) => at.get(id) === last), `${name}: its answers are in the last column`);
    const back = L.wires.filter((w) => at.get(w.to) <= at.get(w.from) && !(nodes.find((n) => n.id === w.to)?.type === REQUEST));
    ok(back.length === 0 || back.every((w) => at.get(w.to) < at.get(w.from)), `${name}: no wire runs within one column`, back.slice(0, 3));
    // a refusal is said as one, with its message or "a message the function makes"; an answer names what it sends
    for (const r of nodes.filter((n) => n.type === RESPONSE)) {
      const w = responseWords(r, conns), p = r.parameters || {};
      ok(w.refusal === (p.status === 'failure') && (w.refusal ? w.message === (p.errorMessage ?? (conns.some((c) => c.toId === r.id && c.toProperty === 'errorMessage') ? null : '')) : w.sends.length === String(p.params || '').split(',').filter((s) => s.trim()).length), `${name}: its Response "${r.label || r.id}" reads as ${w.refusal ? 'a refusal' : 'an answer'}`, w);
    }
    if (f.endpoint) ok(Array.isArray(requestAsks(start)), `${name}: its asks read`);
    for (const h of L.helpers) ok(keys.includes(h), `${name}: the helper it places (${h}) is a function in the app`);
  }
}
ok(helperKey('/#__cloud__/shared/Caller learner') === '__cloud__/shared/Caller learner' && helperKey('/Data/Lesson') === null, 'a placed helper reads as its key, a reusable does not');
ok(JSON.stringify(scriptTableNames(`const a = await Noodl.Records.query('Lesson', {}); Records.create("Note", x); Records.save({ className: 'Thread', id }); Records.query(T); Records.frob('Nope'); Records.query('_User')`)) === JSON.stringify(['Lesson', 'Note', 'Thread']),
  'a script names its tables in a records call: query, create, a className; not a variable, an unknown call or a system table');
ok(JSON.stringify(touchesWords([{ table: 'Lesson', hows: ['reads'] }, { table: 'Note', hows: ['creates', 'changes'] }, { table: 'X', hows: ['mentions'] }])) === JSON.stringify(['reads Lesson', 'creates Note', 'changes Note']), 'touches read as the map words them, mentions left out');
{
  // a loop does not run away, and a node no wire reaches is still drawn
  const L = functionLayout([{ id: 'r', type: REQUEST }, { id: 'a', type: 'JavaScriptFunction' }, { id: 'b', type: 'JavaScriptFunction' }, { id: 'z', type: 'Expression' }, { id: 's', type: RESPONSE }],
    [{ fromId: 'r', fromProperty: 'x', toId: 'a', toProperty: 'x' }, { fromId: 'a', fromProperty: 'y', toId: 'b', toProperty: 'y' }, { fromId: 'b', fromProperty: 'y', toId: 'a', toProperty: 'z' }, { fromId: 'b', fromProperty: 'done', toId: 's', toProperty: 'send' }]);
  ok(JSON.stringify(L.columns) === JSON.stringify([['r', 'z'], ['a'], ['b'], ['s']]) && JSON.stringify(L.loose) === '["z"]', 'a loop is laid out once; a loose node is drawn in the first column', L.columns);
}
console.log(`fngraph-check: ${fns} functions (${endpoints} called, ${helpers} helpers), ${nodesSeen} nodes, ${(cols / fns).toFixed(1)} columns on average`);
const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
