/**
 * STU-030 — what the runtime's trace buffer holds in Studio's in-page preview, measured on the todo template.
 *
 * The in-page preview arms the trace at boot (`@nodegx/preview` armTrace). This script records two runs and lines the
 * trace up against two witnesses outside it: the probe's log of every request the app really made (`editor/probe.js`)
 * and a MutationObserver on the app's document (when the screen really changed). What the three lanes of the run
 * timeline (page data, workflows, the screen) can read off the trace, and what they would need from elsewhere, is
 * the difference.
 *
 *   node editor/trace-inventory.mjs [out.json]    prints the inventory; writes the measurement (default: scratch, not the repo)
 *
 * Run A: the app's open, from boot to the Sign in page (Todo sends a signed-out visitor there).
 * Run B: "Create account" in the app with a new email: sign-up, then the Todo page opens and asks for its data.
 * Run C: a task typed into the list and Add pressed: the workflow, its requests, the list drawing the new row.
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { nodegxRepo } from '../lib/nodegx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = process.argv[2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const lineFrom = (proc, pattern, ms = 30000) => new Promise((ok, no) => {
  let out = ''; const t = setTimeout(() => no(new Error(`no "${pattern}" in ${ms} ms:\n${out.slice(-800)}`)), ms);
  const on = (d) => { out += d; const m = out.match(pattern); if (m) { clearTimeout(t); ok(m); } };
  proc.stdout.on('data', on); proc.stderr.on('data', on);
});

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-trace-'));
const project = join(tmp, 'todo-list');
cpSync(join(nodegxRepo, 'templates/todo-list'), project, { recursive: true });
const children = [];
let b;
try {
  const backendPort = await freePort();
  const backend = spawn(process.execPath, [join(nodegxRepo, 'packages/nodegx-backend/bin/nodegx-backend.js'), 'serve', '--data-dir', join(tmp, 'backend'), '--port', String(backendPort), '--token', 'nodegx-studio-trace', '--backend-id', 'nodegx_studio_trace', '--backend-name', 'NodeGX Studio trace', '--ephemeral'], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(backend);
  await lineFrom(backend, /NODEGX_BACKEND_READY/);
  const pjPath = join(project, 'nodegx.project.json');
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  pj.metadata ??= {};
  pj.metadata.cloudservices = { instanceId: 'studio_trace', endpoint: `http://127.0.0.1:${backendPort}`, appId: 'studio_trace', type: 'nodegx' };
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(server);
  await lineFrom(server, /nodegx-studio: http/);
  b = await browser({ port: await freePort(), width: 1600, height: 1000 });
  await b.goto(`http://127.0.0.1:${port}/`);
  await b.waitTitle((t) => t.startsWith('ready'), 90000);
  await wait(2500);

  const CTX = `__ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context`;
  const W = `__ob.preview.frame.contentWindow`;
  const state = JSON.parse(await b.evaluate(`JSON.stringify({ enabled: ${CTX}.traceEnabled, owners: ${CTX}.getTraceState ? ${CTX}.getTraceState().owners : null, clock: [${W}.performance.now(), ${CTX}.getCurrentTime(), Date.now()] })`));
  const dict = JSON.parse(await b.evaluate(`JSON.stringify(${CTX}.buildSessionDictionary())`));

  // the screen's witness: every change to the app's document, with the time and the nearest drawn element's node
  // held on the window (an observer nobody holds can be collected) and counted bare, its errors kept: a first version saw 2 changes in all
  await b.evaluate(`(() => { const w = ${W}; w.__mut = []; w.__mutErr = []; w.__mutCount = 0; w.__mo = new w.MutationObserver((list) => { w.__mutCount += list.length; try { const t = w.performance.now(); for (const m of list) w.__mut.push({ t, kind: m.type, el: m.target.nodeType === 1 ? m.target : m.target.parentElement, text: m.type === 'characterData' ? String(m.target.data).slice(0, 40) : Array.from(m.addedNodes, (n) => (n.textContent || '').trim()).join(' ').slice(0, 40) }); } catch (e) { w.__mutErr.push(String(e)); } }); w.__mo.observe(w.document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] }); return w.document.readyState; })()`);

  const pull = async (after) => {
    const t0 = Date.now();
    const evs = JSON.parse(await b.evaluate(`JSON.stringify(${CTX}.getTraceEvents(${after}))`));
    return { evs, pullMs: Date.now() - t0 };
  };
  const A = await pull(0);
  const seqB = A.evs.at(-1)?.seq ?? 0;
  const logA = JSON.parse(await b.evaluate(`JSON.stringify(${W}.__studioLog)`)).length;

  // Run B: sign up in the app (the inputs set the way a person's typing does: the native setter, then an input event)
  const sign = JSON.parse(readFileSync(join(project, 'components/Pages/Sign in/nodes.json'), 'utf8')).nodes;
  const idOf = (label) => sign.find((n) => n.label === label)?.id;
  const email = `trace${Date.now()}@example.com`;
  const typeInto = (id, text) => b.evaluate(`(() => { const w = ${W}; const el = __ob.preview.elementsOf(${JSON.stringify(id)})[0]; const input = el.matches('input') ? el : el.querySelector('input'); input.focus(); w.Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new w.Event('input', { bubbles: true })); return !!input; })()`);
  await typeInto(idOf('Email'), email); await typeInto(idOf('Password'), 'trace-password-1');
  await wait(300);
  const clickAt = await b.evaluate(`${W}.performance.now()`);
  await b.evaluate(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(idOf('Create account'))})[0]; (el.matches('button') ? el : el.querySelector('button') || el).click(); })()`);
  await b.until(`${W}.__studioLog.some(e => e.kind === 'nav' && /todo/i.test(e.path))`, 15000);
  await wait(5000); // the Todo page's queries, and the lists drawn from them
  const B = await pull(seqB);
  const dictBoot = Object.keys(dict.nodes || {}).length;
  Object.assign(dict, JSON.parse(await b.evaluate(`JSON.stringify(${CTX}.buildSessionDictionary())`))); // built at boot, it knew only the first page's nodes
  const screenNow = JSON.parse(await b.evaluate(`JSON.stringify({ text: ${W}.document.body.innerText.length, mutationsAll: ${W}.__mut.length, counted: ${W}.__mutCount, errors: ${W}.__mutErr.slice(0, 3), sameFrame: ${W} === __ob.preview.frame.contentWindow, sample: ${W}.document.body.innerText.slice(0, 120) })`));
  if (outPath) await b.screenshot(outPath.replace(/\.json$/, '.png'));
  const logB = JSON.parse(await b.evaluate(`JSON.stringify(${W}.__studioLog)`)).slice(logA);
  // a mutated element → the node that draws it: walk up to the nearest element the preview maps to a node
  const muts = JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const ids = ${JSON.stringify(Object.keys(dict.nodes || {}))}; const owner = new Map();
    for (const id of ids) for (const el of __ob.preview.elementsOf(id) || []) if (!owner.has(el)) owner.set(el, id);
    return ${W}.__mut.filter(m => m.t >= ${clickAt}).map(m => { let e = m.el, id = null; while (e && !(id = owner.get(e))) e = e.parentElement; return { t: m.t, kind: m.kind, node: id, text: m.text }; });
  })())`));

  // Run C: a task added in the app, followed from the press to the row on screen
  const seqC = B.evs.at(-1)?.seq ?? seqB, logC0 = JSON.parse(await b.evaluate(`JSON.stringify(${W}.__studioLog.length)`)), mutC0 = JSON.parse(await b.evaluate(`${W}.__mut.length`));
  const TITLE = 'Trace the timeline';
  const typed = await b.evaluate(`(() => { const w = ${W}, d = w.document; const input = [...d.querySelectorAll('input[type=text], input:not([type])')].find(i => i.offsetParent); if (!input) return false; input.focus(); w.Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(TITLE)}); input.dispatchEvent(new w.Event('input', { bubbles: true })); return input.placeholder || true; })()`);
  await wait(300);
  const pressAt = await b.evaluate(`${W}.performance.now()`);
  const pressed = await b.evaluate(`(() => { const d = ${W}.document; const btn = [...d.querySelectorAll('button')].find(e => e.textContent.trim() === 'Add' && e.offsetParent); if (!btn) return false; btn.click(); return true; })()`);
  await b.until(`${W}.document.body.innerText.includes(${JSON.stringify(TITLE)})`, 10000);
  await wait(2500);
  const C = await pull(seqC);
  const logC = JSON.parse(await b.evaluate(`JSON.stringify(${W}.__studioLog)`)).slice(logC0).filter((e) => e.kind === 'request');
  const mutC = JSON.parse(await b.evaluate(`JSON.stringify(${W}.__mut.slice(${mutC0}).map(m => ({ t: m.t, kind: m.kind, text: m.text })))`));
  Object.assign(dict, JSON.parse(await b.evaluate(`JSON.stringify(${CTX}.buildSessionDictionary())`)));
  const firstTitleEvent = C.evs.find((e) => String(e.value).includes(TITLE));
  const titleIntoText = C.evs.find((e) => String(e.value).includes(TITLE) && (dict.nodes[e.toNode]?.type === 'Text'));
  const titleOnScreen = mutC.find((m) => String(m.text).includes(TITLE));
  const runC = { typed, pressed, pressAt, events: C.evs.length, signals: C.evs.filter((e) => e.kind === 'signal').length, roots: C.evs.filter((e) => e.cause === 0).length,
    requests: logC.map((e) => ({ method: e.method, path: e.path, startMs: Math.round(e.t0 - pressAt), endMs: e.t1 ? Math.round(e.t1 - pressAt) : null, rows: e.rows })),
    titleFirstInTraceMs: firstTitleEvent ? Math.round(firstTitleEvent.t - pressAt) : null, titleFirstInto: firstTitleEvent ? `${dict.nodes[firstTitleEvent.fromNode]?.type}.${firstTitleEvent.fromPort} → ${dict.nodes[firstTitleEvent.toNode]?.type}.${firstTitleEvent.toPort}` : null,
    titleIntoATextMs: titleIntoText ? Math.round(titleIntoText.t - pressAt) : null, titleOnScreenMs: titleOnScreen ? Math.round(titleOnScreen.t - pressAt) : null, mutations: mutC.length,
    signalChain: C.evs.filter((e) => e.kind === 'signal').slice(0, 20).map((e) => `${Math.round(e.t - pressAt)} ms ${dict.nodes[e.fromNode]?.type ?? '?'}.${e.fromPort} → ${dict.nodes[e.toNode]?.type ?? '?'}.${e.toPort} (cause ${e.cause})`) };

  // ---- the inventory
  const nodes = dict.nodes || {};
  const typeOf = (id) => nodes[id]?.type ?? '?';
  const nameOf = (id) => nodes[id]?.label || nodes[id]?.name || typeOf(id);
  const summary = (evs) => {
    const byKind = {}, byToType = {}, roots = evs.filter((e) => e.cause === 0).length;
    for (const e of evs) { byKind[e.kind] = (byKind[e.kind] || 0) + 1; const k = typeOf(e.toNode); byToType[k] = (byToType[k] || 0) + 1; }
    const span = evs.length ? evs.at(-1).t - evs[0].t : 0;
    return { events: evs.length, byKind, roots, spanMs: Math.round(span), bytes: JSON.stringify(evs).length, topTargets: Object.entries(byToType).sort((a, b) => b[1] - a[1]).slice(0, 12) };
  };
  const QUERY = new Set(['DbCollection2', 'DbModel2']);
  const queries = Object.keys(nodes).filter((id) => QUERY.has(typeOf(id)));
  const queryLane = queries.map((id) => {
    const into = B.evs.filter((e) => e.toNode === id), out = B.evs.filter((e) => e.fromNode === id);
    return { id, name: nameOf(id), component: nodes[id]?.component,
      inSignals: [...new Set(into.filter((e) => e.kind === 'signal').map((e) => e.toPort))], inValues: [...new Set(into.filter((e) => e.kind === 'value').map((e) => e.toPort))],
      outPorts: [...new Set(out.map((e) => e.fromPort))], firstOutT: out[0]?.t };
  }).filter((q) => q.inSignals.length || q.inValues.length || q.outPorts.length);
  const requests = logB.filter((e) => e.kind === 'request').map((e) => ({ method: e.method, path: e.path, ms: e.t1 && e.t0 ? Math.round(e.t1 - e.t0) : null, t0: e.t0, t1: e.t1, rows: e.rows }));
  const VISUAL = /^(Group|Text|Image|Columns|net\.noodl\.(controls|visual)\.|\/)/;
  const intoVisual = B.evs.filter((e) => VISUAL.test(typeOf(e.toNode)) && e.kind === 'value');
  const drawnNodes = [...new Set(muts.map((m) => m.node).filter(Boolean))];
  const tracedVisual = new Set(intoVisual.map((e) => e.toNode));
  const report = {
    trace: state, dictionary: { atBoot: dictBoot, nodes: Object.keys(nodes).length, edges: (dict.edges || []).length }, screenAfter: screenNow, clickAt,
    runA: { ...summary(A.evs), pullMs: A.pullMs, requests: logA },
    runB: { ...summary(B.evs), pullMs: B.pullMs, clickToLastEventMs: B.evs.length ? Math.round(B.evs.at(-1).t - B.evs[0].t) : 0 },
    workflows: { signalEvents: B.evs.filter((e) => e.kind === 'signal').length, firstSignals: B.evs.filter((e) => e.kind === 'signal').slice(0, 12).map((e) => `${nameOf(e.fromNode)}.${e.fromPort} → ${nameOf(e.toNode)}.${e.toPort} (cause ${e.cause})`) },
    pageData: { requests, queriesSeenInTrace: queryLane },
    runC,
    screen: { mutations: muts.length, drawnNodes: drawnNodes.length, drawnNodesWithAValueInTrace: drawnNodes.filter((id) => tracedVisual.has(id)).length, drawnWithNoTraceEvent: drawnNodes.filter((id) => !tracedVisual.has(id)).slice(0, 12).map(nameOf), mutationsUnmapped: muts.filter((m) => !m.node).length }
  };
  console.log(JSON.stringify(report, null, 2));
  if (outPath) writeFileSync(outPath, JSON.stringify({ report, runB: { events: B.evs.slice(0, 4000), requests: logB, mutations: muts.slice(0, 4000) }, dictionary: dict }, null, 1));
} catch (err) {
  console.error('trace-inventory:', err.stack || err.message);
  process.exitCode = 1;
} finally {
  try { await b?.close(); } catch { /* gone */ }
  for (const c of children) try { c.kill(); } catch { /* gone */ }
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* left for the OS */ }
}
