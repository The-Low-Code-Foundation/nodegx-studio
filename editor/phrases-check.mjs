/**
 * NodeGX Studio — the composer's typed follow-ups (`phrases.mjs`, STU-052), graded against the phrasebook. Every type
 * offers exactly its own rows and the Any rows; every phrase that inserts is inserted on a chip, its slots given the
 * phrasebook's own values, and the text RUN to the phrasebook's executed answer (the Expression node's Math names —
 * round, floor, min… — are in scope, as they are in the app).
 *
 *   node editor/phrases-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { kit } from '../lib/nodegx.mjs';
import { TYPES, dictionaryType, phrasesFor, applyPhrase } from './phrases.mjs';

const require = createRequire(import.meta.url);
const { rows } = require(kit.phrasebook);
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const MATH = ['min', 'max', 'round', 'floor', 'ceil', 'abs', 'random', 'sqrt', 'pow'];
const run = (text, vars) => new Function(...MATH, ...Object.keys(vars), `return (${text});`)(...MATH.map((m) => Math[m]), ...Object.values(vars));
const same = (a, b) => {
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object') { const k = Object.keys(a); return k.length === Object.keys(b).length && k.every((x) => same(a[x], b[x])); }
  return Object.is(a, b);
};
const show = (v) => (v instanceof Date ? `Date(${v.toISOString()})` : JSON.stringify(v));

console.log('check: each type offers exactly its own rows and the Any rows');
const types = [...new Set(rows.map((r) => r.type))];
ok(types.length === 7 && types.every((t) => TYPES.includes(t)), `the phrasebook's seven types are the composer's (${types.join(', ')})`);
for (const t of TYPES) {
  const offered = phrasesFor(rows, t).map((p) => p.id).sort();
  const want = rows.filter((r) => r.type === t || (r.type === 'Any' && !rows.some((o) => o.type === t && t !== 'Any' && o.bubble === r.bubble))).map((r) => r.id).sort();
  ok(same(offered, want), `${t}: ${offered.length} rows offered`, `offered ${offered} want ${want}`);
}

console.log('check: every inserted phrase runs to the phrasebook\'s answer');
const counts = {};
for (const r of rows) {
  const p = phrasesFor(rows, r.type).find((x) => x.id === r.id);
  const c = (counts[r.type] ||= { insert: 0, instead: 0 });
  if (!p.insert) { c.instead++; continue; }
  c.insert++;
  const out = applyPhrase('chip', 'chip', p);
  const vars = { chip: (r.fixture.vars || r.fixture.inputs)[p.insert.subject] };
  for (const [slot, v] of Object.entries(out.slots)) vars[slot] = (r.fixture.vars || r.fixture.inputs)[v];
  let got, err;
  try { got = run(out.text, vars); } catch (e) { err = e.message; }
  const want = r.fixture.expect !== undefined ? (p.output ? r.fixture.expect[p.output] : r.fixture.expect) : undefined;
  const pass = err === undefined && (r.fixture.expectOneOf ? r.fixture.expectOneOf.some((v) => same(v, got)) : same(want, got));
  ok(pass, `${r.id} ${r.type} ${r.bubble}: ${out.text}`, err ?? `expected ${show(want)}, got ${show(got)}`);
}
for (const [t, c] of Object.entries(counts)) console.log(`  ${t}: ${c.insert} insert, ${c.instead} offered as what to do instead (a node, a Function, or no NodeGX answer)`);

console.log('check: a phrase goes where the chip is, and slots are named for what they hold');
{
  const round = phrasesFor(rows, 'Integer').find((p) => p.bubble === ':rounded to');
  ok(applyPhrase('total + price', 'price', round).text === 'total + round(price)', 'the chip inside a sum is the one wrapped', applyPhrase('total + price', 'price', round).text);
  const is = phrasesFor(rows, 'String').find((p) => p.bubble === '... is ...');
  const a = applyPhrase('name && ok', 'name', is);
  ok(a.text === '(name === text) && ok' && same(Object.keys(a.slots), ['text']), 'a comparison is bracketed, its other side a slot called text', a.text);
  const b = applyPhrase('text', 'text', is);
  ok(/^\(text === text2\)$/.test(b.text), 'a slot never takes a name the text already has', b.text);
  const c2 = applyPhrase('state.toUpperCase() + " world"', 'state', is);
  ok(c2.text === '(state.toUpperCase() === text) + " world"', "a follow-up takes the chain the chip already ends with (Bubble's \"state :uppercase is …\")", c2.text);
  const up = phrasesFor(rows, 'String').find((p) => p.bubble === ':uppercase');
  ok(applyPhrase('a.slice(0, f(1, ")")) + 1', 'a', up).text === 'a.slice(0, f(1, ")")).toUpperCase() + 1', 'brackets in the chain are balanced, a bracket inside a text is not counted', applyPhrase('a.slice(0, f(1, ")")) + 1', 'a', up).text);
  const count = phrasesFor(rows, 'List').find((p) => p.bubble === ':count');
  ok(applyPhrase('items.length + items', 'items', count).text === 'items.length + items.length', 'the last bare occurrence is the one wrapped (not the one after a dot)', applyPhrase('items.length + items', 'items', count).text);
  const fmt = phrasesFor(rows, 'List').find((p) => p.bubble === ':format as text');
  ok(applyPhrase('people', 'people', fmt).text === 'people.map((item) => item.name).join(text)', "a property after a dot is not renamed (item.name stays)", applyPhrase('people', 'people', fmt).text);
}

console.log('check: a port\'s type reads as the dictionary\'s');
ok(dictionaryType('string') === 'String' && dictionaryType('number') === 'Integer' && dictionaryType('array') === 'List' && dictionaryType('date') === 'Date' && dictionaryType('*') === 'Any' && dictionaryType({ name: 'boolean' }) === 'Any', 'string, number, array, date, anything else');

const pass = results.filter(Boolean).length;
console.log(`\n${pass === results.length ? 'PASS' : 'FAIL'} ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
