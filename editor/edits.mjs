/**
 * The edits Studio makes to a component's files: the eight of the NodeGX editor suite (`editor-suite/edits.ts`), with its
 * semantics, plus the three fields of a node record those eight do not touch (`set_variant`, `set_metadata`, `set_state_parameter`). Pure: files
 * in, files out — the page applies them through the kit's store, and a gate can apply them in Node.
 */
export function applyEdit(filesIn, edit) {
  const out = JSON.parse(JSON.stringify(filesIn));
  const nodes = out.nodes.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const must = (id, what) => { const n = byId.get(id); if (!n) throw new Error(`${what}: node "${id}" does not exist.`); return n; };
  const attach = (child, parentId, index) => {
    const parent = must(parentId, 'attach');
    if (!parent.children) parent.children = [];
    if (!parent.children.includes(child.id)) {
      const at = index !== undefined ? Math.max(0, Math.min(index, parent.children.length)) : parent.children.length;
      parent.children.splice(at, 0, child.id);
    }
    child.parent = parentId;
  };
  switch (edit.edit) {
    case 'add_node': {
      const id = edit.id ?? crypto.randomUUID();
      if (byId.has(id)) throw new Error(`add_node: "${id}" exists`);
      const node = { id, type: edit.type };
      if (edit.label !== undefined) node.label = edit.label;
      if (edit.x !== undefined) node.x = edit.x;
      if (edit.y !== undefined) node.y = edit.y;
      if (edit.parameters) node.parameters = { ...edit.parameters };
      if (edit.metadata) node.metadata = { ...edit.metadata };
      if (edit.parent !== undefined) attach(node, edit.parent, edit.index);
      nodes.push(node);
      return { files: out, id };
    }
    case 'remove_node': {
      must(edit.id, 'remove_node');
      const doomed = new Set([edit.id]);
      let grew = true;
      while (grew) { grew = false; for (const n of nodes) if (n.parent !== undefined && doomed.has(n.parent) && !doomed.has(n.id)) { doomed.add(n.id); grew = true; } }
      out.nodes.nodes = nodes.filter((n) => !doomed.has(n.id));
      for (const n of out.nodes.nodes) if (n.children) { n.children = n.children.filter((c) => !doomed.has(c)); if (!n.children.length) delete n.children; }
      out.connections.connections = out.connections.connections.filter((c) => !doomed.has(c.fromId) && !doomed.has(c.toId));
      if (out.nodes.visualRoots) { out.nodes.visualRoots = out.nodes.visualRoots.filter((id) => !doomed.has(id)); if (!out.nodes.visualRoots.length) delete out.nodes.visualRoots; }
      return { files: out };
    }
    case 'connect': {
      const c = { fromId: edit.from.node, fromProperty: edit.from.port, toId: edit.to.node, toProperty: edit.to.port };
      must(c.fromId, 'connect'); must(c.toId, 'connect');
      if (out.connections.connections.some((x) => sameWire(x, c))) throw new Error('connect: that wire exists');
      out.connections.connections.push(c);
      return { files: out };
    }
    case 'disconnect': {
      const c = { fromId: edit.from.node, fromProperty: edit.from.port, toId: edit.to.node, toProperty: edit.to.port };
      out.connections.connections = out.connections.connections.filter((x) => !sameWire(x, c));
      return { files: out };
    }
    case 'set_parameter': {
      const node = must(edit.id, 'set_parameter');
      if (edit.value === undefined) { if (node.parameters) delete node.parameters[edit.name]; }
      else node.parameters = { ...(node.parameters ?? {}), [edit.name]: edit.value };
      return { files: out };
    }
    case 'move': { const node = must(edit.id, 'move'); node.x = edit.x; node.y = edit.y; return { files: out }; }
    case 'rename': { const node = must(edit.id, 'rename'); node.label = edit.label; return { files: out }; }
    case 'add_child': {
      const node = must(edit.id, 'add_child'); must(edit.parent, 'add_child');
      if (edit.parent === edit.id) throw new Error('add_child: own parent');
      for (let cur = byId.get(edit.parent); cur; cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined) if (cur.id === edit.id) throw new Error('add_child: inside own subtree');
      if (node.parent !== undefined) { const old = byId.get(node.parent); if (old?.children) { old.children = old.children.filter((c) => c !== node.id); if (!old.children.length) delete old.children; } }
      attach(node, edit.parent, edit.index);
      return { files: out };
    }
    // two fields of the node record the eight do not touch: the variant it wears, and what the editor remembers about it
    case 'set_variant': { const node = must(edit.id, 'set_variant'); if (edit.variant) node.variant = edit.variant; else delete node.variant; return { files: out }; }
    // an element's look while hovered, pressed or focused: stateParameters[state][name] (the Conditional tab)
    case 'set_state_parameter': {
      const node = must(edit.id, 'set_state_parameter');
      const sp = { ...(node.stateParameters ?? {}) }, st = { ...(sp[edit.state] ?? {}) };
      if (edit.value === undefined) delete st[edit.name]; else st[edit.name] = edit.value;
      if (Object.keys(st).length) sp[edit.state] = st; else delete sp[edit.state];
      if (Object.keys(sp).length) node.stateParameters = sp; else delete node.stateParameters;
      return { files: out };
    }
    case 'set_metadata': { const node = must(edit.id, 'set_metadata'); node.metadata = { ...(node.metadata ?? {}), ...edit.metadata }; for (const k of Object.keys(edit.metadata)) if (edit.metadata[k] === undefined) delete node.metadata[k]; if (!Object.keys(node.metadata).length) delete node.metadata; return { files: out }; }
  }
  throw new Error('unknown edit');
}
export const sameWire = (a, b) => a.fromId === b.fromId && a.fromProperty === b.fromProperty && a.toId === b.toId && a.toProperty === b.toProperty;
