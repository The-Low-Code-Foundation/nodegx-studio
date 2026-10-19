/**
 * Page data (STU-010): a search exists only as a named item on a page, never inside a field.
 *
 * The format (proposed ruling R7): an item is ONE Query Records node (`DbCollection2`) in the page's own component, not
 * inside any element, carrying `metadata.pageData = { name, first }`. It is exactly the node an experienced NodeGX
 * builder puts at the top of a page by hand, so the NodeGX editor, the MCP server and the runtime read it as what it
 * is; the metadata only says "Studio shows this as page data called <name>".
 *
 *   - What it asks: `collectionName`, `visualFilter` in the one saved shape the NodeGX editor writes
 *     (`{type, conditions}`, neutral operators), `visualSort`, and a limit.
 *   - A condition's value is typed in (`valueSource: 'static'`) or comes from something on the page (Current User, a
 *     dropdown, another item): `valueSource: 'connected'` names a `qp-` input and a wire brings the value to it.
 *   - It loads when the page opens and runs again when what it reads changes: the Query Records node does both by
 *     itself (NDA-017). Studio writes `runOnChange-…: true` for every input it uses, because the NodeGX editor's
 *     migration turns an unwritten one OFF on a node whose `Do` is wired, and a workflow may wire `Do` to refresh it.
 *   - A "first" item ("first Org where …") is the same query with a limit of 1, plus one Object node (`Model2`) bound
 *     to its first record (`firstItemId` → `modelId`) with `metadata.pageDataRecord = { item }`; an element reads
 *     "org's name" from that node's `prop-name`. A list item is read whole (`items`, `count`, `isEmpty`).
 *
 * An element reads an item through a wire from one of those two nodes (directly, or as a chip of a composed
 * Expression), so "how many elements read it" is counted off the wires, and two items asking the same question are
 * found by comparing what they ask (`signature`).
 *
 * Pure: the page's nodes and wires in, items or edits (the vocabulary of ./edits.mjs) out.
 */

export const QUERY = 'DbCollection2';
export const RECORD = 'Model2';

/** The neutral operators an item offers (the NodeGX editor's filter builder writes the same names). */
export const OPERATORS = [
  ['equalTo', 'is'], ['notEqualTo', 'is not'], ['greaterThan', '>'], ['lessThan', '<'], ['greaterThanOrEqualTo', '≥'],
  ['lessThanOrEqualTo', '≤'], ['containsIgnoreCase', 'contains'], ['startsWithIgnoreCase', 'starts with'],
  ['containedIn', 'is in'], ['exists', 'is set'], ['isEmpty', 'is empty'], ['pointsTo', 'is (a link)']
];

const portSlug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('') || 'value';
const props = (s) => (typeof s === 'string' && s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** An item as Studio holds it. `where` conditions are `{field, op, value}` or `{field, op, from: {node, port}}`. */
export function normalise(item) {
  return {
    name: item.name,
    collection: item.collection,
    match: item.match === 'any' ? 'any' : 'all',
    where: (item.where || []).map((c) => (c.from ? { field: c.field, op: c.op, from: { node: c.from.node, port: c.from.port } } : { field: c.field, op: c.op, ...(c.value !== undefined ? { value: c.value } : {}) })),
    sort: (item.sort || []).map((s) => ({ field: s.field, order: s.order === 'descending' ? 'descending' : 'ascending' })),
    first: !!item.first,
    ...(item.first ? {} : item.limit !== undefined ? { limit: item.limit } : {})
  };
}

/** What an item asks, as one string: two items with the same signature are the same query. Order of conditions does not matter. */
export function signature(item) {
  const n = normalise(item);
  const cond = (c) => JSON.stringify([c.field, c.op, c.from ? `<${c.from.node}.${c.from.port}>` : c.value ?? null]);
  return JSON.stringify([n.collection, n.match, n.where.map(cond).sort(), n.sort.map((s) => [s.field, s.order]), n.first, n.limit ?? null]);
}

/** The item on the page that already asks this, if any. */
export const sameAs = (items, item) => items.find((i) => signature(i) === signature(item));

/** The page's items, read back from its nodes and wires. An item whose filter Studio cannot show (a nested group) says so in `unsupported`. */
export function readItems(nodes, conns) {
  const items = [];
  for (const q of nodes) {
    if (q.type !== QUERY || !q.metadata?.pageData) continue;
    const p = q.parameters || {};
    const into = (port) => conns.find((c) => c.toId === q.id && c.toProperty === port);
    const where = [];
    let match = 'all', unsupported;
    const f = p.visualFilter;
    if (f && Array.isArray(f.conditions)) {
      match = f.type === 'or' ? 'any' : 'all';
      for (const c of f.conditions) {
        if (c.type === 'and' || c.type === 'or') { unsupported = 'a group inside the filter'; continue; }
        if (c.kind === 'relation') { unsupported = 'a "related to" condition'; continue; }
        if (c.valueSource === 'connected') { const w = into(c.valuePortName); where.push({ field: c.field, op: c.operator, from: w ? { node: w.fromId, port: w.fromProperty } : null, port: c.valuePortName }); }
        else where.push({ field: c.field, op: c.operator, ...(c.value !== undefined ? { value: c.value } : {}) });
      }
    } else if (f && Array.isArray(f.rules)) {
      // the shape the NodeGX editor rewrites on open; a project not opened there since still holds it
      match = f.combinator === 'or' ? 'any' : 'all';
      for (const r of f.rules) {
        if (r.rules) { unsupported = 'a group inside the filter'; continue; }
        if (r.input !== undefined) { const w = into('qp-' + r.input); where.push({ field: r.property, op: r.operator, from: w ? { node: w.fromId, port: w.fromProperty } : null, port: 'qp-' + r.input }); }
        else where.push({ field: r.property, op: r.operator, value: r.value });
      }
    }
    const first = !!q.metadata.pageData.first;
    const record = first ? nodes.find((n) => n.type === RECORD && n.metadata?.pageDataRecord?.item === q.id) : undefined;
    items.push({
      id: q.id,
      name: q.metadata.pageData.name,
      collection: p.collectionName,
      match,
      where,
      sort: (p.visualSort || []).map((s) => ({ field: s.property, order: s.order === 'descending' ? 'descending' : 'ascending' })),
      first,
      ...(!first && p.storageEnableLimit ? { limit: p.storageLimit ?? 10 } : {}),
      ...(record ? { recordId: record.id, fields: props(record.parameters?.properties) } : {}),
      ...(unsupported ? { unsupported } : {})
    });
  }
  return items;
}

/** The value ports a set of conditions needs, one per connected condition, named after its field. */
function portsFor(where) {
  const used = new Set();
  return where.map((c) => {
    if (!c.from) return null;
    const base = 'qp-' + portSlug(c.field);
    let name = base, i = 2;
    while (used.has(name)) name = `${base}${i++}`;
    used.add(name);
    return name;
  });
}

/** The Query Records node's parameters for an item (every key Studio owns; `undefined` means "not set"). */
export function queryParameters(item) {
  const n = normalise(item);
  const ports = portsFor(n.where);
  const params = {
    collectionName: n.collection,
    'runOnChange-collectionName': true,
    'runOnChange-querySettings': true,
    visualFilter: n.where.length
      ? { type: n.match === 'any' ? 'or' : 'and', conditions: n.where.map((c, i) => (c.from ? { field: c.field, operator: c.op, valueSource: 'connected', valuePortName: ports[i] } : { field: c.field, operator: c.op, ...(c.value !== undefined ? { value: c.value } : {}), valueSource: 'static' })) }
      : undefined,
    visualSort: n.sort.length ? n.sort.map((s) => ({ property: s.field, order: s.order })) : undefined,
    storageEnableLimit: n.first || n.limit !== undefined ? true : undefined,
    storageLimit: n.first ? 1 : n.limit
  };
  for (const port of ports) if (port) params['runOnChange-' + port] = true;
  return { params, wires: n.where.map((c, i) => (c.from ? { from: c.from, port: ports[i] } : null)).filter(Boolean) };
}

const uuid = () => crypto.randomUUID();

/** The edits that put a new item on a page. Returns the ids so a caller can wire a reader in the same gesture. */
export function createEdits(item, { component, x = 1000, y = 100 } = {}) {
  const n = normalise(item);
  const id = item.id ?? uuid();
  const { params, wires } = queryParameters(n);
  const parameters = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const list = [{ edit: 'add_node', component, id, type: QUERY, label: n.name, x, y, parameters, metadata: { pageData: { name: n.name, first: n.first } } }];
  for (const w of wires) list.push({ edit: 'connect', component, from: w.from, to: { node: id, port: w.port } });
  let recordId;
  if (n.first) {
    recordId = item.recordId ?? uuid();
    const fields = item.fields?.length ? { properties: item.fields.join(',') } : {};
    list.push({ edit: 'add_node', component, id: recordId, type: RECORD, label: `${n.name} (its first record)`, x: x + 260, y, parameters: fields, metadata: { pageDataRecord: { item: id } } });
    list.push({ edit: 'connect', component, from: { node: id, port: 'firstItemId' }, to: { node: recordId, port: 'modelId' } });
  }
  return { edits: list, id, recordId };
}

/** The edits that change an existing item (`current`, as read) into `next`: its question, its name, list ↔ first. */
export function updateEdits(current, next, { component, nodes, conns }) {
  const n = normalise(next);
  const q = nodes.find((x) => x.id === current.id);
  const { params, wires } = queryParameters(n);
  const list = [];
  for (const [k, v] of Object.entries(params)) if (JSON.stringify(q.parameters?.[k]) !== JSON.stringify(v)) list.push({ edit: 'set_parameter', component, id: q.id, name: k, value: v });
  // a run-on-change box for a value port that is gone goes with it
  for (const k of Object.keys(q.parameters || {})) if (/^runOnChange-qp-/.test(k) && !(k in params)) list.push({ edit: 'set_parameter', component, id: q.id, name: k, value: undefined });
  const wanted = wires.map((w) => ({ fromId: w.from.node, fromProperty: w.from.port, toId: q.id, toProperty: w.port }));
  const same = (a, b) => a.fromId === b.fromId && a.fromProperty === b.fromProperty && a.toId === b.toId && a.toProperty === b.toProperty;
  for (const c of conns) if (c.toId === q.id && /^qp-/.test(c.toProperty) && !wanted.some((w) => same(w, c))) list.push({ edit: 'disconnect', component, from: { node: c.fromId, port: c.fromProperty }, to: { node: q.id, port: c.toProperty } });
  for (const w of wanted) if (!conns.some((c) => same(c, w))) list.push({ edit: 'connect', component, from: { node: w.fromId, port: w.fromProperty }, to: { node: q.id, port: w.toProperty } });
  if (current.name !== n.name || current.first !== n.first) {
    list.push({ edit: 'rename', component, id: q.id, label: n.name });
    list.push({ edit: 'set_metadata', component, id: q.id, metadata: { pageData: { name: n.name, first: n.first } } });
  }
  if (n.first && !current.recordId) {
    const recordId = uuid();
    list.push({ edit: 'add_node', component, id: recordId, type: RECORD, label: `${n.name} (its first record)`, x: (q.x ?? 1000) + 260, y: q.y ?? 100, metadata: { pageDataRecord: { item: q.id } } });
    list.push({ edit: 'connect', component, from: { node: q.id, port: 'firstItemId' }, to: { node: recordId, port: 'modelId' } });
  } else if (!n.first && current.recordId) list.push({ edit: 'remove_node', component, id: current.recordId });
  else if (current.recordId && current.name !== n.name) list.push({ edit: 'rename', component, id: current.recordId, label: `${n.name} (its first record)` });
  return list;
}

/** The edits that take an item off the page (its record node and every wire to or from either go with it). */
export const removeEdits = (item, { component }) => [{ edit: 'remove_node', component, id: item.id }, ...(item.recordId ? [{ edit: 'remove_node', component, id: item.recordId }] : [])];

/**
 * Where a reader takes a value from: a list item's `items` / `count` / `isEmpty`, or a first item's field (which the
 * record node must list, so the edit to add it comes back too). `text` is how the chip reads.
 */
export function readFrom(item, what, { component, nodes }) {
  const edits = [];
  if (!item.first) {
    const port = { list: 'items', count: 'count', empty: 'isEmpty' }[what] ?? 'items';
    return { node: item.id, port, text: `${item.name} · ${{ items: 'the list', count: 'count', isEmpty: 'is empty' }[port]}`, edits };
  }
  if (what === 'id') return { node: item.id, port: 'firstItemId', text: `${item.name}'s id`, edits };
  if (what === 'empty') return { node: item.id, port: 'isEmpty', text: `${item.name} is empty`, edits };
  const rec = nodes.find((n) => n.id === item.recordId);
  const have = props(rec?.parameters?.properties);
  if (!have.includes(what)) edits.push({ edit: 'set_parameter', component, id: item.recordId, name: 'properties', value: [...have, what].join(',') });
  return { node: item.recordId, port: 'prop-' + what, text: `${item.name}'s ${what}`, edits };
}

/** The item a wire's source belongs to (the query or its record node), or undefined. */
export const itemOfSource = (items, nodeId) => items.find((i) => i.id === nodeId || i.recordId === nodeId);

/**
 * The nodes that read an item: every node one of its two nodes is wired to, except the record node itself and the
 * item's own condition inputs; a composed Expression counts as the element whose field it feeds.
 */
export function readersOf(item, nodes, conns) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const readers = new Set();
  for (const c of conns) {
    if (c.fromId !== item.id && c.fromId !== item.recordId) continue;
    if (c.toId === item.recordId) continue;
    const to = byId.get(c.toId);
    if (!to) continue;
    readers.add(to.metadata?.composedFor?.node ?? to.id);
  }
  return [...readers];
}

/** How an item reads in a list: "first Org where creator is ⟨Who is signed in's id⟩, newest first". */
export function describe(item, labelOfSource = (from) => `${from.node}.${from.port}`) {
  const opText = Object.fromEntries(OPERATORS);
  const cond = item.where.map((c) => `${c.field} ${opText[c.op] ?? c.op}${c.op === 'exists' || c.op === 'isEmpty' ? '' : ' ' + (c.from ? `⟨${labelOfSource(c.from)}⟩` : JSON.stringify(c.value ?? ''))}`);
  const sort = item.sort.map((s) => `by ${s.field}${s.order === 'descending' ? ', descending' : ''}`);
  return `${item.first ? 'first' : 'every'} ${item.collection || '(no type)'}${cond.length ? ' where ' + cond.join(item.match === 'any' ? ' or ' : ' and ') : ''}${sort.length ? ', ' + sort.join(', then ') : ''}${item.limit !== undefined ? `, at most ${item.limit}` : ''}`;
}

/* ---------------- what the app really asked (the frame's probe log, ./probe.js) ---------------- */

/** A logged request that is a query: the Parse wire's `{_method: 'GET'}` POST to `/classes/<collection>`. */
export const isQuery = (e) => e.kind === 'request' && e.method === 'POST' && e.body?._method === 'GET' && /\/classes\/[^/]+$/.test(e.path || '');
const collectionOf = (e) => decodeURIComponent(/\/classes\/([^/]+)$/.exec(e.path)[1]);
function whereFields(where, out = new Set()) {
  if (Array.isArray(where)) for (const w of where) whereFields(w, out);
  else if (where && typeof where === 'object') for (const [k, v] of Object.entries(where)) { if (!k.startsWith('$')) out.add(k); else whereFields(v, out); }
  return out;
}

/**
 * Is this query the item's? The same collection, order and limit, and a filter naming the item's fields: all of its
 * typed ones, and of its page-value ones whichever had a value (the runtime drops a condition whose value is empty).
 */
export function requestMatches(item, e) {
  if (!isQuery(e) || collectionOf(e) !== item.collection) return false;
  const order = item.sort.map((s) => (s.order === 'descending' ? '-' : '') + s.field).join(',');
  if ((e.body.order || '') !== order) return false;
  if ((e.body.limit ?? undefined) !== (item.first ? 1 : item.limit)) return false;
  const seen = whereFields(e.body.where);
  const all = new Set(item.where.map((c) => c.field));
  return [...seen].every((f) => all.has(f)) && item.where.every((c) => c.from || seen.has(c.field));
}

/** The item's last run in this frame: when (ms since the frame opened), how long, how many rows, the status; undefined if it has not run. */
export function lastRun(item, log) {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (requestMatches(item, e)) return { t: e.t0, ms: e.t1 !== undefined ? e.t1 - e.t0 : undefined, rows: e.rows, status: e.status, running: e.t1 === undefined };
  }
  return undefined;
}

/**
 * The queries the app made opening a page: from its last arrival at a path `isPage` accepts, every request until the
 * network had been quiet for `quietMs` (a request answered starts the wait again), or until it left for another page.
 * `settled` is false while that window is still open at `now`; `arrived` is false if the app is not on that page.
 */
export function queriesOnOpen(log, isPage, { quietMs = 1000, now = Infinity } = {}) {
  let from = -1;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].kind === 'nav') { if (isPage(log[i].path)) from = i; break; }
  if (from < 0) return { arrived: false, queries: [], settled: true };
  let edge = log[from].t; // a request still in flight keeps the window open
  const queries = [];
  for (let i = from + 1; i < log.length; i++) {
    const e = log[i];
    if (e.kind === 'nav') { if (!isPage(e.path)) break; continue; }
    if (e.t0 > edge + quietMs) break;
    if (isQuery(e)) queries.push(e);
    edge = Math.max(edge, e.t1 ?? Infinity);
  }
  return { arrived: true, queries, settled: now > edge + quietMs };
}
