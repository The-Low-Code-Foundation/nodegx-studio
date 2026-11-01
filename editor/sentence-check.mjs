/**
 * NodeGX Studio — an expression read as a sentence (`sentence.mjs`, STU-098). Every piece says the words a person
 * reads, keeps where it is in the JavaScript, and a typed value written back is valid JavaScript that runs to that value.
 *
 *   node editor/sentence-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import { createRequire } from 'node:module';
import { pieces, sentenceLine, removePiece, splice, literal, INSERTS, WORDS, MEANS, teach, codeSegments, phraseReads } from './sentence.mjs';
import { TYPES, phrasesFor, applyPhrase } from './phrases.mjs';

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

console.log('check: Both, the teaching view: each piece lights its own code, and says what it does');
for (const t of ['room === "Kitchen" && count < 10', 'tags.includes("fern") || !done', 'count > 2 ? "many" : "few"', 'when > new Date("2026-10-30")', 'room   ===  null']) {
  const ps = pieces(t, isName), seg = codeSegments(t, ps);
  ok(seg.map((x) => x.text).join('') === t, `the segments join back to the code, nothing lost or doubled: ${t}`, JSON.stringify(seg));
  ok(ps.every((q, i) => seg.some((x) => x.piece === i && x.text === t.slice(q.from, q.to))) && seg.every((x) => x.piece !== null || /^\s*$/.test(x.text)), `every piece owns its characters and only spaces belong to none: ${t}`, JSON.stringify(seg));
}
{
  const t = 'tags.includes("fern")', ps = pieces(t, isName), seg = codeSegments(t, ps);
  const contains = ps.findIndex((q) => q.word === 'contains');
  ok(seg.filter((x) => x.piece === contains).map((x) => x.text).join('|') === '.includes(|)', '"contains" lights .includes( and the bracket that closes it', JSON.stringify(seg));
}
ok(Object.keys(WORDS).filter((k) => !MEANS[k]).length === 0, 'every operator Studio has a word for says what it does', Object.keys(WORDS).filter((k) => !MEANS[k]));
ok(teach(pieces('room === "x"', isName)[1]) === '“is” is === in the code: true when both sides are the same.', 'pointing at "is" says it is === and what that does', teach(pieces('room === "x"', isName)[1]));
ok(teach(pieces('room', isName)[0], chip) === "[Plant's room] is the name room in the code: the app hands the value to the expression under that name.", 'pointing at a chip says the name it has in the code', teach(pieces('room', isName)[0], chip));
ok(/true and false .* false/.test(teach(pieces('false', isName)[0])), 'a yes / no says it is true / false in the code');

console.log("check: a phrase from more… reads back as the words on its button (Richard, 2026-10-31: [0], slice())");
{
  const { rows } = createRequire(import.meta.url)('../vendor/phrasebook/rows.js');
  const byType = Object.fromEntries(TYPES.map((t) => [t, phrasesFor(rows, t)]));
  const reads = phraseReads(byType);
  const leaks = [], lost = [], back = [];
  for (const t of TYPES) for (const ph of byType[t]) {
    if (!ph.insert || ph.type !== t) continue;
    const r = applyPhrase('plants', 'plants', ph), known = new Set(['plants', ...Object.keys(r.slots)]);
    const ps = pieces(r.text, (n) => known.has(n), { reads, typeOf: (n) => (n === 'plants' ? t : null) });
    // what is left as code: only a record's field a phrase names (`name` in contains (a record)), never a bracket or a dot
    const code = ps.filter((q) => q.kind === 'code' && !/^[A-Za-z_$][\w$]*$|^[()]$/.test(q.code)) // a bracket that groups stays.map((q) => q.code);
    if (code.length) leaks.push(`${ph.bubble}: ${r.text} → ${code.join(' ')}`);
    const reading = reads.some((x) => x.bubble === ph.bubble && x.type === t);
    if (reading && !ps.some((q) => q.phrase === ph.bubble)) lost.push(`${ph.bubble}: ${sentenceLine(r.text, (n) => n, (n) => known.has(n), { reads, typeOf: () => t })}`);
    const seg = codeSegments(r.text, ps);
    if (seg.map((x) => x.text).join('') !== r.text || seg.some((x) => x.piece === null && !/^\s*$/.test(x.text))) back.push(ph.bubble);
  }
  ok(reads.length >= 50, `the phrasebook's phrases are templates (${reads.length})`, reads.length);
  ok(!leaks.length, 'no phrase leaves a bracket, a dot or a method in the sentence', leaks);
  ok(!lost.length, "each phrase reads back as its own button's words, its value's type deciding between phrases written alike", lost);
  ok(!back.length, 'every character of a phrase belongs to a piece in the teaching view', back);
  const isN = (n) => n === 'plants' || n === 'size';
  const line = (x, ty = 'List') => sentenceLine(x, (n) => n, isN, { reads, typeOf: () => ty });
  ok(line('plants[0]') === '[plants]:first item', '[0] on a list is :first item', line('plants[0]'));
  ok(line('plants.slice(4)') === '[plants]:items from # 4', '.slice(4) on a list is :items from # 4, the 4 in a number box', line('plants.slice(4)'));
  ok(line('plants.slice(0, 5)', 'String') === '[plants]:truncated to 5', '.slice(0, 5) on a text is :truncated to 5', line('plants.slice(0, 5)', 'String'));
  ok(line('plants[0].toUpperCase()') === '[plants]:first item:uppercase', 'a phrase on a phrase: the first item, uppercased', line('plants[0].toUpperCase()'));
  ok(line('plants[3]') === '[plants]:item # 3', 'an index that is not 0 is :item #', line('plants[3]'));
  const ps = pieces('plants.slice(0, 2) === size', isN, { reads, typeOf: () => 'List' });
  const ph = ps.find((q) => q.phrase);
  ok(removePiece('plants.slice(0, 2) === size', ph) === 'plants === size', 'removing a phrase leaves the value it followed', removePiece('plants.slice(0, 2) === size', ph));
  ok(/^“:items until #” is \.slice\(0,\) in the code/.test(teach(ph)), 'pointing at a phrase says its code and that it is Bubble\'s', teach(ph));
  ok(sentenceLine('plants[0]', (n) => n, isN) === '[plants] [ 0 ]', 'control: without the phrasebook the same code is read as code (what Richard saw)', sentenceLine('plants[0]', (n) => n, isN));
}

const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
