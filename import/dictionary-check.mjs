#!/usr/bin/env node
// dictionary-check.mjs — STU-044: the importer's expressions graded against the community's Bubble→Noodl dictionary.
// Builds a Bubble app with one Group per case of dictionary.mjs (the Group's data source is the case's expression), runs
// the real converter (app-to-nodegx.mjs) on it, evaluates the Expression each Group gets and compares it with the
// phrasebook's executed answer. Prints covered / wrong / missing per data type and exits 1 when a row is wrong and not in
// FILED below (a wrong row is fixed, or filed with the reason it stays).
//   node import/dictionary-check.mjs [--cases]
process.env.TZ = 'Europe/Paris'; // the phrasebook's dates are local; a grade that moves with the machine's zone is not a grade
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { kit } from '../lib/nodegx.mjs';
import { cases as casesFor } from './dictionary.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { SAMPLE, rows } = require(kit.phrasebook);
const showCases = process.argv.includes('--cases');

// Wrong rows that stay wrong, each with why. Empty is the goal; a row here is reported, not hidden.
const FILED = {
  122: "STU-044-FORMATNUMBER: \":formatted as\" a number keeps its settings in `properties` under keys no payload we hold shows (bubble_ex keeps them verbatim and names none), so the importer prints the number as it is; needs one real payload of a currency and a decimal format",
  123: 'STU-044-FORMATNUMBER, as 122',
};

const all = casesFor(SAMPLE);
const byRow = new Map(rows.map((r) => [r.id, r]));
for (const r of rows) if (!all.some((c) => c.row === r.id)) { console.error(`dictionary.mjs has no case for phrasebook row ${r.id} (${r.bubble})`); process.exit(1); }

// ---- the Bubble app: one Group per case that compiles
const operand = (v) => (v && typeof v === 'object' && 'v' in v && Object.keys(v).length === 1 ? { type: 'GetParamFromUrl', properties: { parameter_name: v.v } } : v);
const operands = (v) => (v && typeof v === 'object' && !Array.isArray(v) && !v.type ? ('v' in v && Object.keys(v).length === 1 ? operand(v) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, operands(x)]))) : v); // a marker at any depth of `properties` (a constraint's value)
const message = (op) => ({ type: 'Message', name: op.name, ...(op.args !== undefined ? { args: operand(op.args) } : {}), ...(op.props ? { properties: operands(op.props) } : {}) });
const elements = {};
const compiled = all.filter((c) => c.name && !c.none && !c.same);
compiled.forEach((c, i) => {
  c.label = `R${c.row}_${i}`;
  let ds;
  ds = { ...(c.root || { type: 'InjectedValue' }) }; let at = ds;
  if (!c.root || c.then) for (const op of c.root ? c.then : [c, ...(c.then || [])]) { at.next = message(op); at = at.next; }
  elements[`e${i}`] = { type: 'Group', id: `g${i}`, default_name: c.label, properties: { width: 100, height: 40, top: i * 40, left: 0, data_source: ds } };
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dictionary-check-'));
const exp = path.join(tmp, 'app.export.json'); const out = path.join(tmp, 'project');
fs.writeFileSync(exp, JSON.stringify({ pages: { p1: { type: 'Page', id: 'pg1', name: 'dictionary', properties: { width: 800, height: 4000 }, elements } } }));
const run = spawnSync(process.execPath, [path.join(here, 'app-to-nodegx.mjs'), exp, out], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (run.status !== 0) { console.error('the converter failed:\n' + (run.stderr || run.stdout).slice(-1500)); process.exit(1); }

// ---- every Expression the converter wrote, by the Group it belongs to
const exprs = new Map();
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f === 'nodes.json') {
      const j = JSON.parse(fs.readFileSync(p, 'utf8')); const list = Array.isArray(j) ? j : j.nodes || Object.values(j);
      for (const n of list) if (n.type === 'Expression') { const m = /^(R\d+_\d+): data = /.exec(n.label || ''); if (m) exprs.set(m[1], n.parameters.expression); }
    }
  }
})(path.join(out, 'components'));

// ---- grade
const same = (a, b) => {
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => same(a[k], b[k])); }
  return Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
};
const show = (v) => v instanceof Date ? `Date(${v.toISOString()})` : JSON.stringify(v);
class Unknown extends Error {}
const __bubble = (name) => { throw new Unknown(String(name)); };
for (const c of all) {
  if (c.none) { c.grade = 'none'; continue; }
  if (c.same) { c.grade = 'same'; continue; }
  if (!c.name) { c.grade = 'missing'; c.why = "Bubble's name for it is unmeasured and the importer has no operator for it"; continue; }
  const js = exprs.get(c.label);
  if (js === undefined) { c.grade = 'missing'; c.why = 'the converter wrote no Expression for it'; continue; }
  c.js = js;
  if (/__bubble\(/.test(js)) { c.grade = 'missing'; c.why = 'the importer does not compile it (it reports it for a person or an AI)'; continue; }
  let got;
  const searches = [...new Set(js.match(/\bsearch_\w+/g) || [])]; // a search's items: the case's subject
  try { got = new Function('thing', 'url_b', '__bubble', ...searches, `return (${js});`)(c.x, c.b, __bubble, ...searches.map(() => c.x)); }
  catch (e) { c.grade = e instanceof Unknown ? 'missing' : 'wrong'; c.why = e instanceof Unknown ? 'the importer does not compile it' : `throws: ${e.message}`; continue; }
  c.got = got;
  const ok = c.now ? got instanceof Date && Math.abs(got - Date.now()) < 60000 : c.expectOneOf ? c.expectOneOf.some((v) => same(v, got)) : same(c.expect, got);
  c.grade = ok ? 'covered' : 'wrong';
  if (!ok) c.why = `expected ${c.expectOneOf ? 'one of ' + c.expectOneOf.map(show).join(' | ') : show(c.expect)}, got ${show(got)}`;
}

// a row's grade: wrong if any case is, else missing if its first case is, else covered
const rowGrade = (id) => { const cs = all.filter((c) => c.row === id); if (cs[0].same) return rowGrade(cs[0].same); if (cs[0].none) return 'none'; if (cs.some((c) => c.grade === 'wrong')) return 'wrong'; if (cs[0].grade === 'missing') return 'missing'; return 'covered'; };
const types = [...new Set(rows.map((r) => r.type))];
const total = { covered: 0, wrong: 0, missing: 0, none: 0 };
console.log('type            rows  covered  wrong  missing  none-in-NodeGX');
for (const t of types) {
  const rs = rows.filter((r) => r.type === t); const n = { covered: 0, wrong: 0, missing: 0, none: 0 };
  for (const r of rs) n[rowGrade(r.id)]++;
  for (const k in n) total[k] += n[k];
  console.log(`${t.padEnd(16)}${String(rs.length).padStart(4)}  ${String(n.covered).padStart(7)}  ${String(n.wrong).padStart(5)}  ${String(n.missing).padStart(7)}  ${String(n.none).padStart(14)}`);
}
console.log(`${'all'.padEnd(16)}${String(rows.length).padStart(4)}  ${String(total.covered).padStart(7)}  ${String(total.wrong).padStart(5)}  ${String(total.missing).padStart(7)}  ${String(total.none).padStart(14)}`);
const ungrounded = rows.filter((r) => rowGrade(r.id) === 'covered' && all.some((c) => c.row === r.id && c.name && !c.grounded));
console.log(`\n${ungrounded.length} covered rows rest on a name no Bubble payload has shown (the importer's own): ${ungrounded.map((r) => `${r.id} ${r.bubble}`).join('; ')}`);

const wrong = all.filter((c) => c.grade === 'wrong');
if (wrong.length) { console.log('\nwrong:'); for (const c of wrong) console.log(`  ${c.row} ${byRow.get(c.row).bubble}${c.case ? ` (${c.case})` : ''} [${c.name}]: ${c.why}${FILED[c.row] ? ` — filed: ${FILED[c.row]}` : ''}\n      ${c.js}`); }
const missing = rows.filter((r) => rowGrade(r.id) === 'missing');
console.log(`\nmissing: ${missing.map((r) => `${r.id} ${r.bubble}`).join('; ')}`);
if (showCases) for (const c of all) console.log(`${c.row} ${c.case || ''} ${c.grade} ${c.name || ''} ${c.js || ''}`);

fs.rmSync(tmp, { recursive: true, force: true });
const unfiled = [...new Set(wrong.map((c) => c.row))].filter((id) => !FILED[id]);
console.log(unfiled.length ? `\nFAIL ${unfiled.length} wrong rows not filed: ${unfiled.join(', ')}` : `\nPASS ${total.covered} covered, ${total.wrong} wrong (filed), ${total.missing} missing, ${total.none} with no NodeGX answer`);
process.exit(unfiled.length ? 1 : 0);
