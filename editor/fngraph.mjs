/**
 * P127 BKO-004 — a cloud function, read as its graph.
 *
 * A function is a component under `__cloud__/`: a Request node in ("When this function is called"), nodes, and one or
 * more Response nodes out (an answer, or a refusal). A helper under `__cloud__/shared/` is placed inside functions and
 * has Component Inputs / Outputs instead. Most of them are wired by VALUE, not by signal (a script runs when its input
 * changes, a Response sends on a script's Done), so the page workflow's `chain()`, which follows signals only, draws
 * them nearly empty. This lays one out from every wire: a column per step away from where it starts, the answers last.
 *
 * Read only, and pure: nodes and connections in, a layout and words out. Studio draws it (renderFunction) and
 * fngraph-check.mjs grades it on every function of five templates without a browser.
 */
export const CLOUD = '__cloud__/';
export const REQUEST = 'noodl.cloud.request';
export const RESPONSE = 'noodl.cloud.response';

const SKIP = new Set(['Comment']);
const FAIL = /^(failed|failure|error|onerror|rejected|out-failed)$/i;

/** The functions in a list of component keys: endpoints (with a Request) first, then the helpers they place. */
export function functionList(keys, nodesOf) {
  const out = [];
  for (const key of keys) {
    if (!key.startsWith(CLOUD)) continue;
    let nodes = []; try { nodes = nodesOf(key) ?? []; } catch { nodes = []; }
    const endpoint = nodes.some((n) => n.type === REQUEST);
    out.push({ key, name: key.slice(CLOUD.length), endpoint, steps: nodes.filter((n) => !SKIP.has(n.type)).length });
  }
  return out.sort((a, b) => (a.endpoint === b.endpoint ? a.name.localeCompare(b.name) : a.endpoint ? -1 : 1));
}

/** `/#__cloud__/shared/Caller learner` → `__cloud__/shared/Caller learner`: a helper placed in a function. */
export function helperKey(type) {
  const k = String(type).replace(/^\/#?/, '');
  return k.startsWith(CLOUD) ? k : null;
}

/** The names a Request asks for, each with its type and whether it must be sent. */
export function requestAsks(req) {
  const p = req?.parameters || {};
  return String(p.params || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((name) => ({ name, type: p[`ptype-${name}`] || 'any', required: p[`preq-${name}`] === true }));
}

/** What a Response says: an answer with the values it sends, or a refusal with its message. */
export function responseWords(res, conns = []) {
  const p = res?.parameters || {};
  const refusal = p.status === 'failure';
  const sends = String(p.params || '').split(',').map((s) => s.trim()).filter(Boolean);
  const wiredMessage = conns.some((c) => c.toId === res.id && c.toProperty === 'errorMessage');
  return { refusal, sends, message: typeof p.errorMessage === 'string' ? p.errorMessage : wiredMessage ? null : '' };
}

/**
 * The layout. `isSignal(conn)` says whether a wire carries a signal (Studio reads its node library; the check guesses
 * from the port's name). Returns
 *   columns: [[id, …], …]  column 0 is where it starts (the Request, or Component Inputs), the last holds the answers
 *   wires:   [{ from, fromPort, to, toPort, kind: 'signal' | 'value' | 'fail' }]
 *   start, answers, loose (nodes no wire reaches or leaves: drawn in the first column, said apart)
 */
export function functionLayout(nodes, conns, isSignal = () => false) {
  const byId = new Map(nodes.filter((n) => !SKIP.has(n.type)).map((n) => [n.id, n]));
  const wires = conns.filter((c) => byId.has(c.fromId) && byId.has(c.toId) && c.fromId !== c.toId).map((c) => ({
    from: c.fromId, fromPort: c.fromProperty, to: c.toId, toPort: c.toProperty,
    kind: FAIL.test(c.fromProperty) ? 'fail' : isSignal(c) ? 'signal' : 'value'
  }));
  const isStart = (n) => n.type === REQUEST || n.type === 'Component Inputs';
  const isAnswer = (n) => n.type === RESPONSE || n.type === 'Component Outputs';
  const outs = new Map(), ins = new Map();
  for (const w of wires) { (outs.get(w.from) ?? outs.set(w.from, []).get(w.from)).push(w); (ins.get(w.to) ?? ins.set(w.to, []).get(w.to)).push(w); }

  // a loop: the wire that closes it, found walking forward from the start (then from anything not yet reached), does
  // not count for the layout; the rest is laid out by the longest path to each node
  const back = new Set(), state = new Map(); // 1 on the walk, 2 done
  const walk = (id) => {
    state.set(id, 1);
    for (const w of outs.get(id) ?? []) {
      if (state.get(w.to) === 1 || isStart(byId.get(w.to))) back.add(w);
      else if (!state.has(w.to)) walk(w.to);
    }
    state.set(id, 2);
  };
  for (const id of [...byId.keys()].sort((a, b) => isStart(byId.get(b)) - isStart(byId.get(a)))) if (!state.has(id)) walk(id);
  const depth = new Map();
  const visit = (id) => {
    if (depth.has(id)) return depth.get(id);
    let d = 0;
    for (const w of ins.get(id) ?? []) if (!back.has(w)) d = Math.max(d, visit(w.from) + 1);
    depth.set(id, d);
    return d;
  };
  for (const id of byId.keys()) visit(id);

  const loose = [...byId.keys()].filter((id) => !(ins.get(id)?.length) && !(outs.get(id)?.length) && !isStart(byId.get(id)));
  const placed = [...byId.keys()].filter((id) => !loose.includes(id));
  const answers = placed.filter((id) => isAnswer(byId.get(id)));
  const inner = placed.filter((id) => !isAnswer(byId.get(id)));
  const last = Math.max(0, ...inner.map((id) => depth.get(id))) + 1;
  for (const id of answers) depth.set(id, Math.max(last, depth.get(id)));
  const width = Math.max(1, ...placed.map((id) => depth.get(id) + 1));
  const columns = Array.from({ length: width }, () => []);
  for (const id of placed) columns[depth.get(id)].push(id);
  // the start leads its column; in each column, nodes sit level with what feeds them (the mean row of their sources);
  // the answers, a refusal below an answer
  const row = new Map();
  columns.forEach((col, i) => {
    const key = (id) => {
      const n = byId.get(id);
      if (isStart(n)) return -1e9;
      if (i === width - 1 && isAnswer(n)) return (n.type === RESPONSE && n.parameters?.status === 'failure' ? 1e6 : 0) + (n.y ?? 0) / 1e3;
      const src = (ins.get(id) ?? []).map((w) => row.get(w.from)).filter((r) => r !== undefined);
      return src.length ? src.reduce((a, b) => a + b, 0) / src.length : 1e3 + (n.y ?? 0) / 1e3;
    };
    const keyed = col.map((id) => [id, key(id)]).sort((a, b) => a[1] - b[1] || (byId.get(a[0]).y ?? 0) - (byId.get(b[0]).y ?? 0));
    col.splice(0, col.length, ...keyed.map(([id]) => id));
    col.forEach((id, r) => row.set(id, r));
  });
  if (loose.length) columns[0].push(...loose);
  return {
    columns, wires, loose,
    start: [...byId.values()].find(isStart)?.id ?? null,
    answers,
    helpers: [...new Set([...byId.values()].map((n) => helperKey(n.type)).filter(Boolean))]
  };
}

/**
 * The tables a script names where it calls the records API with one: `Records.query('Lesson'`, `Noodl.Records.create("Note"`,
 * `className: 'Thread'` inside a Records call's options. With no backend up, the map knows no table, and these are the
 * names it is handed so that it can read what each function does with them.
 */
export function scriptTableNames(script) {
  const out = new Set(), call = '(?:query|fetch|count|aggregate|distinct|get|create|save|update|delete|remove)';
  for (const m of String(script).matchAll(new RegExp(`Records\\.${call}\\s*\\(\\s*(['"\`])([A-Za-z_]\\w*)\\1`, 'g'))) out.add(m[2]);
  for (const m of String(script).matchAll(new RegExp(`Records\\.${call}\\s*\\([^;]{0,200}?className\\s*:\\s*(['"\`])([A-Za-z_]\\w*)\\1`, 'g'))) out.add(m[2]);
  return [...out].filter((n) => !n.startsWith('_'));
}

/** The touches the map reads (`@nodegx/backend-map`'s analyseProject) in a line: "reads Lesson · creates Note". */
export function touchesWords(touches = []) {
  const by = {};
  for (const t of touches) for (const how of t.hows ?? []) if (how !== 'mentions') (by[how] ??= []).push(t.table);
  const order = ['reads', 'creates', 'changes', 'deletes'];
  return order.filter((h) => by[h]?.length).map((h) => `${h} ${by[h].join(', ')}`);
}
