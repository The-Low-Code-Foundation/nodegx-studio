/**
 * NodeGX Studio's importer — the same structure repeated on a page becomes one reusable (STU-050, Richard 2026-10-19:
 * "group elements into components, but not too aggressively").
 *
 * A candidate is a subtree of elements whose shape (each element's type and style, and its children's shapes, in order)
 * appears at least `minCount` times on the page, with at least `minElements` elements. The largest shapes are taken
 * first and nothing inside a taken one is taken again. Everything else about the copies must match too (the keys a node
 * carries besides its parameters, and the wires among their own elements), or the shape is left as it is and said why.
 *
 * The first occurrence becomes the reusable (`extractReusable`); every occurrence becomes a copy where it was. A
 * parameter whose value differs between the occurrences (the text of each feature, its icon) leaves the reusable and
 * becomes an input each copy sets; one that is the same everywhere stays inside. The page's logic never moves: a wire
 * from a copy's button to the page's navigation goes through the copy's output, so each copy keeps its own workflow.
 *
 *   groupRepeats(files, { keyFor, portType, minCount = 3, minElements = 5 }) →
 *     { files, made: [{ key, component, copies, inputs, outputs, varying }], skipped: [{ roots, why }] }
 *
 * `files` is `{ nodes: { nodes, visualRoots? }, connections: { connections } }`; `keyFor(label)` names a new component
 * ("Reusable/Feature item") and must not return a key in use.
 */
import { extractReusable } from '../editor/reusable.mjs';

const OWN = new Set(['id', 'label', 'parent', 'children', 'x', 'y', 'parameters', 'metadata']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function findRepeats(files, { minCount = 3, minElements = 5 } = {}) {
  const nodes = files.nodes.nodes, byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = (id) => (byId.get(id)?.children || []).filter((c) => byId.has(c));
  const sig = new Map(), size = new Map();
  const walk = (id) => {
    if (sig.has(id)) return sig.get(id);
    const n = byId.get(id), ks = kids(id).map(walk);
    sig.set(id, `${n.type}${n.variant ? '#' + n.variant : ''}[${ks.join(',')}]`);
    size.set(id, 1 + kids(id).reduce((a, c) => a + size.get(c), 0));
    return sig.get(id);
  };
  const roots = new Set(files.nodes.visualRoots || nodes.filter((n) => n.parent === undefined && n.children?.length).map((n) => n.id));
  for (const n of nodes) if (n.parent !== undefined || n.children?.length) walk(n.id);
  const bySig = new Map();
  for (const [id, s] of sig) {
    const n = byId.get(id);
    if (roots.has(id) || n.type === 'Page' || size.get(id) < minElements) continue;
    if (!bySig.has(s)) bySig.set(s, []);
    bySig.get(s).push(id);
  }
  const order = (id) => { const path = []; for (let cur = id; byId.get(cur)?.parent !== undefined; cur = byId.get(cur).parent) path.unshift(byId.get(byId.get(cur).parent).children.indexOf(cur)); return path; };
  const before = (a, b) => { const pa = order(a), pb = order(b); for (let i = 0; i < Math.min(pa.length, pb.length); i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return pa.length - pb.length; };
  return [...bySig].filter(([, ids]) => ids.length >= minCount).map(([s, ids]) => ({ sig: s, size: size.get(ids[0]), roots: ids.sort(before) })).sort((a, b) => b.size - a.size);
}

export function groupRepeats(filesIn, { keyFor, portType = () => undefined, minCount = 3, minElements = 5 } = {}) {
  let files = filesIn;
  const made = [], skipped = [], taken = new Set();
  for (const rep of findRepeats(filesIn, { minCount, minElements })) {
    const byId = new Map(files.nodes.nodes.map((n) => [n.id, n]));
    const pre = (id) => { const out = [id]; for (const c of byId.get(id)?.children || []) if (byId.has(c)) out.push(...pre(c)); return out; };
    const inTaken = (id) => { for (let cur = id; cur !== undefined; cur = byId.get(cur)?.parent) if (taken.has(cur)) return true; return false; };
    const roots = rep.roots.filter((r) => byId.has(r) && !inTaken(r));
    if (roots.length < minCount) continue;
    const trees = roots.map(pre);
    const label0 = byId.get(roots[0]).label || byId.get(roots[0]).type;

    // everything but the parameters must match, position by position, and so must the wires among their own elements
    const posOf = trees.map((t) => new Map(t.map((id, i) => [id, i])));
    const differs = (i) => [...new Set(trees.flatMap((t) => { const a = byId.get(trees[0][i]), b = byId.get(t[i]); return Object.keys({ ...a, ...b }).filter((k) => !OWN.has(k) && !same(a[k], b[k])); }))];
    const odd = trees[0].findIndex((id, i) => differs(i).length > 0);
    if (odd >= 0) {
      const what = differs(odd).map((k) => (k === 'stateParameters' ? 'its hover / pressed look' : k === 'variant' ? 'its style' : k)).join(' and ');
      skipped.push({ roots, why: `"${byId.get(trees[0][odd]).label || byId.get(trees[0][odd]).type}" has a different ${what} in some of them, which a copy cannot set` });
      continue;
    }
    const insideWires = (k) => files.connections.connections.filter((w) => posOf[k].has(w.fromId) && posOf[k].has(w.toId)).map((w) => `${posOf[k].get(w.fromId)}.${w.fromProperty}>${posOf[k].get(w.toId)}.${w.toProperty}`).sort().join();
    const w0 = insideWires(0);
    if (trees.some((t, k) => insideWires(k) !== w0)) { skipped.push({ roots, why: 'the wires among their own elements differ between the copies' }); continue; }

    // the settings that differ between the occurrences: (position, name)
    const varying = [];
    trees[0].forEach((id, i) => {
      const names = new Set(trees.flatMap((t) => Object.keys(byId.get(t[i]).parameters || {})));
      for (const name of names) if (trees.some((t) => !same(byId.get(t[i]).parameters?.[name], byId.get(trees[0][i]).parameters?.[name]))) varying.push({ i, name });
    });

    // the reusable, from the first occurrence; the page's logic stays (`stays`), reached through the copy
    const key = keyFor(label0);
    const r = extractReusable(files, roots[0], { key, copyId: `copy-${roots[0]}`, portType, stays: () => true });
    const comp = r.component;
    const cById = new Map(comp.nodes.nodes.map((n) => [n.id, n]));
    const used = new Set([...r.inputs, ...r.outputs]);
    const portName = (port, nodeId) => { const base = nodeId === roots[0] ? String(port) : `${cById.get(nodeId)?.label || String(cById.get(nodeId)?.type || '').split(/[./]/).pop()} ${port}`.trim(); let n = base; for (let j = 2; used.has(n); j++) n = `${base} ${j}`; used.add(n); return n; };
    const ioNode = (type) => {
      let n = comp.nodes.nodes.find((x) => x.type === type);
      if (!n) { n = { id: type === 'Component Inputs' ? 'copyInputs' : 'copyOutputs', type, label: type === 'Component Inputs' ? 'From the copy' : 'To the copy', ports: [], x: 600, y: type === 'Component Inputs' ? 0 : 200 }; comp.nodes.nodes.push(n); }
      return n;
    };
    const inputFor = { ...r.inputFor }, outputFor = { ...r.outputFor };
    const addInput = (toId, toProperty) => {
      const k = toId + '\0' + toProperty;
      if (!inputFor[k]) { const name = portName(toProperty, toId); const io = ioNode('Component Inputs'); const t = portType(toId, 'input', toProperty); io.ports.push({ name, plug: 'output', ...(t ? { type: t } : {}) }); comp.connections.connections.push({ fromId: io.id, fromProperty: name, toId, toProperty }); inputFor[k] = name; }
      return inputFor[k];
    };
    const addOutput = (fromId, fromProperty) => {
      const k = fromId + '\0' + fromProperty;
      if (!outputFor[k]) { const name = portName(fromProperty, fromId); const io = ioNode('Component Outputs'); const t = portType(fromId, 'output', fromProperty); io.ports.push({ name, plug: 'input', ...(t ? { type: t } : {}) }); comp.connections.connections.push({ fromId, fromProperty, toId: io.id, toProperty: name }); outputFor[k] = name; }
      return outputFor[k];
    };
    // a differing setting leaves the reusable: an input, and each copy sets its own value
    const settingPort = varying.map(({ i, name }) => { const id = trees[0][i]; const port = addInput(id, name); delete cById.get(id).parameters?.[name]; return { i, name, port }; });
    const copyParams = (k) => Object.fromEntries(settingPort.map(({ i, name, port }) => [port, byId.get(trees[k][i]).parameters?.[name]]).filter(([, v]) => v !== undefined));

    files = r.page;
    const copies = [r.copyId];
    { const c = files.nodes.nodes.find((n) => n.id === r.copyId); const p = copyParams(0); if (Object.keys(p).length) c.parameters = p; }
    // every other occurrence: a copy where it was, its wires across the edge through the same ports
    for (let k = 1; k < roots.length; k++) {
      const tree = new Set(trees[k]), toFirst = (id) => trees[0][posOf[k].get(id)];
      const root = files.nodes.nodes.find((n) => n.id === roots[k]);
      const copyId = `copy-${roots[k]}`;
      const nodes = [], wires = [];
      for (const n of files.nodes.nodes) {
        if (n.id === roots[k]) { const p = copyParams(k); nodes.push({ id: copyId, type: '/' + key, label: root.label || label0, ...(root.parent !== undefined ? { parent: root.parent } : {}), ...(root.x !== undefined ? { x: root.x, y: root.y } : {}), ...(Object.keys(p).length ? { parameters: p } : {}) }); continue; }
        if (tree.has(n.id)) continue;
        nodes.push(n.children?.includes(roots[k]) ? { ...n, children: n.children.map((c) => (c === roots[k] ? copyId : c)) } : n);
      }
      for (const w of files.connections.connections) {
        const a = tree.has(w.fromId), b = tree.has(w.toId);
        if (a && b) continue;
        if (!a && b) wires.push({ fromId: w.fromId, fromProperty: w.fromProperty, toId: copyId, toProperty: addInput(toFirst(w.toId), w.toProperty) });
        else if (a && !b) wires.push({ fromId: copyId, fromProperty: addOutput(toFirst(w.fromId), w.fromProperty), toId: w.toId, toProperty: w.toProperty });
        else wires.push(w);
      }
      files = { nodes: { ...files.nodes, nodes }, connections: { ...files.connections, connections: wires } };
      copies.push(copyId);
    }
    for (const id of copies) taken.add(id);
    made.push({ key, component: comp, copies, inputs: [...new Set(Object.values(inputFor))], outputs: [...new Set(Object.values(outputFor))], varying: settingPort.map((s) => s.port) });
  }
  return { files, made, skipped };
}
