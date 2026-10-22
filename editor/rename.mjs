/**
 * STU-062 — a rename follows the app. Renaming a field or a type in Data rewrites what reads it, as pure functions over
 * the components' files.
 *
 * What reads a field `F` of a type `T`, in two kinds:
 *   - **Sure**: the field by name on something that names `T`. A Record node with `collectionName: T` (create, change,
 *     delete, read one) sets or reads `prop-F` (a parameter, or a wire into or out of that port); a Query Records node
 *     on `T` asks by `F` (`visualFilter`, either saved shape: `{combinator, rules: [{property}]}` or
 *     `{type, conditions: [{field}]}`, groups inside groups) or sorts by it (`visualSort`); page data's "first" record
 *     (`Model2` with `metadata.pageDataRecord.item` → a query on `T`) lists `F` in `properties` and sends `prop-F` on, to
 *     an element or a composed expression's chip. These are rewritten with the rename.
 *   - **Maybe**: the name with nothing saying which type it belongs to. Code (an Expression, a Function, a Map or a For
 *     Each script) that reads `.F`, `?.F` or `['F']`; an Object node (`Model2`) not bound to page data that lists `F`.
 *     The code `row.title` reads a title of whatever `row` is, which only a person can say, so each is shown with its
 *     line and changes only when ticked.
 * A type `T` renamed: every node whose `collectionName` is `T` (sure), and code that names `'T'` in quotes (maybe).
 *
 *   fieldReaders(components, type, field)      → [{ id, key, node, label, sure, kind, what, line? }]
 *   renameField(components, type, from, to, picked) → { changed: Map<key, files>, count }
 *   typeReaders(components, type)              → the same shape
 *   renameType(components, from, to, picked)   → the same shape
 *
 * `components` is `[{ key, files: { nodes: <nodes.json>, connections: <connections.json> } }]`; `picked` is a Set of the
 * maybe-readers' `id`s the person ticked (a sure one needs no tick). A reader's `id` names its node and, for code, the
 * place in the text, so a tick taken on one reading applies only to that same text.
 */

export const WRITERS = /^(New|Set|Delete)DbModelProperties$/;
/** The settings that hold code, by node type. */
export const CODE = { Expression: 'expression', JavaScriptFunction: 'functionScript', Javascript2: 'code', 'Map Collection': 'mapScript', 'For Each': 'templateScript' };
// a name after one of these is the node's own port or a global, never a record's field
const NOT_A_RECORD = new Set(['Inputs', 'Outputs', 'Noodl', 'Variables', 'Objects', 'Arrays', 'Records', 'Math', 'JSON', 'console', 'window', 'document', 'Object', 'Array', 'String', 'Number', 'Date', 'Promise', 'this']);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const props = (s) => (typeof s === 'string' && s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const nodesOf = (files) => files.nodes?.nodes || [];
const wiresOf = (files) => files.connections?.connections || [];
const copy = (v) => JSON.parse(JSON.stringify(v));

/** Whether a saved filter names a field, in either shape, groups and all. */
function filterNames(f, field) {
  if (!f || typeof f !== 'object') return false;
  if (Array.isArray(f)) return f.some((x) => filterNames(x, field));
  if (f.property === field || f.field === field) return true;
  return filterNames(f.rules, field) || filterNames(f.conditions, field);
}
function filterRenamed(f, from, to) {
  if (!f || typeof f !== 'object') return f;
  if (Array.isArray(f)) return f.map((x) => filterRenamed(x, from, to));
  const out = { ...f };
  if (out.property === from) out.property = to;
  if (out.field === from) out.field = to;
  if (out.rules) out.rules = filterRenamed(out.rules, from, to);
  if (out.conditions) out.conditions = filterRenamed(out.conditions, from, to);
  return out;
}

/** Each place a piece of code reads `.F`, `?.F` or `['F']`: `{ at, length, replace(to) }` over the whole text. */
export function fieldMentions(text, field) {
  const out = [];
  if (typeof text !== 'string' || !text.includes(field)) return out;
  const dot = new RegExp(`([A-Za-z_$][\\w$]*)?(\\?\\.|\\.)\\s*(${esc(field)})(?![\\w$])`, 'g');
  for (let m; (m = dot.exec(text));) {
    if (m[1] && NOT_A_RECORD.has(m[1])) continue;
    // `1.F` and `..F` are not a member read; a word ending in a digit is fine (row2.title)
    const before = text[m.index - 1];
    if (!m[1] && before !== undefined && /[\d.]/.test(before)) continue;
    const at = m.index + m[0].length - field.length;
    out.push({ at, length: field.length });
  }
  const bracket = new RegExp(`\\[\\s*(['"\`])${esc(field)}\\1\\s*\\]`, 'g');
  for (let m; (m = bracket.exec(text));) {
    const q = m[1], at = m.index + m[0].indexOf(q) + 1;
    out.push({ at, length: field.length });
  }
  return out.sort((a, b) => a.at - b.at);
}
/** Each place a piece of code names a type in quotes: `'Task'`, `"Task"`. */
export function typeMentions(text, type) {
  const out = [];
  if (typeof text !== 'string' || !text.includes(type)) return out;
  const re = new RegExp(`(['"\`])${esc(type)}\\1`, 'g');
  for (let m; (m = re.exec(text));) out.push({ at: m.index + 1, length: type.length });
  return out;
}
/** The line a mention is on, for a person to read: trimmed, and begun a little before the mention when it is far along. */
const lineAt = (text, at) => {
  const s = text.lastIndexOf('\n', at - 1) + 1, e = text.indexOf('\n', at);
  const line = text.slice(s, e < 0 ? undefined : e);
  const lead = line.length - line.trimStart().length, from = at - s - lead;
  return from > 40 ? '…' + line.trim().slice(from - 30) : line.trim();
};

/** The collection each page-data record node reads (its query's), in one component. */
function pageRecords(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map();
  for (const n of nodes) {
    const item = n.metadata?.pageDataRecord?.item;
    const q = item !== undefined ? byId.get(item) : undefined;
    if (q?.parameters?.collectionName) out.set(n.id, q.parameters.collectionName);
  }
  return out;
}

const labelOf = (n) => n.label || n.type;
function codeReaders(key, n, mentions, kind) {
  const param = CODE[n.type];
  const text = n.parameters?.[param];
  return mentions(text).map((m) => ({ id: `${key}|${n.id}|${param}|${m.at}`, key, node: n.id, label: labelOf(n), sure: false, kind, what: 'its code', line: lineAt(text, m.at), param, at: m.at, length: m.length }));
}

/** Everything in the app that reads field `field` of type `type`, sure and maybe. */
export function fieldReaders(components, type, field) {
  const out = [];
  const port = `prop-${field}`;
  for (const { key, files } of components) {
    const nodes = nodesOf(files), wires = wiresOf(files);
    const records = pageRecords(nodes);
    for (const n of nodes) {
      const p = n.parameters || {};
      const wired = wires.filter((w) => (w.toId === n.id && w.toProperty === port) || (w.fromId === n.id && w.fromProperty === port));
      if (p.collectionName === type) {
        const what = [];
        if (port in p || wired.some((w) => w.toId === n.id)) what.push(WRITERS.test(n.type) ? 'sets it' : 'is given it');
        if (wired.some((w) => w.fromId === n.id)) what.push('reads it');
        if (filterNames(p.visualFilter, field)) what.push('asks by it');
        if (Array.isArray(p.visualSort) && p.visualSort.some((s) => s?.property === field)) what.push('sorts by it');
        if (what.length) out.push({ id: `${key}|${n.id}`, key, node: n.id, label: labelOf(n), sure: true, kind: n.type === 'DbCollection2' ? 'query' : 'record', what: what.join(', ') });
      } else if (n.type === 'Model2' && (props(p.properties).includes(field) || wired.length || port in p)) {
        const of = records.get(n.id);
        if (of === type) out.push({ id: `${key}|${n.id}`, key, node: n.id, label: labelOf(n), sure: true, kind: 'pagedata', what: 'reads it' });
        else if (of === undefined) out.push({ id: `${key}|${n.id}`, key, node: n.id, label: labelOf(n), sure: false, kind: 'object', what: 'an object with a field of that name' });
      }
      if (CODE[n.type]) out.push(...codeReaders(key, n, (text) => fieldMentions(text, field), 'code'));
    }
  }
  return out;
}

/** Everything in the app that names type `type`. */
export function typeReaders(components, type) {
  const out = [];
  for (const { key, files } of components) {
    for (const n of nodesOf(files)) {
      if (n.parameters?.collectionName === type) out.push({ id: `${key}|${n.id}`, key, node: n.id, label: labelOf(n), sure: true, kind: n.type === 'DbCollection2' ? 'query' : 'record', what: n.type === 'DbCollection2' ? 'asks for its rows' : WRITERS.test(n.type) ? 'writes its rows' : 'reads a row' });
      if (CODE[n.type]) out.push(...codeReaders(key, n, (text) => typeMentions(text, type), 'code'));
    }
  }
  return out;
}

/** A setting's text with the picked mentions replaced, from the end so the earlier places stay where they were. */
function rewriteText(text, places, to) {
  let out = text;
  for (const r of [...places].sort((a, b) => b.at - a.at)) out = out.slice(0, r.at) + to + out.slice(r.at + r.length);
  return out;
}
function apply(components, readers, picked, change) {
  const take = readers.filter((r) => r.sure || picked.has(r.id));
  const changed = new Map();
  for (const { key, files } of components) {
    const mine = take.filter((r) => r.key === key);
    if (!mine.length) continue;
    const out = copy(files);
    change(out, mine);
    changed.set(key, out);
  }
  return { changed, count: take.length };
}
/** Code settings rewritten for the picked mentions, node by node. */
function rewriteCode(out, mine, to) {
  const byNode = new Map();
  for (const r of mine.filter((x) => x.kind === 'code')) byNode.set(r.node, [...(byNode.get(r.node) || []), r]);
  for (const n of nodesOf(out)) {
    const places = byNode.get(n.id);
    if (places) n.parameters[places[0].param] = rewriteText(n.parameters[places[0].param], places, to);
  }
}

/** Field `from` of `type` renamed `to`: the sure readers, and the maybe ones in `picked`. */
export function renameField(components, type, from, to, picked = new Set()) {
  const readers = fieldReaders(components, type, from);
  const [was, now] = [`prop-${from}`, `prop-${to}`];
  return apply(components, readers, picked, (out, mine) => {
    const ids = new Set(mine.filter((r) => r.kind !== 'code').map((r) => r.node));
    for (const n of nodesOf(out)) {
      if (!ids.has(n.id) || !n.parameters) continue;
      const p = n.parameters;
      if (was in p) { p[now] = p[was]; delete p[was]; }
      if (p.visualFilter) p.visualFilter = filterRenamed(p.visualFilter, from, to);
      if (Array.isArray(p.visualSort)) p.visualSort = p.visualSort.map((s) => (s?.property === from ? { ...s, property: to } : s));
      if (typeof p.properties === 'string') p.properties = props(p.properties).map((x) => (x === from ? to : x)).join(',');
    }
    for (const w of wiresOf(out)) {
      if (ids.has(w.toId) && w.toProperty === was) w.toProperty = now;
      if (ids.has(w.fromId) && w.fromProperty === was) w.fromProperty = now;
    }
    rewriteCode(out, mine, to);
  });
}

/** Type `from` renamed `to`: every node that names it, and the code mentions in `picked`. */
export function renameType(components, from, to, picked = new Set()) {
  const readers = typeReaders(components, from);
  return apply(components, readers, picked, (out, mine) => {
    const ids = new Set(mine.filter((r) => r.kind !== 'code').map((r) => r.node));
    for (const n of nodesOf(out)) if (ids.has(n.id)) n.parameters.collectionName = to;
    rewriteCode(out, mine, to);
  });
}

/** The fields the app's nodes give a collection or read from it (`prop-*` parameters and wires), by collection. */
export function appFields(components) {
  const found = new Map();
  for (const { files } of components) {
    const nodes = nodesOf(files), wires = wiresOf(files);
    const records = pageRecords(nodes);
    for (const n of nodes) {
      const name = n.parameters?.collectionName ?? records.get(n.id);
      if (typeof name !== 'string' || !name) continue;
      const fields = found.get(name) ?? new Set();
      for (const k of Object.keys(n.parameters || {})) if (k.startsWith('prop-')) fields.add(k.slice(5));
      for (const w of wires) {
        if (w.toId === n.id && w.toProperty.startsWith('prop-')) fields.add(w.toProperty.slice(5));
        if (w.fromId === n.id && w.fromProperty.startsWith('prop-')) fields.add(w.fromProperty.slice(5));
      }
      if (n.type === 'Model2') for (const f of props(n.parameters?.properties)) fields.add(f);
      found.set(name, fields);
    }
  }
  return found;
}
