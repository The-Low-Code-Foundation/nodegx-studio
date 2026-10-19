/**
 * NodeGX Studio — "make it reusable"'s gate (`reusable.mjs`, STU-050). On a copy of the todo-list template's Sign in page,
 * the Sign-in card is made a reusable: every node of the page is accounted for (moved or kept, the copy in the card's
 * place, under the card's parent at the card's index), every wire is accounted for (inside the reusable, kept on the
 * page, or a crossing one carried by exactly one page wire to the copy and one reusable wire from its port), page data
 * stays on the page, and NodeGX's own validator (validate_project through the MCP server, skipped by name when
 * packages/noodl-mcp/dist is not built) finds no new error. Whether the app then works through the copy is
 * `check:editor`'s: it signs in wrongly through the copy and reads the error the page's logic shows.
 *
 *   node editor/reusable-check.mjs      PASS n/n and exit 0, or the failing lines and exit 1
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractReusable } from './reusable.mjs';
import { nodegxRepo } from '../lib/nodegx.mjs';

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${!cond && detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };
const skip = (what, why) => console.log(`  skip ${what} — ${why}`);

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-reusable-'));
const project = join(tmp, 'todo-list');
cpSync(join(nodegxRepo, 'templates/todo-list'), project, { recursive: true });
const pageDir = join(project, 'components/Pages/Sign in');
const read = (dir) => ({ nodes: JSON.parse(readFileSync(join(dir, 'nodes.json'), 'utf8')), connections: JSON.parse(readFileSync(join(dir, 'connections.json'), 'utf8')) });
const wkey = (w) => [w.fromId, w.fromProperty, w.toId, w.toProperty].join(' ');

const mcpBuilt = existsSync(join(nodegxRepo, 'packages/noodl-mcp/dist/noodl-mcp.cjs'));
async function validate() {
  const proc = spawn(process.execPath, [join(nodegxRepo, 'packages/noodl-mcp/bin/noodl-mcp.js'), project], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = ''; const waiting = new Map(); let seq = 0;
  proc.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } } catch { /* a log line */ } } });
  const call = (method, params) => new Promise((done) => { const id = ++seq; waiting.set(id, done); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'studio-reusable-check', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  const r = await call('tools/call', { name: 'validate_project', arguments: {} });
  proc.kill();
  const text = (r.result?.content || []).map((c) => c.text || '').join('\n');
  return JSON.parse(text.replace(/^[^{]*/, '')).diagnostics || [];
}
const dkey = (d) => `${d.severity} ${d.code} ${d.location?.component} ${d.location?.nodeId} ${d.location?.port}`;

try {
  const before = mcpBuilt ? await validate() : null;
  const files = read(pageDir);
  const nodes = files.nodes.nodes, wires = files.connections.connections;
  const card = nodes.find((n) => n.label === 'Sign-in card');
  const parent = nodes.find((n) => n.id === card.parent), index = parent.children.indexOf(card.id);
  // the signal ports the card's edge carries, as Studio reads them off the node library (a click, a text change, enter)
  const SIGNALS = new Set(['onClick', 'onTextChanged', 'onEnter']);
  const r = extractReusable(files, card.id, { key: 'Reusable/Sign-in card', copyId: 'siCardCopy', portType: (id, plug, port) => (SIGNALS.has(port) ? 'signal' : undefined) });

  console.log('check: the nodes');
  const cIds = new Set(r.component.nodes.nodes.map((n) => n.id)), pIds = new Set(r.page.nodes.nodes.map((n) => n.id));
  const iface = r.component.nodes.nodes.filter((n) => n.type === 'Component Inputs' || n.type === 'Component Outputs');
  ok(nodes.every((n) => cIds.has(n.id) !== pIds.has(n.id) || n.id === card.id) && !pIds.has(card.id) && cIds.has(card.id),
    'every node of the page is either moved or kept, never both, never lost', nodes.filter((n) => cIds.has(n.id) === pIds.has(n.id)).map((n) => n.label));
  ok(r.page.nodes.nodes.length + r.component.nodes.nodes.length === nodes.length + 1 + iface.length, 'and the only new ones are the copy and the reusable\'s inputs and outputs', { page: r.page.nodes.nodes.length, component: r.component.nodes.nodes.length, was: nodes.length, iface: iface.length });
  const copyNode = r.page.nodes.nodes.find((n) => n.id === 'siCardCopy'), pParent = r.page.nodes.nodes.find((n) => n.id === parent.id);
  ok(copyNode?.type === '/Reusable/Sign-in card' && copyNode.parent === parent.id && pParent.children[index] === 'siCardCopy', 'the copy is where the card was: same parent, same place among its siblings', { copy: copyNode, children: pParent.children });
  const top = r.component.nodes.nodes.find((n) => n.id === card.id);
  ok(top.parent === undefined && r.component.nodes.visualRoots.join() === card.id && JSON.stringify(top.parameters) === JSON.stringify(card.parameters), 'the card is the reusable\'s top element and keeps every setting it had', top.parameters);
  const logicKept = nodes.filter((n) => ['net.noodl.user.LogIn', 'net.noodl.user.SignUp', 'RouterNavigate'].includes(n.type)).every((n) => pIds.has(n.id));
  ok(logicKept, 'the page\'s sign-in, sign-up and navigation stay on the page (they are wired to the page too)');

  console.log('check: the wires');
  const cW = new Set(r.component.connections.connections.map(wkey)), pW = new Set(r.page.connections.connections.map(wkey));
  const ports = Object.fromEntries(iface.flatMap((n) => n.ports.map((p) => [p.name, { node: n.id, type: p.type }])));
  const lost = [];
  for (const w of wires) {
    const a = cIds.has(w.fromId), b2 = cIds.has(w.toId);
    if (a && b2) { if (!cW.has(wkey(w))) lost.push(['inside', w]); continue; }
    if (!a && !b2) { if (!pW.has(wkey(w))) lost.push(['page', w]); continue; }
    if (!a && b2) {
      // in: the page wire into the copy, and the reusable's input wired on to the same inside port
      const viaPage = r.page.connections.connections.filter((x) => x.fromId === w.fromId && x.fromProperty === w.fromProperty && x.toId === 'siCardCopy');
      const ok2 = viaPage.some((x) => cW.has(wkey({ fromId: ports[x.toProperty]?.node, fromProperty: x.toProperty, toId: w.toId, toProperty: w.toProperty })));
      if (!ok2) lost.push(['in', w]);
    } else {
      const viaComp = r.component.connections.connections.filter((x) => x.fromId === w.fromId && x.fromProperty === w.fromProperty && ports[x.toProperty]?.node === x.toId);
      const ok2 = viaComp.some((x) => pW.has(wkey({ fromId: 'siCardCopy', fromProperty: x.toProperty, toId: w.toId, toProperty: w.toProperty })));
      if (!ok2) lost.push(['out', w]);
    }
  }
  ok(lost.length === 0 && wires.length > 0, `every one of the page's ${wires.length} wires is carried: inside the reusable, on the page, or across through the copy`, lost.slice(0, 4));
  ok(r.inputs.join() === 'Why it did not work text,Why it did not work mounted', 'two outside values into one inside text are one input (two page wires into it), named after the element inside', r.inputs);
  ok(r.outputs.includes('Sign in onClick') && ports['Sign in onClick'].type === 'signal' && !r.outputs.includes('onClick'), 'outputs are named after the element inside, a click typed as a signal', r.outputs);

  console.log('check: page data stays on the page');
  {
    // a page data item read only by an element inside the card would move with it if nothing kept it: `stays` keeps it
    const q = { id: 'pdQ', type: 'DbCollection2', label: 'notes', metadata: { pageData: { name: 'notes', first: false } }, parameters: { collectionName: 'Note' } };
    const withItem = { nodes: { ...files.nodes, nodes: [...nodes, q] }, connections: { ...files.connections, connections: [...wires, { fromId: 'pdQ', fromProperty: 'count', toId: nodes.find((n) => n.label === 'App name').id, toProperty: 'text' }] } };
    const kept = extractReusable(withItem, card.id, { key: 'Reusable/x', stays: (n) => !!n.metadata?.pageData });
    const moved = extractReusable(withItem, card.id, { key: 'Reusable/x' });
    ok(kept.page.nodes.nodes.some((n) => n.id === 'pdQ') && kept.inputs.includes('App name text'), 'kept, the item stays on the page and reaches the card through an input', kept.inputs);
    ok(moved.component.nodes.nodes.some((n) => n.id === 'pdQ'), 'and the control: without `stays` it would have moved (so the test can fail)');
  }

  if (mcpBuilt) {
    console.log('check: NodeGX\'s validator');
    const dir = join(project, 'components/Reusable/Sign-in card');
    mkdirSync(dir, { recursive: true });
    const cid = '22222222-3333-5444-8555-666666666666', at = '2026-10-19T00:00:00.000Z';
    writeFileSync(join(dir, 'component.json'), JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/component-v2.json', id: cid, name: 'Sign-in card', path: '/Reusable/Sign-in card', type: 'visual', created: at, modified: at, modifiedBy: 'check' }, null, 2));
    writeFileSync(join(dir, 'nodes.json'), JSON.stringify({ ...r.component.nodes, componentId: cid }, null, 2));
    writeFileSync(join(dir, 'connections.json'), JSON.stringify({ ...r.component.connections, componentId: cid }, null, 2));
    writeFileSync(join(pageDir, 'nodes.json'), JSON.stringify(r.page.nodes, null, 2));
    writeFileSync(join(pageDir, 'connections.json'), JSON.stringify(r.page.connections, null, 2));
    const regPath = join(project, 'components/_registry.json'), reg = JSON.parse(readFileSync(regPath, 'utf8'));
    reg.components['Reusable/Sign-in card'] = { path: 'Reusable/Sign-in card', type: 'visual', nodeCount: r.component.nodes.nodes.length, connectionCount: r.component.connections.connections.length, modified: at, created: at };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    const after = await validate();
    const was = new Set(before.map(dkey));
    const fresh = after.filter((d) => d.severity === 'error' && !was.has(dkey(d)));
    ok(fresh.length === 0, 'validate_project finds no new error in the project', fresh.map((d) => `${d.code} ${d.location?.component}: ${d.message}`));
    const warns = after.filter((d) => d.severity === 'warning' && !was.has(dkey(d)));
    console.log(`  note ${warns.length} new warning(s)${warns.length ? ': ' + warns.slice(0, 4).map((d) => `${d.code} — ${d.message.slice(0, 120)}`).join(' | ') : ''}`);
    // the control: the validator does read the new reusable (a wire to a node that is not there is an error in it)
    writeFileSync(join(dir, 'connections.json'), JSON.stringify({ ...r.component.connections, componentId: cid, connections: [...r.component.connections.connections, { fromId: card.id, fromProperty: 'onClick', toId: 'no-such-node', toProperty: 'x' }] }, null, 2));
    const broken = (await validate()).filter((d) => d.severity === 'error' && !was.has(dkey(d)));
    ok(broken.some((d) => /Sign-in card/.test(d.location?.component || '')), 'and the control: a wire to a missing node inside the reusable is an error it reports there', broken.map((d) => `${d.code} ${d.location?.component}`));
  } else skip('validate_project', 'packages/noodl-mcp/dist is not built');
} catch (err) {
  ok(false, 'the gate ran to the end', err.stack);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
