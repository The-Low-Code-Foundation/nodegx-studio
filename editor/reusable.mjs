/**
 * NodeGX Studio — "make a reusable from this group" (STU-050's last line), as a pure function over a component's files.
 *
 * What moves: the group and everything inside it, plus the logic that only they use (a node whose every wire is to
 * something that moves, reached from the group). What stays: page data (it belongs to the page, STU-010) and the
 * page's own Component Inputs / Outputs. A wire that crosses the edge becomes a port: into the group, a Component
 * Inputs port the copy is wired to; out of it, a Component Outputs port the copy sends on. One input per inside port
 * it reaches (two outside values into one text stay two wires, into one input), one output per inside source. The group's own settings stay on
 * the group, which becomes the reusable's top element, so the copy draws what the group drew.
 *
 *   extractReusable(files, groupId, { key, copyId, portType, stays }) →
 *     { component, page, copyId, inputs, outputs, moved, logic, inputsId, outputsId, inputFor, outputFor }
 *
 * `files` is `{ nodes: <nodes.json>, connections: <connections.json> }`; the returned halves have the same shape.
 * `portType(nodeId, plug, port)` says a port's type ('signal', 'string', … or undefined); `stays(node)` keeps a logic
 * node on the page whatever it is wired to (Studio passes its page data test).
 */

const INTERFACE = new Set(['Component Inputs', 'Component Outputs']);
const copy = (v) => JSON.parse(JSON.stringify(v));

export function extractReusable(files, groupId, { key, copyId = 'copy-' + Math.random().toString(36).slice(2, 10), portType = () => undefined, stays = () => false } = {}) {
  const nodes = files.nodes.nodes, wires = files.connections.connections;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const group = byId.get(groupId);
  if (!group) throw new Error(`extractReusable: no node "${groupId}"`);
  if (!key) throw new Error('extractReusable: the new component needs a key');

  // the group and its subtree
  const tree = new Set([groupId]);
  for (let grew = true; grew;) { grew = false; for (const n of nodes) if (n.parent !== undefined && tree.has(n.parent) && !tree.has(n.id)) { tree.add(n.id); grew = true; } }

  // the logic only they use: the largest set whose every wire stays inside (tree ∪ set), then only what the tree reaches
  const neighbours = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const w of wires) { neighbours.get(w.fromId)?.add(w.toId); neighbours.get(w.toId)?.add(w.fromId); }
  const free = (n) => n.parent === undefined && !tree.has(n.id) && !(n.children?.length) && !(files.nodes.visualRoots || []).includes(n.id) && !INTERFACE.has(n.type) && !stays(n);
  let logic = new Set(nodes.filter(free).map((n) => n.id));
  for (let shrank = true; shrank;) {
    shrank = false;
    for (const id of logic) if ([...neighbours.get(id)].some((o) => o !== id && !tree.has(o) && !logic.has(o))) { logic.delete(id); shrank = true; }
  }
  const reached = new Set();
  const visit = (id) => { for (const o of neighbours.get(id) || []) if (logic.has(o) && !reached.has(o)) { reached.add(o); visit(o); } };
  for (const id of tree) visit(id);
  logic = reached;
  const moves = (id) => tree.has(id) || logic.has(id);

  // the wires: inside, crossing in, crossing out, untouched
  const inside = [], into = [], out = [], rest = [];
  for (const w of wires) {
    const a = moves(w.fromId), b = moves(w.toId);
    (a && b ? inside : !a && b ? into : a && !b ? out : rest).push(w);
  }
  // a port is named after the element inside it reaches ("Email onTextChanged"), bare only for the group itself: a copy
  // input called "mounted" that hid one text inside would read as hiding the whole copy
  const used = new Set();
  const nameFor = (port, nodeId) => {
    const base = nodeId === groupId ? String(port) : `${labelOf(nodeId) || String(byId.get(nodeId)?.type || '').split(/[./]/).pop()} ${port}`.trim();
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base} ${i}`;
    used.add(name); return name;
  };
  const labelOf = (id) => byId.get(id)?.label || '';

  const inPorts = new Map(); // "toId\0toProperty" → port: two outside values into one inside port stay two wires into one input
  for (const w of into) {
    const k = w.toId + '\0' + w.toProperty;
    if (!inPorts.has(k)) inPorts.set(k, { name: nameFor(w.toProperty, w.toId), type: portType(w.toId, 'input', w.toProperty) ?? portType(w.fromId, 'output', w.fromProperty), from: w });
  }
  const outPorts = new Map();
  for (const w of out) {
    const k = w.fromId + '\0' + w.fromProperty;
    if (!outPorts.has(k)) outPorts.set(k, { name: nameFor(w.fromProperty, w.fromId), type: portType(w.fromId, 'output', w.fromProperty) ?? portType(w.toId, 'input', w.toProperty), from: w });
  }

  // the reusable's files
  const ids = new Set(nodes.map((n) => n.id));
  const fresh = (want) => { let id = want; for (let i = 2; ids.has(id); i++) id = `${want}-${i}`; ids.add(id); return id; };
  const cNodes = nodes.filter((n) => moves(n.id)).map(copy);
  const top = cNodes.find((n) => n.id === groupId);
  delete top.parent;
  const cWires = inside.map(copy);
  const xs = cNodes.map((n) => n.x ?? 0), right = Math.max(0, ...xs) + 300, topY = Math.min(0, ...cNodes.map((n) => n.y ?? 0));
  let inId, outId;
  if (inPorts.size) {
    inId = fresh('copyInputs');
    cNodes.push({ id: inId, type: 'Component Inputs', label: 'From the copy', ports: [...inPorts.values()].map((p) => ({ name: p.name, plug: 'output', ...(p.type ? { type: p.type } : {}) })), x: right, y: topY });
    for (const p of inPorts.values()) cWires.push({ fromId: inId, fromProperty: p.name, toId: p.from.toId, toProperty: p.from.toProperty });
  }
  if (outPorts.size) {
    outId = fresh('copyOutputs');
    cNodes.push({ id: outId, type: 'Component Outputs', label: 'To the copy', ports: [...outPorts.values()].map((p) => ({ name: p.name, plug: 'input', ...(p.type ? { type: p.type } : {}) })), x: right, y: topY + 200 });
    for (const p of outPorts.values()) cWires.push({ fromId: p.from.fromId, fromProperty: p.from.fromProperty, toId: outId, toProperty: p.name });
  }
  const component = {
    nodes: { ...copy({ ...files.nodes, nodes: [] }), nodes: cNodes, visualRoots: [groupId] },
    connections: { ...copy({ ...files.connections, connections: [] }), connections: dedupe(cWires) }
  };
  delete component.nodes.componentId; delete component.connections.componentId;

  // the page's files: the copy where the group was
  const copyIdFree = ids.has(copyId) ? fresh(copyId) : (ids.add(copyId), copyId);
  const pNodes = [];
  for (const n of nodes) {
    if (n.id === groupId) { pNodes.push({ id: copyIdFree, type: '/' + key, label: group.label || key.split('/').pop(), ...(group.parent !== undefined ? { parent: group.parent } : {}), ...(group.x !== undefined ? { x: group.x, y: group.y } : {}) }); continue; }
    if (moves(n.id)) continue;
    const m = copy(n);
    if (m.children) m.children = m.children.map((c) => (c === groupId ? copyIdFree : c));
    pNodes.push(m);
  }
  const pWires = rest.map(copy);
  for (const w of into) pWires.push({ fromId: w.fromId, fromProperty: w.fromProperty, toId: copyIdFree, toProperty: inPorts.get(w.toId + '\0' + w.toProperty).name });
  for (const w of out) pWires.push({ fromId: copyIdFree, fromProperty: outPorts.get(w.fromId + '\0' + w.fromProperty).name, toId: w.toId, toProperty: w.toProperty });
  const page = { nodes: { ...copy({ ...files.nodes, nodes: [] }), nodes: pNodes }, connections: { ...copy({ ...files.connections, connections: [] }), connections: dedupe(pWires) } };
  if (files.nodes.visualRoots) page.nodes.visualRoots = files.nodes.visualRoots.map((r) => (r === groupId ? copyIdFree : r));

  return {
    component, page, copyId: copyIdFree, inputs: [...inPorts.values()].map((p) => p.name), outputs: [...outPorts.values()].map((p) => p.name), moved: [...tree, ...logic],
    logic: [...logic], inputsId: inId, outputsId: outId,
    // which input carries a wire into an inside port, which output a wire out of an inside source ("id\0port" → name)
    inputFor: Object.fromEntries([...inPorts].map(([k, p]) => [k, p.name])), outputFor: Object.fromEntries([...outPorts].map(([k, p]) => [k, p.name]))
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((w) => { const k = [w.fromId, w.fromProperty, w.toId, w.toProperty].join('\0'); if (seen.has(k)) return false; seen.add(k); return true; });
}
