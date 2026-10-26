/**
 * NodeGX P112-OWN020-PILLWRAP / FILLGROW (ruled 2026-10-26: warn and teach, "but make sure it works because adding
 * texts with default sizing and seeing them have weird layout used to drive me nuts").
 *
 * NodeGX's validator says two layout things a person meets while building, and Studio showed neither: its problem box
 * listed errors only, when the app could not be shown. These are warnings on an app that IS shown. This turns them into
 * what the box lists under the app: the first sentence of each, where it is, and the edits that do what it says.
 *
 *   content-row-splits-its-children  a row that sizes to its content, with children of no width: each child that has
 *                                    neither a content size nor a width of its own gets sizeMode "contentSize"
 *   row-of-words-fills-its-column    a row of words with no height, filling its column: the row gets "contentHeight"
 *
 * Pure: `nodesOf(component)` hands back a component's stored nodes, so it runs in a plain-Node check.
 */
export const LAYOUT_CODES = new Set(['content-row-splits-its-children', 'row-of-words-fills-its-column']);

const CONTENT_WIDTH = new Set(['contentSize', 'contentWidth']);

/** The first sentence of a NodeGX message, which says what is wrong; the rest says why and how. */
const firstSentence = (message) => {
  const at = message.search(/[.:](\s|$)/);
  return at === -1 ? message : message.slice(0, at + 1).replace(/:$/, '.');
};

/** The tips for one validation report, in its order; empty when it has none of these. */
export function layoutTips(diagnostics, nodesOf) {
  const tips = [];
  for (const d of diagnostics ?? []) {
    if (!LAYOUT_CODES.has(d.code) || !d.nodeId || !d.component) continue;
    const nodes = nodesOf(d.component) ?? [];
    const node = nodes.find((n) => n.id === d.nodeId);
    if (!node) continue;
    let edits;
    if (d.code === 'row-of-words-fills-its-column') {
      edits = [{ edit: 'set_parameter', id: node.id, name: 'sizeMode', value: 'contentHeight' }];
    } else {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      edits = (node.children ?? [])
        .map((id) => byId.get(id))
        .filter((child) => child && !CONTENT_WIDTH.has(child.parameters?.sizeMode) && child.parameters?.width === undefined)
        .map((child) => ({ edit: 'set_parameter', id: child.id, name: 'sizeMode', value: 'contentSize' }));
    }
    if (!edits.length) continue;
    tips.push({
      code: d.code,
      text: firstSentence(d.message),
      component: d.component,
      nodeId: d.nodeId,
      where: [d.component, d.nodeLabel || d.nodeId].filter(Boolean).join(' · '),
      fix: d.code === 'row-of-words-fills-its-column' ? 'Make it as tall as its words' : 'Make the words hug their size',
      edits
    });
  }
  return tips;
}
