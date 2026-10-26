/**
 * NodeGX Studio — P127 BKO-004: a cloud function opens as its graph, in headless Chrome.
 *
 * A copy of the training app (from a NodeGX checkout: NODEGX_REPO, or the sibling ../OpenNoodl; it is not vendored),
 * with no backend bound, served by Studio. Then:
 *
 *   1. every function under Workflow's "On the backend" opens as a drawn graph: one card per node, one wire per wire
 *      in its files, the Request first, the answers last, no card empty or on top of another; every data type a record
 *      node in it names is said in its touches
 *   2. "Open its steps" on a helper it places opens the helper; Back (and Esc) come back
 *   3. from the workflow of a button that runs a function (Unsubscribe's "Stop these emails" → unsubscribe), one click on the
 *      step reaches the function's graph, and Back returns to that workflow
 *   4. a function an agent makes while Studio is open (the kit's own MCP server, `create_component` on a `#__cloud__/`
 *      path) is listed and drawn, its signal and value wires told apart
 *
 * Every count is read from the project's files, never from ./fngraph.mjs.
 *
 *   node editor/functions-check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node editor/functions-check.mjs --shots    also writes the phase's look/bko-004-*.png
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { scriptTableNames } from './fngraph.mjs';
import { AGENT_FN, makeFunctionAsAgent } from './agentmade-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.argv.includes('--shots');
const repo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : resolve(here, '..', '..', 'OpenNoodl');
const training = join(repo, 'templates', 'digital-bricks-training');
const lookDir = join(repo, 'dev-docs', 'tasks', 'phase-127-the-backend-in-the-open', 'look');
if (!existsSync(training)) { console.log(`functions-check: no training app at ${training} (set NODEGX_REPO)`); process.exit(1); }
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-functions-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // the server inherits it: nothing is written to ~/.noodl
const { kit } = await import('../lib/nodegx.mjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const lineFrom = (proc, pattern, ms = 30000) => new Promise((ok, no) => {
  let out = ''; const t = setTimeout(() => no(new Error(`no "${pattern}" in ${ms} ms:\n${out.slice(-800)}`)), ms);
  const on = (d) => { out += d; const m = out.match(pattern); if (m) { clearTimeout(t); ok(m); } };
  proc.stdout.on('data', on); proc.stderr.on('data', on);
});
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); if (!cond || !what.startsWith('·')) console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined && !cond ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };

const project = join(tmp, 'training');
cpSync(training, project, { recursive: true });
{
  // no backend: the template's binding names a port on this computer that may be anyone's
  const pjPath = join(project, 'nodegx.project.json'), pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  delete pj.metadata.cloudservices;
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
}
/** A function's files, read here: what the page must draw. */
function filesOf(key) {
  const d = join(project, 'components', key);
  const nodes = JSON.parse(readFileSync(join(d, 'nodes.json'), 'utf8')).nodes.filter((n) => n.type !== 'Comment');
  const ids = new Set(nodes.map((n) => n.id));
  const conns = (JSON.parse(readFileSync(join(d, 'connections.json'), 'utf8')).connections ?? []).filter((c) => ids.has(c.fromId) && ids.has(c.toId) && c.fromId !== c.toId);
  return { nodes, conns };
}
const cloudKeys = [];
(function walk(d, rel) { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const r = `${rel}/${e.name}`; if (existsSync(join(d, e.name, 'nodes.json'))) cloudKeys.push(r); walk(join(d, e.name), r); } })(join(project, 'components', '__cloud__'), '__cloud__');

const children = [];
let b;
try {
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(server);
  await lineFrom(server, /nodegx-studio: http/);
  b = await browser({ port: await freePort(), width: 1600, height: 1000 });
  await b.goto(`http://127.0.0.1:${port}/`);
  console.log(`check: ${await b.waitTitle((t) => t.startsWith('ready'), 90000)}`);
  await wait(800);
  const shot = async (name) => { if (shots) { await wait(400); await b.screenshot(join(lookDir, `bko-004-${name}.png`)); } };
  const clickSel = async (sel) => { const r = await b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`); if (!r) throw new Error(`nothing at ${sel}`); await b.click(r.x, r.y); await wait(250); };
  const shown = () => b.evaluate(`(() => { const v = document.querySelector('#steps .fnview'); if (!v) return null;
    const cards = [...v.querySelectorAll('.fnflow .step')], rects = cards.map((c) => c.getBoundingClientRect());
    const overlap = rects.some((a, i) => rects.some((q, j) => j > i && a.left < q.right - 1 && q.left < a.right - 1 && a.top < q.bottom - 1 && q.top < a.bottom - 1));
    const cols = [...v.querySelectorAll('.fncol')].map((c) => [...c.querySelectorAll('.step')].map((s) => s.dataset.id));
    return { key: v.dataset.fn, cards: cards.length, ids: cards.map((c) => c.dataset.id), wires: [...v.querySelectorAll('svg.wires path[data-kind]')].map((p) => p.dataset.kind),
      empty: rects.filter((r) => r.width < 60 || r.height < 30).length, overlap, cols, back: v.querySelector('.cardnav .back')?.textContent ?? null,
      touches: v.querySelector('.fnfacts .touches')?.textContent ?? '', chips: [...v.querySelectorAll('.fnfacts .touch')].map((t) => t.textContent), run: v.querySelector('.fnfacts .run')?.textContent ?? '' }; })()`);

  console.log('check: Workflow → On the backend');
  await clickSel('#rail [data-tab=workflow]');
  const listed = await b.evaluate(`[...document.querySelectorAll('#fnlist .row')].map((r) => r.dataset.fn)`);
  ok(listed.length === cloudKeys.length && cloudKeys.every((k) => listed.includes(k)), `"On the backend" lists every cloud function in the files (${cloudKeys.length})`, { listed: listed.length, files: cloudKeys.length });
  const endpoints = cloudKeys.filter((k) => filesOf(k).nodes.some((n) => n.type === 'noodl.cloud.request'));
  ok(endpoints.length === 27, 'the training app has 27 functions called from the app', endpoints.length);
  let drawnOk = 0;
  for (const key of listed) {
    await b.evaluate(`document.querySelector('#fnlist .row[data-fn="${key}"]').click()`);
    await b.until(`document.querySelector('#steps .fnview')?.dataset.fn === ${JSON.stringify(key)} && !document.querySelector('#steps .fnfacts .touches')?.textContent.startsWith('Reading')`, 8000);
    const s = await shown(), f = filesOf(key);
    const start = f.nodes.find((n) => n.type === 'noodl.cloud.request' || n.type === 'Component Inputs');
    const answers = f.nodes.filter((n) => n.type === 'noodl.cloud.response' || n.type === 'Component Outputs').map((n) => n.id);
    // the data types it names itself: a record node's, and a records call's in its own scripts (a helper's are its own)
    const named = [...new Set([...f.nodes.map((n) => n.parameters?.collectionName), ...f.nodes.flatMap((n) => scriptTableNames(n.parameters?.functionScript ?? ''))].filter(Boolean))];
    const good = s.cards === f.nodes.length && s.cards >= 2 && s.cols.length >= 2 && s.wires.length === f.conns.length && !s.empty && !s.overlap
      && (!start || s.cols[0][0] === start.id) && answers.every((id) => s.cols.at(-1).includes(id)) && named.every((t) => s.chips.some((c) => c.split(/[ ,]+/).includes(t)));
    if (good) drawnOk++;
    ok(good, `· ${key}: ${s.cards} cards in ${s.cols.length} columns, ${s.wires.length} wires`, { s, nodes: f.nodes.length, conns: f.conns.length, named });
  }
  ok(drawnOk === listed.length, `every function draws: one card per node, one wire per wire, the start first and the answers last, none empty or overlapping, its record nodes' data types in its touches (${drawnOk}/${listed.length})`);

  // 2. a helper it places, and back
  await b.evaluate(`document.querySelector('#fnlist .row[data-fn="__cloud__/course"]').click()`);
  await b.until(`document.querySelector('#steps .fnview')?.dataset.fn === '__cloud__/course' && !/^Reading/.test(document.querySelector('#steps .fnfacts .touches')?.textContent) && !/^Reading/.test(document.querySelector('#steps .fnfacts .run')?.textContent)`, 8000);
  {
    const s = await shown();
    // its script's Done into the Response's Send is a signal; the learner id, the query and the rows are values
    ok(s.wires.filter((k) => k === 'signal').length === 1 && s.wires.filter((k) => k === 'value').length === 5 && s.wires.filter((k) => k === 'fail').length === 3 && s.chips.some((c) => /^reads .*\bConcept\b/.test(c) && /\bLearnerProfile\b/.test(c)),
      'course is drawn with its one signal, its five values and its three failures told apart, and says it reads Concept (through Programme) and LearnerProfile (through Caller learner)', { wires: s.wires, chips: s.chips });
    ok(/no backend|not run/i.test(s.run), 'with no backend, its last run is said as missing, not made up', s.run);
  }
  await shot('course');
  await clickSel('#steps .fnflow .step[data-type="/#__cloud__/shared/Caller learner"] .fnopen');
  {
    const s = await shown();
    ok(s?.key === '__cloud__/shared/Caller learner' && s.back?.includes('course') && s.cards >= 2, '"Open its steps" on the helper course places opens the helper, with Back to course', s && { key: s.key, back: s.back, cards: s.cards });
    await shot('helper');
  }
  await b.key('Escape');
  await wait(250);
  ok((await shown())?.key === '__cloud__/course', 'Esc goes back to course');

  // 3. from a button's workflow: Unsubscribe's "Stop these emails" runs unsubscribe (a public page: Settings sends a
  // visitor to Sign in, and Studio follows the app there)
  console.log('check: from a workflow');
  await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Unsubscribe'; s.dispatchEvent(new Event('change')); })()`);
  await wait(600);
  const settings = JSON.parse(readFileSync(join(project, 'components/Pages/Unsubscribe/nodes.json'), 'utf8')).nodes;
  const button = settings.find((n) => n.type === 'net.noodl.controls.button' && n.label.startsWith('Stop these emails'));
  await b.evaluate(`[...document.querySelectorAll('#events .row')].find((r) => r.dataset.node === ${JSON.stringify(button.id)} && r.dataset.port === 'onClick').click()`);
  await b.until(`!!document.querySelector('#steps .event-card') && !document.querySelector('#steps .fnview')`, 5000);
  ok(await b.evaluate(`!!document.querySelector('#steps .fnopen')`), 'the "Stop these emails" workflow\'s step says it runs unsubscribe on the backend, as a link',
    await b.evaluate(`({ page: document.getElementById('pagepick').value, rows: [...document.querySelectorAll('#events .row')].map((r) => r.dataset.node + '.' + r.dataset.port).slice(0, 12), steps: document.getElementById('steps').innerText.slice(0, 400) })`));
  await shot('step-link');
  await clickSel('#steps .step .fnopen');
  {
    const s = await shown();
    ok(s?.key === '__cloud__/unsubscribe' && s.cards >= 2 && s.back !== null, 'one click on the step opens unsubscribe as its graph, with Back', s && { key: s.key, back: s.back });
  }
  await clickSel('#steps .fnview .cardnav .back');
  ok(await b.evaluate(`!document.querySelector('#steps .fnview') && document.querySelector('#events .row[aria-selected=true]')?.dataset.node === ${JSON.stringify(button.id)} && !!document.querySelector('#steps .fnopen')`), 'Back returns to the "Stop these emails" workflow');

  // 4. an agent makes a function while Studio is open
  console.log('check: a function the agent makes');
  let madeText = '', madeOk = true;
  try { madeText = await makeFunctionAsAgent(project, kit.mcpServer, repo); } catch (e) { madeOk = false; madeText = e.message; }
  ok(madeOk, 'the kit\'s MCP server makes "List Role Members", a cloud function, in the open project', madeText.slice(0, 300));
  const newKey = AGENT_FN;
  await b.until(`!!document.querySelector('#fnlist .row[data-fn="${newKey}"]')`, 20000).catch(() => {});
  ok(await b.evaluate(`!!document.querySelector('#fnlist .row[data-fn="${newKey}"]')`), 'it arrives under "On the backend" while Studio is open');
  await b.evaluate(`document.querySelector('#fnlist .row[data-fn="${newKey}"]')?.click()`);
  await wait(400);
  {
    const s = await shown(), f = existsSync(join(project, 'components', newKey)) ? filesOf(newKey) : { nodes: [], conns: [] };
    ok(s?.key === newKey && s.cards === f.nodes.length && s.wires.length === f.conns.length && s.wires.includes('signal') && s.wires.includes('value') && !s.overlap,
      `it opens as a drawn graph: ${s?.cards} cards, ${s?.wires.length} wires, its signals and its values told apart`, s && { cards: s.cards, nodes: f.nodes.length, wires: s.wires, conns: f.conns.length });
    await shot('agent-made');
  }
} catch (e) {
  ok(false, `the check ran to its end: ${e.message}`);
} finally {
  await b?.close?.();
  for (const c of children) c.kill();
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
