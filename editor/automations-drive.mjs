/**
 * NodeGX Studio — P127 BKO-005: a backend's workflows and triggers, drawn and changed, in headless Chrome.
 *
 * A copy of NodeGX's todo-list template, its backend started by Studio's own "Start a backend". An agent (NodeGX's MCP
 * server, `NODEGX_MCP` or the kit's) makes BKO-001's three through its tools: a daily schedule, a two-step workflow and
 * a row-change trigger that starts it; they land in `nodegx.automations.json` and on the backend. A Task row is made,
 * the trigger fires, and the workflow fails at its second step (it runs a function the app does not have). Then:
 *
 *   1. Workflow → On the backend lists all three in a person's words, from the project's file, the backend agreeing
 *   2. the daily trigger opens as a flow: what starts it, wired to the function it runs
 *   3. the workflow opens as its steps, left to right, its error route a fail wire; its last run is drawn failing at
 *      step 2, step 1 ran, the wire into step 2 lit
 *   4. turned off in Studio: the file and the backend both say off, the agent's what_changed_since lists it, its
 *      list_backend_triggers agrees
 *   5. moved to 10:00 in Studio: the same three checks, and the trigger is said "Every day at 10:00"
 *
 * Every assertion reads the project's file, the backend's admin API or the agent's answers, never the page's claim alone.
 *
 *   node editor/automations-drive.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node editor/automations-drive.mjs --shots    also writes the phase's look/bko-005-*.png
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.argv.includes('--shots');
const repo = process.env.NODEGX_REPO ? resolve(process.env.NODEGX_REPO) : resolve(here, '..', '..', 'OpenNoodl');
const lookDir = join(repo, 'dev-docs', 'tasks', 'phase-127-the-backend-in-the-open', 'look');
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-automations-drive-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // the server and the agent inherit it: nothing is written to ~/.noodl
const { kit } = await import('../lib/nodegx.mjs');
const { templates } = kit;
const mcpServer = process.env.NODEGX_MCP ? resolve(process.env.NODEGX_MCP) : kit.mcpServer;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined && !cond ? ' — ' + JSON.stringify(detail).slice(0, 500) : ''}`); };

const project = join(tmp, 'todo');
cpSync(join(templates, 'todo-list'), project, { recursive: true });
{
  const pjPath = join(project, 'nodegx.project.json'), pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  delete pj.metadata?.cloudservices;
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
}
const fileNow = () => JSON.parse(readFileSync(join(project, 'nodegx.automations.json'), 'utf8'));
const pj = () => JSON.parse(readFileSync(join(project, 'nodegx.project.json'), 'utf8'));

/** The agent: NodeGX's MCP server on the project, as an agent's client starts it. */
function agentOn(dir) {
  const mcp = spawn(process.execPath, [mcpServer, dir, '--allow-writes'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NODEGX_NO_UPDATE_CHECK: '1' } });
  let buf = '', id = 0;
  const waiting = new Map();
  mcp.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); waiting.get(m.id)?.(m); } catch { /* not a message */ } } });
  const rpc = (method, params) => new Promise((done, no) => { const n = ++id; const t = setTimeout(() => no(new Error(`${method}: no answer in 30 s`)), 30000); waiting.set(n, (m) => { clearTimeout(t); done(m); }); mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const call = async (name, args = {}) => {
    const m = await rpc('tools/call', { name, arguments: args });
    const text = m.result?.content?.[0]?.text ?? JSON.stringify(m.error ?? m.result);
    let data = null; try { data = JSON.parse(text); } catch { /* words */ }
    return { error: !!(m.error || m.result?.isError), text, data };
  };
  return {
    proc: mcp,
    async start() {
      await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nodegx-studio-check', version: '0' } });
      mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      await call('find_tools', { group: 'backend' });
      await call('find_tools', { group: 'project' }); // what_changed_since, beside session_status
    },
    call
  };
}

const children = [];
let b;
try {
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(server);
  let log = '';
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('nodegx-studio: http'); i++) await wait(100);
  const url = `http://127.0.0.1:${port}/`;
  const studio = async (path, init) => { const r = await fetch(url + path.slice(1), init); return r.json(); };
  const made = await studio('/api/backend-provision', { method: 'POST' });
  ok(made.phase === 'running' && pj().metadata.cloudservices?.endpoint === made.endpoint, "the todo app's backend, made by Studio's Start a backend", made);
  const be = (path, init = {}) => studio(`/api/backend${path}`, { headers: { 'content-type': 'application/json' }, ...init });

  // the agent makes BKO-001's three
  console.log('check: the agent makes a daily trigger, a two-step workflow and a row-change trigger');
  const agent = agentOn(project);
  children.push(agent.proc);
  await agent.start();
  const daily = await agent.call('create_backend_trigger', { type: 'schedule', name: 'Morning digest', target: { kind: 'function', name: 'sendDigest' }, schedule: { cron: '0 9 * * *', missedFirePolicy: 'skip' } });
  const wfMade = await agent.call('create_backend_workflow', { id: 'triage', name: 'Triage a new task', entry: 'pause', steps: [
    { id: 'pause', name: 'Let it settle', kind: 'wait', params: { duration: 10, unit: 'milliseconds' }, next: ['notify'] },
    { id: 'notify', name: 'Tell the owner', kind: 'call-function', ref: 'notifyOwner', onError: ['giveup'] },
    { id: 'giveup', name: 'Give up', kind: 'stop', params: { isError: true, message: 'The owner could not be told' } }] });
  const rows = await agent.call('create_backend_trigger', { type: 'db-change', name: 'New task', target: { kind: 'workflow', name: 'triage' }, dbChange: { collection: 'Task', actions: ['create'] } });
  ok(!daily.error && !wfMade.error && !rows.error, 'the agent\'s three writes are taken', [daily.text, wfMade.text, rows.text].map((t) => t.slice(0, 200)));
  const dailyId = daily.data?.trigger?.id, rowsId = rows.data?.trigger?.id;
  if (daily.data && !daily.data.project) console.log(`  (the agent's server, ${mcpServer}, does not keep a trigger in the project: it predates P127 BKO-001. Set NODEGX_MCP to a noodl-mcp built from NodeGX with BKO-001 and BKO-005)`);
  {
    const f = existsSync(join(project, 'nodegx.automations.json')) ? fileNow() : { triggers: [], workflows: [] };
    ok(f.triggers.length === 2 && f.workflows.length === 1 && f.workflows[0].steps.length === 3, 'all three are in nodegx.automations.json (BKO-001)', f);
  }

  // a Task row: the row-change trigger fires, the workflow runs and fails at its second step
  const row = await be('/classes/Task', { method: 'POST', body: JSON.stringify({ title: 'Water the plants' }) });
  ok(!!row.objectId, 'a Task row is made', row);
  let lastRun = null;
  for (let i = 0; i < 50 && !(lastRun && lastRun.status !== 'running'); i++) { await wait(200); const defs = await be('/admin/workflow-defs'); lastRun = defs.lastRuns?.triage ?? null; }
  const record = lastRun ? await be(`/executions/${encodeURIComponent(lastRun.id)}`) : null;
  const ran = (id) => record?.steps?.find((s) => s.nodeId === id);
  ok(record && record.status === 'error' && ran('pause')?.status === 'success' && ran('notify')?.status === 'error', 'the trigger fired: the workflow ran, its first step ran and its second failed', record && { status: record.status, steps: record.steps?.map((s) => `${s.nodeId}:${s.status}`) });

  b = await browser({ port: await freePort(), width: 1600, height: 1000 });
  await b.goto(url);
  console.log(`check: ${await b.waitTitle((t) => t.startsWith('ready'), 90000)}`);
  await wait(800);
  const ev = (expr) => b.evaluate(expr);
  const shot = async (name) => { if (shots) { await wait(500); await b.screenshot(join(lookDir, `bko-005-${name}.png`)); } };
  const view = () => ev(`(() => { const v = document.querySelector('#steps .autoview'); if (!v) return null;
    const cards = [...v.querySelectorAll('.fnflow .step')], rects = cards.map((c) => c.getBoundingClientRect());
    const overlap = rects.some((a, i) => rects.some((q, j) => j > i && a.left < q.right - 1 && q.left < a.right - 1 && a.top < q.bottom - 1 && q.top < a.bottom - 1));
    return { trigger: v.dataset.trigger ?? null, workflow: v.dataset.workflow ?? null, title: v.querySelector('.event-card h2')?.textContent ?? '',
      cols: [...v.querySelectorAll('.fncol')].map((c) => [...c.querySelectorAll('.step')].map((s) => s.dataset.id)),
      cards: cards.map((c) => ({ id: c.dataset.id, cls: c.className, text: c.innerText })), overlap, empty: rects.filter((r) => r.width < 60 || r.height < 30).length,
      wires: [...v.querySelectorAll('svg.wires path[data-kind]')].map((p) => ({ kind: p.dataset.kind, from: p.dataset.from, to: p.dataset.to, ran: p.dataset.ran === '1', faint: p.getAttribute('opacity') === '0.3' })),
      facts: v.querySelector('.fnfacts')?.innerText ?? '' }; })()`);

  // 1. the list
  console.log('check: Workflow → On the backend');
  await b.clickSel('#rail [data-tab=workflow]');
  await b.until(`document.querySelectorAll('#autolist .row').length === 3 && !document.querySelector('#autolist')?.innerText.includes('0 9 * * *')`, 10000);
  const listed = await ev(`[...document.querySelectorAll('#autolist .row')].map((r) => ({ trigger: r.dataset.trigger, workflow: r.dataset.workflow, text: r.innerText.replace(/\\s+/g, ' ').trim() }))`);
  const said = (id) => listed.find((r) => r.trigger === id)?.text ?? '';
  ok(/^Every day at 09:00 ?On ?Starts the function sendDigest$/.test(said(dailyId)), 'the daily trigger: "Every day at 09:00", on, starting sendDigest (the backend\'s words for its cron)', said(dailyId));
  ok(/^When a Task is created ?On ?Starts the workflow Triage a new task$/.test(said(rowsId)), 'the row-change trigger: "When a Task is created", starting the workflow by its name', said(rowsId));
  ok(listed.some((r) => r.workflow === 'triage' && /^Triage a new task A workflow on the backend · 3 steps$/.test(r.text)), 'the workflow, by its name, with its three steps', listed);
  ok(!listed.some((r) => /differs/.test(r.text)), 'the backend agrees with the project on every one');
  await shot('list');

  // 2. the daily trigger as a flow
  await ev(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(dailyId)}`, 5000);
  {
    const v = await view();
    ok(v?.title === 'Every day at 09:00' && JSON.stringify(v.cols) === '[["trigger"],["target"]]' && v.wires.length === 1 && v.wires[0].kind === 'then' && !v.overlap && !v.empty,
      'the daily trigger opens as a flow: what starts it, wired to what it runs', v);
    ok(/sendDigest/.test(v?.cards[1]?.text) && /The backend runs the same/.test(v?.facts) && /Runs at/.test(v?.facts), 'it names the function, says the backend agrees, and offers its time', v && { target: v.cards[1]?.text, facts: v.facts });
  }
  await shot('trigger');

  // 3. the workflow, its last run lit
  await ev(`document.querySelector('#autolist .row[data-workflow="triage"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'triage' && !/Reading its last run/.test(document.querySelector('#steps .fnfacts')?.innerText)`, 8000);
  {
    const v = await view();
    const card = (id) => v?.cards.find((c) => c.id === id);
    ok(JSON.stringify(v?.cols) === '[["pause"],["notify"],["giveup"]]' && !v.overlap && !v.empty, 'the workflow opens as its steps, left to right from its entry', v?.cols);
    ok(v?.wires.length === 2 && v.wires.some((w) => w.kind === 'then' && w.from === 'pause' && w.to === 'notify') && v.wires.some((w) => w.kind === 'fail' && w.from === 'notify' && w.to === 'giveup'), 'one wire for its next step, and its error route drawn as a failure', v?.wires);
    ok(/litok/.test(card('pause')?.cls) && /✓ Ran/.test(card('pause')?.text) && /litfail/.test(card('notify')?.cls) && /✗ Failed here/.test(card('notify')?.text), 'its last run: step 1 ran, step 2 is drawn failing', v?.cards);
    ok(/failed at step 2, Tell the owner/.test(v?.facts), 'the run is said failing at step 2, by the step\'s name', v?.facts);
    ok(v?.wires.find((w) => w.from === 'pause')?.ran === true, 'the wire the run crossed into step 2 is lit', v?.wires);
    ok(/Started by Every day|Started by When a Task is created/.test(v?.facts) && /When a Task is created/.test(v?.facts), 'it says the trigger that starts it', v?.facts);
    ok(/Open its steps/.test(card('notify')?.text) || /not in the project/.test(card('notify')?.text), 'its function step says it runs notifyOwner, which the app does not have', card('notify')?.text);
  }
  await shot('workflow-failed');

  // 4. turned off in Studio
  console.log('check: the daily trigger turned off in Studio');
  await ev(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(dailyId)}`, 5000);
  await b.clickSel('#steps .autoview .fnfacts .trigswitch');
  await b.until(`document.querySelector('#steps .autoview .fnfacts .trigswitch')?.getAttribute('aria-checked') === 'false'`, 8000);
  const backendTrigger = async () => (await be(`/admin/triggers/${encodeURIComponent(dailyId)}`)).trigger;
  ok(fileNow().triggers.find((t) => t.id === dailyId)?.enabled === false, 'the project\'s file says off', fileNow().triggers);
  ok((await backendTrigger())?.enabled === false, 'the backend says off');
  {
    const w = await agent.call('what_changed_since');
    ok((w.data?.automations ?? []).some((s) => s === `trigger "Morning digest" (${dailyId}) was turned off`), 'the agent\'s what_changed_since lists it', w.text.slice(0, 600));
    const l = await agent.call('list_backend_triggers');
    ok(l.data?.triggers?.find((t) => t.id === dailyId)?.enabled === false, 'the agent\'s next list_backend_triggers agrees', l.text.slice(0, 300));
  }
  ok(await ev(`[...document.querySelectorAll('#steps .autoview svg.wires path[data-kind]')].every((p) => p.dataset.kind === 'dead')`), 'off, its wire into the function is drawn dead');
  await shot('trigger-off');

  // 5. moved to 10:00
  console.log('check: moved to 10:00 in Studio');
  await ev(`(() => { const i = document.querySelector('#steps .autoview .trigtime'); i.value = '10:00'; i.dispatchEvent(new Event('input')); })()`);
  await b.clickSel('#steps .autoview .trigmove');
  await b.until(`document.querySelector('#steps .autoview .event-card h2')?.textContent === 'Every day at 10:00'`, 8000);
  ok(fileNow().triggers.find((t) => t.id === dailyId)?.schedule?.cron === '0 10 * * *' && fileNow().triggers.find((t) => t.id === dailyId)?.enabled === false, 'the project\'s file says 10:00, and still off', fileNow().triggers.find((t) => t.id === dailyId));
  ok((await backendTrigger())?.schedule?.cron === '0 10 * * *', 'the backend says 10:00');
  {
    const w = await agent.call('what_changed_since');
    ok(JSON.stringify(w.data?.automations) === JSON.stringify([`trigger "Morning digest" (${dailyId}) was moved from Every day at 09:00 (0 9 * * *) to Every day at 10:00 (0 10 * * *)`]), 'the agent\'s what_changed_since lists the move, in the schedule\'s words, and only that', w.data?.automations ?? w.text.slice(0, 400));
    const l = await agent.call('list_backend_triggers');
    ok(l.data?.triggers?.find((t) => t.id === dailyId)?.schedule?.cron === '0 10 * * *', 'the agent\'s next list_backend_triggers agrees');
  }
  ok(await b.until(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]')?.innerText.trim().startsWith('Every day at 10:00')`, 5000), 'the list says it too', await ev(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]')?.innerText`));
  await shot('trigger-moved');

  // a trigger the file does not have is refused, and nothing changes
  const refused = await fetch(url + 'api/automations/trigger', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'nobody', enabled: false }) });
  ok(refused.status === 409 && /no trigger "nobody"/.test((await refused.json()).error), 'a trigger the project\'s file lacks is refused');
} catch (e) {
  ok(false, `the check ran to its end: ${e.stack ?? e.message}`);
} finally {
  await b?.close?.();
  for (const c of children) c.kill();
  await wait(300);
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
