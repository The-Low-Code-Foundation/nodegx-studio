/**
 * NodeGX Studio — an expression read as a sentence (`sentence.mjs`, STU-098). Every piece says the words a person
 * reads, keeps where it is in the JavaScript, and a typed value written back is valid JavaScript that runs to that value.
 *
 *   node editor/sentence-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import { pieces, sentenceLine, removePiece, splice, literal, INSERTS } from './sentence.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const names = new Set(['room', 'tags', 'count', 'done']);
const isName = (n) => names.has(n);
const chip = (n) => ({ room: "Plant's room", tags: "Plant's tags", count: 'Count', done: "Task's done" }[n]);
const run = (text, vars) => new Function(...Object.keys(vars), `return (${text});`)(...Object.values(vars));

console.log('check: the sentence a person reads');
ok(sentenceLine('room === "Kitchen"', chip, isName) === "[Plant's room] is “Kitchen”", 'is, and a text in quotes a person reads', sentenceLine('room === "Kitchen"', chip, isName));
ok(sentenceLine('count >= 3 && done !== true', chip, isName) === '[Count] is at least 3 and [Task\'s done] is not yes', 'operators as words, a yes / no as yes', sentenceLine('count >= 3 && done !== true', chip, isName));
ok(sentenceLine('tags.includes("fern") || !done', chip, isName) === "[Plant's tags] contains “fern” or not [Task's done]", '.includes( … ) is "contains", its bracket not shown', sentenceLine('tags.includes("fern") || !done', chip, isName));
ok(sentenceLine('room === null', chip, isName) === "[Plant's room] is nothing", 'null is "nothing"');
ok(sentenceLine('count > 2 ? "many" : "few"', chip, isName) === 'if [Count] is more than 2 then “many” otherwise “few”', '? : is "if … then … otherwise"', sentenceLine('count > 2 ? "many" : "few"', chip, isName));

console.log('check: a value in a box of its kind, written back as JavaScript');
const p = pieces('room === "Kitchen" && count < 10 && done === false && when > new Date("2026-10-30")', isName);
ok(p.map((x) => x.kind).join(' ') === 'name word text word name word number word name word yesno word code word date', 'each piece is the kind it is', p.map((x) => x.kind).join(' '));
const text = p.find((x) => x.kind === 'text'), num = p.find((x) => x.kind === 'number'), yn = p.find((x) => x.kind === 'yesno'), date = p.find((x) => x.kind === 'date');
ok(text.value === 'Kitchen' && num.value === 10 && yn.value === false && date.value === '2026-10-30', 'the values read without their quotes', JSON.stringify([text.value, num.value, yn.value, date.value]));
const typed = 'He said "hi", it\'s \\ done';
const t2 = splice('room === "Kitchen"', text.from, text.to, literal.text(typed));
ok(run(t2, { room: typed }) === true && pieces(t2, isName)[2].value === typed, 'a text with quotes and a backslash typed in the box is one text, no quotes to keep', t2);
ok(literal.number('12.5') === '12.5' && literal.number('') === '0' && literal.number('abc') === '0', 'a number box never writes something that is not a number');
ok(run(literal.date('2026-11-02'), {}).toISOString().startsWith('2026-11-02') && /^new Date\("\d{4}-\d{2}-\d{2}"\)$/.test(literal.date('')), 'a date box writes a Date (today when empty)');
ok(pieces("room === 'Kitchen'", isName)[2].value === 'Kitchen', 'a text in single quotes reads the same');

console.log('check: a piece removed takes what it owns');
const c = pieces('tags.includes("fern") && done', isName);
ok(removePiece('tags.includes("fern") && done', c[1]) === 'tags "fern" && done', 'removing "contains" removes its closing bracket too', removePiece('tags.includes("fern") && done', c[1]));
ok(removePiece('room === "Kitchen"', pieces('room === "Kitchen"', isName)[1]) === 'room "Kitchen"', 'removing a word leaves one space');

console.log('check: what the buttons insert is JavaScript');
for (const [label, code] of INSERTS) {
  const filled = code.replace('()', '(1)').replace('?  :', '? 1 : 2');
  const expr = label === 'not' ? `${code}count` : label === 'contains' ? `tags${filled.replace('(1)', '("a")')}` : label === '( )' ? filled : label.startsWith('then') ? `count ${filled}` : `count ${filled} 2`;
  let good = true; try { run(expr, { count: 1, tags: ['a'] }); } catch { good = false; }
  ok(good, `"${label}" inserts ${code}`, expr);
}

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
