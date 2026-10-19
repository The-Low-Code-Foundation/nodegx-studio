/**
 * NodeGX Studio — the Conditional tab's rules (`rules.mjs`, STU-051). The importer's own shapes (Bubble's "when the page
 * is narrower than 768" rules on the template app, a showing rule, a value that is a size object) are read as arms and
 * written back unchanged; the edits the tab makes (a value, the otherwise, a condition, an arm out, a rule added) give
 * the text that runs as asked — each is evaluated, so "16 when narrow" is graded by what the expression returns.
 *
 *   node editor/rules-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import { readRule, writeRule, rulesOf, withoutArm, withValue, withCondition, addArm, valueOf, literal, conditionKey } from './rules.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };
const run = (text, vars) => new Function(...Object.keys(vars), `return (${text});`)(...Object.values(vars));

console.log('check: the importer\'s rules read and write back');
{
  const margin = '((pageWidth < 768)) ? 16 : 64';
  const r = readRule(margin, 'marginTop');
  ok(r && r.arms.length === 1 && r.arms[0].when === 'pageWidth < 768' && r.arms[0].then === '16' && r.otherwise === '64' && !r.shows, 'a margin rule: when, then, otherwise', r);
  ok(run(writeRule(r), { pageWidth: 500 }) === 16 && run(writeRule(r), { pageWidth: 1600 }) === 64, 'written back, it runs as before (16 narrow, 64 wide)');
  const size = '((pageWidth < 504)) ? {"value":100,"unit":"%"} : {"value":100,"unit":"%"}';
  const s = readRule(size, 'width');
  ok(s && valueOf(s.arms[0].then).value?.unit === '%' && valueOf(s.otherwise).value?.value === 100, 'a size object as the value (the colon inside it is not the otherwise)', s);
  const hide = readRule('!((pageWidth < 992))', 'mounted');
  ok(hide?.shows && hide.arms[0].when === 'pageWidth < 992' && hide.arms[0].then === 'false', 'a hiding rule on Mounted: hidden when narrower than 992', hide);
  const show = readRule('((pageWidth < 992))', 'mounted');
  ok(show?.shows && show.arms[0].then === 'true', 'a showing rule: shown when narrower than 992', show);
  ok(writeRule(hide) === '!(pageWidth < 992)' && run(writeRule(hide), { pageWidth: 500 }) === false, 'the hiding rule written back still hides when narrow');
  ok(readRule('((pageWidth < 992))', 'marginTop') === null && readRule('a + b', 'width') === null && readRule('(a + b) * 2', 'width') === null, 'a computed value is not a rule (outside Visible/Mounted)');
  const inner = readRule('(a) ? (b ? 1 : 2) : 3', 'width');
  ok(inner?.arms.length === 1 && valueOf(inner.arms[0].then).code === '(b ? 1 : 2)' && inner.otherwise === '3', 'a bracketed choice inside a value is that arm\'s value, shown as code', inner);
  ok(readRule('(x === "a:b?") ? "c" : "d"', 'text')?.arms[0].then === '"c"', 'a colon or ? inside a string is skipped');
}
console.log('check: one card per condition');
{
  const names = new Map([['pageWidth', 'scr_1.width']]);
  const other = new Map([['w', 'scr_1.width']]);
  const cards = rulesOf([
    { id: 'e1', port: 'marginTop', text: '((pageWidth < 768)) ? 16 : 64', names },
    { id: 'e2', port: 'width', text: '((w < 768)) ? {"value":100,"unit":"%"} : {"value":50,"unit":"%"}', names: other },
    { id: 'e3', port: 'fontSize', text: '((pageWidth < 504)) ? 24 : 32', names },
    { id: 'e4', port: 'text', text: 'a + b', names: new Map() }]);
  ok(cards.length === 2 && cards[0].parts.map((p) => p.port).join() === 'marginTop,width' && cards[1].parts[0].port === 'fontSize', 'the same condition on two Expressions (two names, one source) is one card; another is a second; a value is none', cards.map((c) => [c.key, c.parts.map((p) => p.port)]));
  ok(conditionKey('a < "a"', new Map([['a', 'n.p']])) === '{n.p}<"a"', 'a name inside a string is not a source');
}
console.log('check: the edits the tab makes');
{
  const t = '((pageWidth < 768)) ? 16 : 64';
  ok(run(withValue(t, 'marginTop', 0, '24'), { pageWidth: 500 }) === 24, 'the value when it holds changed: 24 narrow');
  ok(run(withValue(t, 'marginTop', -1, '48'), { pageWidth: 1600 }) === 48, 'the otherwise changed: 48 wide');
  const c = withCondition(t, 'marginTop', 0, '(pageWidth < 1000)');
  ok(run(c, { pageWidth: 900 }) === 16 && run(c, { pageWidth: 1100 }) === 64, 'the condition changed: narrower than 1000 now', c);
  ok(withoutArm(t, 'marginTop', 0) === null, 'its only arm out: the Expression goes');
  const two = addArm(t, 'marginTop', 'pageWidth < 400', '8');
  ok(run(two, { pageWidth: 300 }) === 8 && run(two, { pageWidth: 500 }) === 16 && run(two, { pageWidth: 1600 }) === 64, 'a second rule on the same property chains, the newest first (8 under 400, 16 under 768, else 64)', two);
  ok(run(withoutArm(two, 'marginTop', 1), { pageWidth: 500 }) === 64, 'the older arm out: the newer stays, the otherwise is kept');
  const fresh = addArm(undefined, 'paddingTop', 'busy', literal(30), 12);
  ok(run(fresh, { busy: true }) === 30 && run(fresh, { busy: false }) === 12, 'a new rule on a property with none: the current value is the otherwise', fresh);
  const hid = addArm(undefined, 'visible', 'busy', 'false');
  ok(run(hid, { busy: true }) === false && run(hid, { busy: false }) === true && readRule(hid, 'visible').shows, 'a new hiding rule on Visible', hid);
  const both = addArm(hid, 'visible', 'done', 'false');
  ok(run(both, { busy: false, done: true }) === false && run(both, { busy: true, done: false }) === false && run(both, { busy: false, done: false }) === true, 'a second hiding rule on Visible: hidden when either holds', both);
}

const pass = results.filter(Boolean).length;
console.log(`check: ${pass === results.length ? 'PASS' : 'FAIL'} ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
