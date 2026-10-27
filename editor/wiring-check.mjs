/**
 * NodeGX Studio — STU-084: every page and component NodeGX ships, laid out by ./wiring.mjs, with no browser; and the
 * shape Richard hit (Muddy Paws Shelter, 2026-10-27), built here as a fixture because the project itself is his.
 *
 * Reads each template's `components/` (not `__cloud__/`, which Workflow draws) from a NodeGX checkout (NODEGX_REPO, or
 * the sibling ../OpenNoodl). For each component: every node is placed once, no two cards overlap, the visual tree is in
 * the lane (each child under its parent, indented) and the logic to its right, every wire starts on its source's right
 * edge and ends on its target's left edge at the port's row, and the SVG has one card per node. Then the fixture:
 * "Logic on this page" lists the placed Wording component and nothing Studio edits, and Wording's own list has its
 * States node. The view is graded in Chrome by check.mjs ("the wiring underneath").
 *
 *   node editor/wiring-check.mjs    PASS n/n and exit 0, or the failing lines and exit 1
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { look, nodeScheme, wireColors } from '../vendor/look.js';
import { isElementType, logicOnPage, placedComponent, sourceKind, studioEdits, wiringLayout, wiringSvg } from './wiring.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : resolve(here, '..', '..', 'OpenNoodl');
const vocab = JSON.parse(readFileSync(join(here, 'vocabulary.json'), 'utf8'));
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); if (!cond || process.argv.includes('-v')) console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };
const SIGNALS = /^(send|run|do|fetch|store|create|save|delete|done|success|failed|onClick|click|ontrue|onfalse)$/i;
const guess = (c) => SIGNALS.test(c.fromProperty) || SIGNALS.test(c.toProperty);
const words = (n) => ({ title: n.label || n.type.split('/').pop(), sub: n.label ? n.type.split('/').pop() : '' });

/** Lay one component out and grade the geometry. `draws(key)`: does a component draw (its instances are elements). */
function grade(name, files, draws) {
  const nodes = files.nodes.nodes, conns = files.connections.connections ?? [];
  const roots = files.nodes.visualRoots?.length ? files.nodes.visualRoots : nodes.filter((n) => n.parent === undefined && Array.isArray(n.children)).map((n) => n.id);
  const isElement = (n) => isElementType(vocab, n.type, (t) => (placedComponent(t) ? draws(placedComponent(t)) : false)) || n.parent !== undefined || Array.isArray(n.children) || roots.includes(n.id);
  const L = wiringLayout({ nodes, conns, roots, isElement, isSignal: guess, words, look });
  const drawn = nodes.filter((n) => n.type !== 'Comment');
  const ids = L.cards.map((c) => c.id);
  ok(ids.length === drawn.length && new Set(ids).size === ids.length, `${name}: every node placed once`, { placed: ids.length, nodes: drawn.length });
  const lost = L.cards.filter((c) => ![c.x, c.y, c.w, c.h].every(Number.isFinite));
  ok(lost.length === 0 && Number.isFinite(L.width) && Number.isFinite(L.height), `${name}: every card is somewhere (finite x, y, size)`, lost.map((c) => [c.id, c.x, c.y]).slice(0, 3));
  const overlaps = [];
  for (let i = 0; i < L.cards.length; i++) for (let j = i + 1; j < L.cards.length; j++) {
    const a = L.cards[i], b = L.cards[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push([a.id, b.id]);
  }
  ok(overlaps.length === 0, `${name}: no two cards overlap`, overlaps.slice(0, 3));
  const at = new Map(L.cards.map((c) => [c.id, c]));
  if (L.lane) {
    const out = L.cards.filter((c) => c.element && (c.x < L.lane.x || c.x + c.w > L.lane.x + L.lane.w || c.y + c.h > L.lane.y + L.lane.h));
    ok(out.length === 0, `${name}: the visual tree is inside the structure lane`, out.map((c) => c.id).slice(0, 3));
    ok(L.cards.filter((c) => !c.element).every((c) => c.x >= L.lane.x + L.lane.w), `${name}: the logic is right of the lane`);
    const kids = drawn.filter((n) => at.get(n.id)?.element && at.get(n.parent)?.element);
    const bad = kids.filter((n) => { const c = at.get(n.id), p = at.get(n.parent); return !(c.y > p.y && c.x === p.x + look.card.childMargin); });
    ok(bad.length === 0, `${name}: each child is under its parent, indented by the canvas's child margin`, bad.map((n) => n.id).slice(0, 3));
  }
  const offRow = L.wires.filter((w) => { const a = at.get(w.from), b = at.get(w.to); return w.x1 !== a.x + a.w || w.x2 !== b.x || !a.rows.some((r) => r.plug === 'output' && r.port === w.fromPort && r.y === w.y1) || !b.rows.some((r) => r.plug === 'input' && r.port === w.toPort && r.y === w.y2); });
  ok(L.wires.length === conns.filter((c) => at.has(c.fromId) && at.has(c.toId)).length && offRow.length === 0, `${name}: every wire runs from its source's port row to its target's`, { wires: L.wires.length, offRow: offRow.length });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const svg = wiringSvg(L, { look, scheme: (c) => nodeScheme(c), wireColor: (k) => wireColors(k), words, category: (n) => (placedComponent(n.type) ? 'component' : at.get(n.id).element ? 'visual' : 'logic'), byId, selected: ids[0] });
  const cardsInSvg = [...svg.matchAll(/<g class="card[^"]*" data-id="([^"]+)"/g)].map((m) => m[1]);
  ok(cardsInSvg.length === ids.length && (svg.match(/<g /g) ?? []).length === (svg.match(/<\/g>/g) ?? []).length, `${name}: the drawing has one card per node, and closes what it opens`, { cards: cardsInSvg.length });
  return L;
}

// 1. the templates
if (!existsSync(join(repo, 'templates', 'todo-list'))) {
  console.log(`wiring-check: no NodeGX checkout at ${repo} (set NODEGX_REPO): nothing to read`);
  process.exit(1);
}
let comps = 0, nodesSeen = 0, wiresSeen = 0, logicSeen = 0;
for (const t of readdirSync(join(repo, 'templates'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const root = join(repo, 'templates', t, 'components');
  if (!existsSync(root)) continue;
  const keys = [];
  (function walk(d, rel) { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const r = rel ? `${rel}/${e.name}` : e.name; if (existsSync(join(d, e.name, 'nodes.json'))) keys.push(r); walk(join(d, e.name), r); } })(root, '');
  const read = (key) => ({ nodes: JSON.parse(readFileSync(join(root, key, 'nodes.json'), 'utf8')), connections: existsSync(join(root, key, 'connections.json')) ? JSON.parse(readFileSync(join(root, key, 'connections.json'), 'utf8')) : { connections: [] } });
  const memo = new Map();
  const draws = (key, seen = new Set()) => {
    if (memo.has(key)) return memo.get(key);
    if (seen.has(key) || !keys.includes(key)) return false;
    seen.add(key);
    const f = read(key).nodes;
    const v = !!(f.visualRoots?.length || f.nodes.some((n) => isElementType(vocab, n.type) || Array.isArray(n.children)));
    memo.set(key, v); return v;
  };
  for (const key of keys.filter((k) => !k.startsWith('__cloud__/'))) {
    const files = read(key);
    if (!files.nodes.nodes?.length) continue;
    comps++; nodesSeen += files.nodes.nodes.length; wiresSeen += files.connections.connections?.length ?? 0;
    logicSeen += logicOnPage(vocab, files.nodes.nodes, { inComponent: key, isVisual: (ty) => (placedComponent(ty) ? draws(placedComponent(ty)) : false) }).length;
    grade(`${t}/${key}`, files, draws);
  }
}
ok(comps > 40, `the templates hold enough components to mean something (${comps}, ${nodesSeen} nodes, ${wiresSeen} wires; ${logicSeen} nodes Studio does not edit)`, comps);

// 2. Muddy Paws Shelter's Home, as Richard's run left it (the copy read 2026-10-27): the headline's Text is fed by a
//    placed logic component, Wording, whose own graph is a Variable into a States node into its outputs
const home = {
  nodes: { visualRoots: ['page'], nodes: [
    { id: 'page', type: 'Page', label: 'Home', children: ['band'], parameters: { urlPath: 'home' }, x: 40, y: 40 },
    { id: 'band', type: 'Group', label: 'Hero band', parent: 'page', children: ['eyebrow', 'headline', 'cta'] },
    { id: 'eyebrow', type: 'Text', label: 'Eyebrow', parent: 'band' },
    { id: 'headline', type: 'Text', label: 'Display headline', parent: 'band' },
    { id: 'cta', type: 'net.noodl.controls.button', label: 'Primary CTA', parent: 'band' },
    { id: 'wording', type: '/Components/Wording', label: 'Wordings (option set by language)', x: 650, y: 640 },
    { id: 'go', type: 'RouterNavigate', label: 'Go to dogs', x: 650, y: 800 },
    { id: 'st', type: 'Variable2', label: 'open', metadata: { customState: { of: 'band', name: 'open', type: 'boolean' } } }
  ] },
  connections: { connections: [
    { fromId: 'wording', fromProperty: 'home_eyebrow', toId: 'eyebrow', toProperty: 'text' },
    { fromId: 'wording', fromProperty: 'home_headline', toId: 'headline', toProperty: 'text' },
    { fromId: 'wording', fromProperty: 'home_cta', toId: 'cta', toProperty: 'label' },
    { fromId: 'cta', fromProperty: 'onClick', toId: 'go', toProperty: 'navigate' }
  ] }
};
const wording = {
  nodes: { nodes: [
    { id: 'langvar-3', type: 'Variable2', label: 'Current language', x: 40, y: 40, parameters: { name: 'language' } },
    { id: 'wordStates', type: 'States', label: 'Wordings by language', x: 66, y: 179 },
    { id: 'wordOut', type: 'Component Outputs', label: 'Wordings out', x: 67, y: 410, ports: [{ name: 'home_headline', plug: 'input' }] }
  ] },
  connections: { connections: [
    { fromId: 'langvar-3', fromProperty: 'value', toId: 'wordStates', toProperty: 'currentState' },
    { fromId: 'wordStates', fromProperty: 'home_headline', toId: 'wordOut', toProperty: 'home_headline' },
    { fromId: 'wordStates', fromProperty: 'home_eyebrow', toId: 'wordOut', toProperty: 'home_eyebrow' }
  ] }
};
const draws = (k) => k !== 'Components/Wording';
const onHome = logicOnPage(vocab, home.nodes.nodes, { inComponent: 'Pages/Home', isVisual: (t) => (placedComponent(t) ? draws(placedComponent(t)) : false) });
ok(JSON.stringify(onHome.map((n) => n.id)) === '["wording"]', 'Muddy Paws Home: "Logic on this page" is the placed Wording component, and not the step or the custom state Studio edits', onHome.map((n) => n.id));
ok(sourceKind(vocab, home.nodes.nodes.find((n) => n.id === 'st')) === 'state' && !studioEdits(vocab, home.nodes.nodes[5], { isVisual: () => false }), 'a custom state is a source Studio chips; a placed logic component is not one it edits');
const onWording = logicOnPage(vocab, wording.nodes.nodes, { inComponent: 'Components/Wording' });
ok(JSON.stringify(onWording.map((n) => n.type)) === '["Variable2","States"]', 'Wording: its Variable and its States node are listed; its Component Outputs (the interface) is not', onWording.map((n) => n.type));
const LH = grade('Muddy Paws Home (fixture)', home, draws);
const wc = LH.cards.find((c) => c.id === 'wording'), hc = LH.cards.find((c) => c.id === 'headline');
ok(!wc.element && wc.depth === 0 && Math.abs((wc.rows.find((r) => r.port === 'home_headline').y) - hc.rows.find((r) => r.port === 'text').y) < 80, 'Muddy Paws Home: Wording sits in the first column right of the lane, level with what it feeds', { wording: [wc.x, wc.y], headline: [hc.x, hc.y] });
const LW = grade('Muddy Paws Wording (fixture)', wording, () => false);
const cx = (id) => LW.cards.find((c) => c.id === id).x;
ok(!LW.lane && cx('langvar-3') < cx('wordStates') && cx('wordStates') < cx('wordOut'), 'Wording (no visual tree): laid out as a function is, Variable → States → outputs, left to right', { x: ['langvar-3', 'wordStates', 'wordOut'].map(cx) });
const svg = wiringSvg(LH, { look, scheme: (c) => nodeScheme(c), wireColor: (k) => wireColors(k), words, category: () => 'default', byId: new Map(home.nodes.nodes.map((n) => [n.id, n])), selected: 'wording' });
ok(/<g class="card on" data-id="wording" data-component="Components\/Wording"/.test(svg) && (svg.match(/class="card on"/g) ?? []).length === 1, 'the selected node is drawn highlighted, once, and carries the component it places');

const passed = results.filter(Boolean).length;
console.log(`wiring-check: ${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
