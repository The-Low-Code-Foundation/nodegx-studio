/**
 * STU-084 (P128 S6, P125-MUDDY-DEADCHIP) — the wiring underneath: a page (or a component) drawn as the NodeGX editor
 * draws it, every node and every wire, read only.
 *
 * Some of what the agent builds is a part Studio does not edit: a `States` node, a script, a logic component placed on
 * the page. Studio used to show the value such a part produces as a chip that opened nothing, and list the part
 * nowhere (Richard, Muddy Paws Shelter, 2026-10-27: "I'm not finding it yet"). The canon (`docs/CANON.md`, "The wiring
 * underneath"): Studio names the part, and from there the person can look at the page as it really is.
 *
 * Pure, as fngraph.mjs is: nodes and wires in, a layout and an SVG string out. Studio draws it (the Wiring view, the
 * chip's card, "Logic on this page"); wiring-check.mjs grades it on every page of the templates without a browser.
 *
 * The layout is the one the agent's tools write and the NodeGX editor shows: the visual tree down a structure lane on
 * the left, each child under its parent and indented; the logic to the right, a column per step away from the tree,
 * each node level with what it is wired to. A component with no visual tree is laid out as a function is
 * (fngraph.mjs `functionLayout`: a column per step from its inputs, its outputs last).
 */
import { functionLayout } from './fngraph.mjs';

/** The value-source kind Studio chips a node as (`vocabulary.json` `sources.kinds`), or null. */
export function sourceKind(vocab, node) {
  const m = node?.metadata ?? {};
  for (const k of vocab.sources.kinds) {
    if (k.typePrefix && String(node.type).startsWith(k.typePrefix)) return k.kind;
    if (k.type && node.type !== k.type) continue;
    if ((k.metadata ?? []).some((key) => m[key])) return k.kind;
  }
  return null;
}

/** An element: drawn on the page (`vocabulary.json` `elements`); `isVisual` answers for component instances and the node library's category. */
export const isElementType = (vocab, type, isVisual = () => false) =>
  vocab.elements.types.includes(type) || vocab.elements.prefixes.some((p) => type.startsWith(p)) || isVisual(type);

const stepTypes = (vocab) => new Set([...vocab.steps.menu.map(([t]) => vocab.steps.aliases?.[t] ?? t), ...vocab.steps.menu.map(([t]) => t)].filter((t) => !t.startsWith('@') && !vocab.steps.notEdited.includes(t)));

/**
 * Does Studio edit this node where it sits (`inComponent`, a component key: `Pages/Home`)? An element, a workflow step,
 * a value source it chips, a component's interface, an option set's insides. The same rule @nodegx/mcp's
 * `studioEdits` applies to a write's note (`src/studio/vocabulary.ts`), read from the same file.
 */
export function studioEdits(vocab, node, { inComponent = '', isVisual = () => false } = {}) {
  const { type } = node;
  if (isElementType(vocab, type, isVisual)) return true;
  if (stepTypes(vocab).has(type) || vocab.interface.types.includes(type)) return true;
  if (sourceKind(vocab, node)) return true;
  if (inComponent.startsWith(vocab.optionSet.prefix) && vocab.optionSet.insides.includes(type)) return true;
  return false;
}

/** The nodes on a page that Studio does not edit, in the order they were placed: "Logic on this page". Comments are not nodes a person reads as logic. */
export function logicOnPage(vocab, nodes, opts = {}) {
  return nodes.filter((n) => n.type !== 'Comment' && !studioEdits(vocab, n, opts));
}

/** `/Components/Wording` or `/#Components/Wording` → `Components/Wording`: the component a node places, or null. */
export const placedComponent = (type) => (String(type).startsWith('/') ? String(type).replace(/^\/#?/, '') : null);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The layout. In:
 *   nodes, conns       the component's files (`nodes.nodes`, `connections.connections`)
 *   roots              the visual roots in order (`nodes.visualRoots`, or the parentless elements)
 *   isElement(node)    is it drawn on the page
 *   isSignal(conn)     does a wire carry a signal
 *   words(node)        { title, sub } as the card says them
 *   portWords(node, plug, port)
 *   look               `@nodegx/canvas-look`'s `look` (the card metrics, the lane)
 * Out: { cards: [{ id, x, y, w, h, element, depth, rows: [{ port, plug, words, y }] }], wires: [{ from, fromPort, to,
 *   toPort, kind, x1, y1, x2, y2 }], lane: { x, y, w, h } | null, width, height }
 */
export function wiringLayout({ nodes, conns, roots = [], isElement, isSignal = () => false, words, portWords = (n, plug, p) => p, look }) {
  const C = look.card, L = look.lane;
  const HEAD = C.size.height, ROW = C.propertyConnectionHeight, GAP = C.verticalSpacing, INDENT = C.childMargin;
  const shown = nodes.filter((n) => n.type !== 'Comment');
  const byId = new Map(shown.map((n) => [n.id, n]));
  const wires = conns.filter((c) => byId.has(c.fromId) && byId.has(c.toId));

  // a row per wired port, inputs first, each once, in the order the wires were made
  const rowsOf = new Map(shown.map((n) => [n.id, []]));
  for (const plug of ['input', 'output']) for (const c of wires) {
    const [id, port] = plug === 'input' ? [c.toId, c.toProperty] : [c.fromId, c.fromProperty];
    const rows = rowsOf.get(id);
    if (!rows.some((r) => r.plug === plug && r.port === port)) rows.push({ port, plug, words: portWords(byId.get(id), plug, port) });
  }
  const sizeOf = (n) => {
    const w0 = words(n), rows = rowsOf.get(n.id);
    const ins = Math.max(0, ...rows.filter((r) => r.plug === 'input').map((r) => r.words.length));
    const outs = Math.max(0, ...rows.filter((r) => r.plug === 'output').map((r) => r.words.length));
    const w = clamp(Math.max(48 + Math.max(w0.title.length, (w0.sub ?? '').length * 0.85) * 7, 40 + (ins + outs) * 6.2), C.size.width, 300);
    return { w: Math.round(w), h: HEAD + rows.length * ROW + (rows.length ? 6 : 0) };
  };
  const cards = new Map();
  const place = (n, x, y, element, depth) => {
    const { w, h } = sizeOf(n);
    const card = { id: n.id, x, y, w, h, element, depth, rows: rowsOf.get(n.id).map((r, i) => ({ ...r, y: y + HEAD + i * ROW + ROW / 2 })) };
    cards.set(n.id, card);
    return card;
  };

  // the visual tree: down the lane, a child under its parent, indented
  let lane = null, right = 0;
  const elements = shown.filter((n) => isElement(n));
  if (elements.length) {
    const seen = new Set();
    let y = L.eyebrowHeight + L.padding, maxX = 0;
    const walk = (id, depth) => {
      const n = byId.get(id);
      if (!n || seen.has(id) || !isElement(n)) return;
      seen.add(id);
      const card = place(n, L.padding + depth * INDENT, y, true, depth);
      y += card.h + GAP; maxX = Math.max(maxX, card.x + card.w);
      for (const k of n.children ?? []) walk(k, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    for (const n of elements) if (!seen.has(n.id) && (n.parent === undefined || !byId.has(n.parent))) walk(n.id, 0); // a root the list missed
    for (const n of elements) if (!seen.has(n.id)) walk(n.id, 0); // a child of a parent not drawn: at the left, not lost
    lane = { x: 0, y: 0, w: maxX + L.padding, h: y - GAP + L.padding };
    right = lane.w;
  }

  // the logic: on a page, a column per step away from the tree (undirected, through logic only); with no tree, a function's columns
  const logic = shown.filter((n) => !cards.has(n.id));
  const nbrs = new Map(shown.map((n) => [n.id, []]));
  for (const c of wires) { nbrs.get(c.fromId).push(c.toId); nbrs.get(c.toId).push(c.fromId); }
  let columns;
  if (lane) {
    const dist = new Map();
    let frontier = [...cards.keys()];
    for (let d = 1; frontier.length; d++) {
      const next = [];
      for (const id of frontier) for (const m of nbrs.get(id)) if (!cards.has(m) && !dist.has(m)) { dist.set(m, d); next.push(m); }
      frontier = next;
    }
    const reached = logic.filter((n) => dist.has(n.id)), rest = logic.filter((n) => !dist.has(n.id));
    const width = Math.max(0, ...reached.map((n) => dist.get(n.id)));
    columns = Array.from({ length: width }, () => []);
    for (const n of reached) columns[dist.get(n.id) - 1].push(n.id);
    // logic wired to no element: laid out among itself, after the rest
    if (rest.length) {
      const sub = functionLayout(rest, wires, () => false);
      for (const col of sub.columns) if (col.length) columns.push(col);
    }
  } else {
    columns = functionLayout(logic, wires, (c) => isSignal(c)).columns.filter((c) => c.length);
  }

  // each column level with what it is wired to (the mean of the rows it meets), then pushed down so no two overlap
  const COLGAP = 96;
  let x = lane ? right + COLGAP : 0;
  const anchor = (id, other) => {
    const card = cards.get(other);
    if (!card) return null;
    const row = card.rows.find((r) => wires.some((c) => (c.fromId === other && c.toId === id && r.plug === 'output' && r.port === c.fromProperty) || (c.toId === other && c.fromId === id && r.plug === 'input' && r.port === c.toProperty)));
    return row ? row.y : card.y + HEAD / 2;
  };
  columns.forEach((col) => {
    // a node wired to nothing placed yet goes under the ones that are, in the order it came
    const want = col.map((id) => {
      const ys = nbrs.get(id).map((m) => anchor(id, m)).filter((v) => v !== null);
      return [id, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length - HEAD / 2 : Infinity];
    }).sort((a, b) => a[1] - b[1] || col.indexOf(a[0]) - col.indexOf(b[0]));
    let floor = lane ? L.eyebrowHeight + L.padding : 0, w = C.size.width;
    for (const [id, y] of want) {
      const card = place(byId.get(id), x, Math.round(Number.isFinite(y) ? Math.max(y, floor) : floor), false, columns.indexOf(col));
      floor = card.y + card.h + GAP * 2; w = Math.max(w, card.w);
    }
    x += w + COLGAP;
  });

  const out = wires.map((c) => {
    const a = cards.get(c.fromId), b = cards.get(c.toId);
    const ra = a.rows.find((r) => r.plug === 'output' && r.port === c.fromProperty), rb = b.rows.find((r) => r.plug === 'input' && r.port === c.toProperty);
    return { from: c.fromId, fromPort: c.fromProperty, to: c.toId, toPort: c.toProperty, kind: isSignal(c) ? 'signal' : 'data', x1: a.x + a.w, y1: ra.y, x2: b.x, y2: rb.y };
  });
  const all = [...cards.values()];
  return {
    cards: all, wires: out, lane,
    width: Math.max(lane?.w ?? 0, ...all.map((c) => c.x + c.w)),
    height: Math.max(lane?.h ?? 0, ...all.map((c) => c.y + c.h))
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fit = (s, px, size) => { const n = Math.max(3, Math.floor(px / (size * 0.56))); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/**
 * The layout as SVG, in the NodeGX canvas's look (`@nodegx/canvas-look`, `scheme(category)` = `nodeScheme`): a card per
 * node (its category's header, its label, its type, a row per wired port), the hierarchy lines, the structure lane,
 * the wires in the canvas's data and signal colours. `selected`: the node drawn highlighted. Every card carries
 * `data-id` (and `data-component` when it places one) for the page to hang its clicks on.
 */
export function wiringSvg(layout, { look, theme = 'dark', scheme, wireColor, words, category, selected = null, byId }) {
  const col = look.colors[theme], C = look.card, L = look.lane, pad = 24;
  const W = Math.ceil(layout.width + pad * 2), H = Math.ceil(layout.height + pad * 2);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" class="wiring" width="${W}" height="${H}" viewBox="${-pad} ${-pad} ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">`];
  parts.push(`<defs><pattern id="wgrid" width="${look.gridCellSize}" height="${look.gridCellSize}" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${col.gridDot}"/></pattern></defs>`);
  parts.push(`<rect x="${-pad}" y="${-pad}" width="${W}" height="${H}" fill="${col.ground}"/><rect x="${-pad}" y="${-pad}" width="${W}" height="${H}" fill="url(#wgrid)"/>`);
  if (layout.lane) {
    const ln = layout.lane, vis = scheme('visual');
    parts.push(`<rect class="lane" x="${ln.x}" y="${ln.y}" width="${ln.w}" height="${ln.h}" rx="${L.cornerRadius}" fill="${vis.outlineHighlighted}" fill-opacity="${L.washAlpha}" stroke="${col.cardBorder}"/>`);
    parts.push(`<text x="${ln.x + L.padding}" y="${ln.y + L.eyebrowHeight - 6}" font-size="10" letter-spacing="1" fill="${col.cardSubText}" opacity="0.7">${esc(L.eyebrowLabel)}</text>`);
  }
  const cardOf = new Map(layout.cards.map((c) => [c.id, c]));
  // hierarchy: a line from a parent's left edge down to each child's header
  for (const c of layout.cards) {
    if (!c.element) continue;
    const parent = cardOf.get(byId.get(c.id)?.parent);
    if (!parent) continue;
    const x = parent.x + 8, y = c.y + C.size.height / 2;
    parts.push(`<path d="M${x} ${parent.y + C.size.height} V${y} H${c.x}" fill="none" stroke="${col.hierarchyLine}" stroke-width="1.5"/>`);
  }
  for (const w of layout.wires) {
    const dx = Math.max(60, Math.abs(w.x2 - w.x1) / 2);
    const hot = selected && (w.from === selected || w.to === selected);
    const wc = wireColor(w.kind === 'signal' ? 'signal' : 'data');
    parts.push(`<path class="wire" data-from="${esc(w.from)}" data-to="${esc(w.to)}" d="M${w.x1} ${w.y1} C${w.x1 + dx} ${w.y1} ${w.x2 - dx} ${w.y2} ${w.x2} ${w.y2}" fill="none" stroke="${hot ? wc.highlighted : wc.normal}" stroke-width="${hot ? 2.5 : 1.6}" stroke-opacity="${selected && !hot ? 0.45 : 0.95}"/>`);
  }
  for (const c of layout.cards) {
    const n = byId.get(c.id), s = scheme(category(n)), on = c.id === selected, w0 = words(n);
    const comp = placedComponent(n.type);
    parts.push(`<g class="card${on ? ' on' : ''}" data-id="${esc(c.id)}"${comp ? ` data-component="${esc(comp)}"` : ''} transform="translate(${c.x} ${c.y})" style="cursor:pointer">`);
    if (on) parts.push(`<rect x="-5" y="-5" width="${c.w + 10}" height="${c.h + 10}" rx="${C.cornerRadius + 4}" fill="${col.selectionGlow}"/>`);
    parts.push(`<rect width="${c.w}" height="${c.h}" rx="${C.cornerRadius}" fill="${on ? s.baseHighlighted : s.base}" stroke="${on ? s.outlineHighlighted : s.outline}" stroke-width="${on ? 2 : 1}"/>`);
    parts.push(`<path d="M0 ${C.cornerRadius} a${C.cornerRadius} ${C.cornerRadius} 0 0 1 ${C.cornerRadius} ${-C.cornerRadius} H${c.w - C.cornerRadius} a${C.cornerRadius} ${C.cornerRadius} 0 0 1 ${C.cornerRadius} ${C.cornerRadius} V${C.size.height} H0 Z" fill="${on ? s.headerHighlighted : s.header}"/>`);
    parts.push(`<rect x="${C.headerChipInset}" y="${(C.size.height - C.headerChipSize) / 2}" width="${C.headerChipSize}" height="${C.headerChipSize}" rx="6" fill="${look.colors[theme].categories[category(n)]?.chipFill ?? col.categories.default.chipFill}" stroke="${look.colors[theme].categories[category(n)]?.accent ?? col.categories.default.accent}" stroke-opacity="0.6"/>`);
    parts.push(`<text x="${C.headerTextInset}" y="${w0.sub ? 15 : 22}" font-size="12.5" font-weight="600" fill="${s.text}">${esc(fit(w0.title, c.w - C.headerTextInset - 8, 12.5))}</text>`);
    if (w0.sub) parts.push(`<text x="${C.headerTextInset}" y="29" font-size="10.5" fill="${col.cardSubText}">${esc(fit(w0.sub, c.w - C.headerTextInset - 8, 10.5))}</text>`);
    for (const r of c.rows) {
      const y = r.y - c.y, left = r.plug === 'input';
      const wc = wireColor('data').normal;
      parts.push(`<circle cx="${left ? 0 : c.w}" cy="${y}" r="3.5" fill="${wc}" stroke="${col.ground}" stroke-width="1"/>`);
      parts.push(`<text x="${left ? 10 : c.w - 10}" y="${y + 3.5}" font-size="10.5" font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" text-anchor="${left ? 'start' : 'end'}" fill="${col.portText}">${esc(fit(r.words, c.w - 24, 10.5))}</text>`);
    }
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('');
}
