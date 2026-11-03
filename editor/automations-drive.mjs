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
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { shapeFields } from './automations.mjs';

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
  await b.clickSel('#rail [data-tab=backend]');
  await b.until(`document.querySelectorAll('#autolist .row').length === 3 && !document.querySelector('#autolist')?.innerText.includes('0 9 * * *')`, 10000);
  // STU-093: the Map's words for when it last ran ("just now: it failed") arrive with its words.js
  await b.until(`/last run/.test(document.querySelector('#autolist .row[data-workflow="triage"]')?.innerText ?? '') && !/\\d{4}/.test(document.querySelector('#autolist .row[data-workflow="triage"]')?.innerText ?? '')`, 8000).catch(() => {});
  const listed = await ev(`[...document.querySelectorAll('#autolist .row')].map((r) => ({ trigger: r.dataset.trigger, workflow: r.dataset.workflow, text: r.innerText.replace(/\\s+/g, ' ').trim() }))`);
  const said = (id) => listed.find((r) => r.trigger === id)?.text ?? '';
  ok(/^Every day at 09:00 ?On ?Starts the function sendDigest$/.test(said(dailyId)), 'the daily trigger: "Every day at 09:00", on, starting sendDigest (the backend\'s words for its cron)', said(dailyId));
  ok(/^When a Task is created ?On ?Starts the workflow Triage a new task · last run (just now|\d+ seconds ago): it failed \(A step failed/.test(said(rowsId)), 'the row-change trigger: "When a Task is created", starting the workflow by its name, and how its last fire went (STU-093)', said(rowsId));
  ok(listed.some((r) => r.workflow === 'triage' && /^Triage a new task Started by When a Task is created · 3 steps · last run (just now|\d+ seconds ago): it failed$/.test(r.text)), 'the workflow, by its name: what starts it, its three steps, and its last run in the Map\'s words (STU-093)', listed);
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

  // 3b. STU-093: a "last run" in the list opens the run, played: nothing lit, then each step in the order it ran, a dot
  // along each wire it crossed into the next, then the run stays lit as in 3
  console.log('check: a "last run" opens the run, played');
  await ev(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(dailyId)}`, 5000);
  await ev(`window.__playLog = []; clearInterval(window.__playTimer); window.__playTimer = setInterval(() => { const f = document.querySelector('#steps .autoview[data-workflow] .flow'); if (!f) return;
    const e = (f.classList.contains('playing') ? 'P' : '-') + '|' + [...f.querySelectorAll('.step.played')].map((x) => x.dataset.id).join(',') + '|' + [...f.querySelectorAll('circle.playdot')].map((c) => { const p = [...f.querySelectorAll('svg.wires path[data-ran]')].find((q) => q.getAttribute('d') === c.querySelector('animateMotion')?.getAttribute('path')); return p ? p.dataset.from + '>' + p.dataset.to : '?'; }).join(',');
    if (window.__playLog.at(-1) !== e) window.__playLog.push(e); }, 25); 0`);
  await ev(`document.querySelector('#autolist .row[data-workflow="triage"] .lastrun').click()`);
  await b.until(`(window.__playLog ?? []).some((e) => e.startsWith('P')) && window.__playLog.at(-1).startsWith('-')`, 10000).catch(() => {});
  {
    const log = await ev(`(clearInterval(window.__playTimer), window.__playLog)`);
    const v = await view();
    const lit = (e) => e.split('|')[1];
    const sets = [...new Set(log.filter((e) => e.startsWith('P')).map(lit))];
    ok(v?.workflow === 'triage' && log.some((e) => e.startsWith('P')), 'the workflow opens playing its run', log);
    ok(sets[0] === '' && sets.includes('pause') && sets.indexOf('pause') < sets.indexOf('pause,notify'), 'nothing lit first, then step 1, then step 2: the order the run took', sets);
    ok(log.some((e) => e.startsWith('P|pause|') && e.endsWith('pause>notify')), 'a dot runs the wire from step 1 into step 2 while step 2 waits', log);
    ok(!log.some((e) => /\?/.test(e.split('|')[2] ?? '')), 'a dot only ever runs a wire the run crossed', log);
    ok(log.at(-1)?.startsWith('-|') && /litok/.test(v?.cards.find((c) => c.id === 'pause')?.cls) && /litfail/.test(v?.cards.find((c) => c.id === 'notify')?.cls), 'then it stops, the run lit as before', { last: log.at(-1), cards: v?.cards.map((c) => c.cls) });
    ok(/Play the run/.test(v?.facts), 'and it can be played again', v?.facts);
  }
  // the trigger's card says its last fire the same way, and opens that run too
  await ev(`document.querySelector('#autolist .row[data-trigger="${rowsId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(rowsId)} && !!document.querySelector('#steps .openrun')`, 8000).catch(() => {});
  {
    const v = await view();
    ok(/Last fired (just now|\d+ seconds ago): it failed/.test(v?.facts) && /1 time in all/.test(v?.facts), 'the trigger\'s card: when it last fired, how it went, how often', v?.facts);
    await ev(`document.querySelector('#steps .openrun')?.click()`);
    ok(await b.until(`!!document.querySelector('#steps .autoview[data-workflow="triage"] .flow.playing')`, 8000).catch(() => false), 'its Open that run opens the workflow, playing');
    // Richard, 2026-10-31: "why … does it hide the left menu with all the functions? Seems unnecessary"
    ok(await ev(`!!document.getElementById('autolist').offsetParent && !!document.getElementById('fnlist').offsetParent && !!document.querySelector('#steps .cardnav .back')`), 'the list of workflows and functions stays beside the run it opened, and Back is still there');
    await b.until(`!document.querySelector('#steps .flow.playing')`, 8000).catch(() => {});
  }

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

  // STU-092: the Backend tab — a workflow changed in Studio, on the backend and in the file together; a step's data in a run
  console.log('check: STU-092, the Backend tab');
  await b.clickSel('#rail [data-tab=workflow]'); await wait(300);
  ok(await ev(`getComputedStyle(document.getElementById('autolist')).display === 'none' || !document.getElementById('autolist').offsetParent`), 'the Workflow tab lists the page\'s workflows only: the backend\'s are not in it');
  await b.clickSel('#rail [data-tab=backend]'); await wait(300);
  ok(await ev(`!!document.getElementById('autolist').offsetParent && !!document.getElementById('fnlist').offsetParent && !document.getElementById('events').offsetParent`), 'the Backend tab lists workflows and functions, and no page workflows');
  await ev(`document.querySelector('#autolist .row[data-workflow="triage"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'triage' && !/Reading its last run/.test(document.querySelector('#steps .fnfacts')?.innerText) && !!document.querySelector('#steps .wfacts [data-act=addfirst]')`, 8000);
  await ev(`document.querySelector('#steps .autoview .step[data-id="pause"]').click()`);
  await b.until(`!document.getElementById('wfinspect').hidden && !!document.querySelector('#wfinspect .rdin')`, 5000);
  {
    // P132 BWF-002: a tree, a field a line; each line's value read by its path
    const leaves = (sel) => `Object.fromEntries([...document.querySelectorAll('${sel} li[data-path]')].filter((l) => !l.querySelector('ul')).map((l) => [l.dataset.path, l.querySelector(':scope > .tv')?.textContent]))`;
    const p = await ev(`({ type: document.querySelector('#wfinspect .type')?.innerText, into: ${leaves('#wfinspect .rdin')}, out: ${leaves('#wfinspect .rdout')} })`);
    ok(/Step 1 · Wait/.test(p.type) && p.into?.duration === '10' && p.into?.unit === '"milliseconds"' && p.into?.['body.title'] === '"Water the plants"', 'a step clicked shows what went in, as the backend recorded the run: its settings and the row that started it', p);
    ok(Object.keys(p.out ?? {}).length > 0, 'and what came out', p.out);
  }
  await ev(`document.querySelector('#steps .autoview .step[data-id="notify"]').click()`);
  await b.until(`/Failed here/.test(document.querySelector('#wfinspect .rundata')?.innerText ?? '')`, 5000).catch(() => {});
  ok(await ev(`/Failed here/.test(document.querySelector('#wfinspect .rundata')?.innerText) && !document.querySelector('#wfinspect .rdout')`), 'the step that failed says why, and nothing came out of it');
  const beWf = async () => (await be('/admin/workflow-defs/triage')).workflow;
  const order = (w) => { const by = Object.fromEntries((w?.steps ?? []).map((x) => [x.id, x])); const o = []; for (let at = w?.entry; at && o.length < 9; at = by[at]?.next?.[0]) o.push(at); return o.join(' '); };
  // a setting changed
  await ev(`document.querySelector('#steps .autoview .step[data-id="pause"]').click()`); await wait(300);
  await ev(`(() => { const f = [...document.querySelectorAll('#wfinspect .field')].find((x) => x.querySelector('label')?.textContent === 'Duration'); const i = f.querySelector('.rvctl input'); i.value = '20'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await b.until(`/Saved, on the backend and in the project/.test(document.body.innerText)`, 8000).catch(() => {});
  await wait(300);
  ok(fileNow().workflows[0].steps.find((x) => x.id === 'pause').params.duration === 20 && (await beWf()).steps.find((x) => x.id === 'pause').params.duration === 20, 'a setting changed in the panel: the file and the backend both say 20', fileNow().workflows[0].steps[0]);
  // a step added after, then deleted
  const before = JSON.stringify(fileNow().workflows[0]);
  await ev(`document.querySelector('#wfinspect [data-act=addafter]').click()`); await wait(300);
  await ev(`document.querySelector('.menu .item[data-kind="wait"]').click()`);
  await b.until(`/Step 2 · Wait/.test(document.querySelector('#wfinspect .type')?.innerText ?? '')`, 8000).catch(() => {});
  ok(order(fileNow().workflows[0]) === 'pause wait notify' && order(await beWf()) === 'pause wait notify', 'a step added after another: between it and the next, in the file and on the backend', [order(fileNow().workflows[0]), order(await beWf())]);
  ok(JSON.stringify(await ev(`[...document.querySelectorAll('#steps .autoview .fncol')].map((c) => [...c.querySelectorAll('.step')].map((x) => x.dataset.id))`)) === '[["pause"],["wait"],["notify"],["giveup"]]', 'and drawn there');
  await ev(`document.querySelector('#wfinspect .head .danger').click()`);
  await b.until(`document.getElementById('wfinspect').hidden`, 8000).catch(() => {});
  await wait(300);
  ok(JSON.stringify(fileNow().workflows[0]) === before && order(await beWf()) === 'pause notify', 'deleted: the workflow is as it was, in the file and on the backend', [JSON.parse(before), fileNow().workflows[0]]);
  // a new workflow and its trigger, then both deleted
  await b.clickSel('#newauto'); await wait(300);
  await ev(`(() => { const set = (sel, v) => { const el = document.querySelector('.menu.newauto ' + sel); el.value = v; el.dispatchEvent(new Event(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', { bubbles: true })); }; set('input[aria-label="Workflow name"]', 'Nightly tidy'); set('select[aria-label="What starts it"]', 'schedule'); set('input[aria-label="The time it runs"]', '02:30'); })()`);
  await ev(`[...document.querySelectorAll('.menu.newauto .foot button')].find((x) => x.textContent === 'Create').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'nightly-tidy'`, 8000).catch(() => {});
  {
    const f = fileNow(), t = f.triggers.find((x) => x.target?.name === 'nightly-tidy');
    const beT = t && (await be(`/admin/triggers/${encodeURIComponent(t.id)}`)).trigger;
    ok(f.workflows.some((w) => w.id === 'nightly-tidy' && w.name === 'Nightly tidy' && w.steps.length === 1 && w.steps[0].kind === 'return') && !!(await be('/admin/workflow-defs/nightly-tidy')).workflow, 'New workflow: made in the file and on the backend; in an app with no functions, its one step ends it', f.workflows);
    ok(t?.type === 'schedule' && t.schedule.cron === '30 2 * * *' && beT?.schedule?.cron === '30 2 * * *' && !('secret' in t), 'with what starts it, every day at 02:30, in both (no secret in the file)', [t, beT]);
    await ev(`document.querySelector('.wfacts [data-act=delete]').click()`); await wait(400);
    ok(await ev(`/still starts it/.test(document.body.innerText)`) && fileNow().workflows.some((w) => w.id === 'nightly-tidy'), 'a workflow a trigger starts is not deleted: the trigger is named first');
    await ev(`document.querySelector('#autolist .row[data-trigger="${t?.id}"]').click()`); await wait(600);
    await ev(`document.querySelector('.wfacts [data-act=deltrigger]').click()`); await wait(300);
    await ev(`document.querySelector('.menu [data-act=confirm]').click()`);
    await b.until(`!document.querySelector('#autolist .row[data-trigger="${t?.id}"]')`, 8000).catch(() => {});
    await ev(`document.querySelector('#autolist .row[data-workflow="nightly-tidy"]').click()`); await wait(600);
    await ev(`document.querySelector('.wfacts [data-act=delete]').click()`); await wait(300);
    await ev(`document.querySelector('.menu [data-act=confirm]').click()`);
    await b.until(`!document.querySelector('#autolist .row[data-workflow="nightly-tidy"]')`, 8000).catch(() => {});
    const gone = await fetch(url + 'api/backend/admin/workflow-defs/nightly-tidy');
    ok(!fileNow().triggers.some((x) => x.id === t?.id) && !fileNow().workflows.some((w) => w.id === 'nightly-tidy') && gone.status === 404 && !(await be('/admin/triggers')).triggers.some((x) => x.id === t?.id), 'the trigger, then the workflow, deleted: gone from the file and the backend');
  }
  await shot('stu-092');

  // P132 BWF-001: what Richard met. Each Starts-on choice shows its own fields only (P132-STARTSONFORM: the rows were
  // `hidden` and drawn all the same, and the gate above only ever set values); a branch never given a plain next
  // (P132-BRANCHNEXT); its Yes and No drawn as named ports; a "+" on a wire and on an open No; a webhook made here answers
  console.log('check: P132 BWF-001, what Richard met');
  await b.clickSel('#newauto'); await wait(300);
  {
    const shown = {};
    for (const v of ['db-change', 'schedule', 'webhook', '']) {
      await ev(`(() => { const s = document.querySelector('.menu.newauto select[aria-label="What starts it"]'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); })()`);
      shown[v || 'nothing'] = await ev(`[...document.querySelectorAll('.menu.newauto .field[data-starts]')].filter((f) => f.getClientRects().length).map((f) => f.dataset.starts).join()`);
    }
    ok(JSON.stringify(shown) === '{"db-change":"db-change","schedule":"schedule","webhook":"webhook","nothing":""}', 'New workflow: each Starts-on choice shows its own fields and no other\'s, on screen', shown);
    await ev(`[...document.querySelectorAll('.menu.newauto .foot button')].find((x) => x.textContent === 'Cancel').click()`);
  }
  const triage = () => fileNow().workflows.find((w) => w.id === 'triage');
  const stepOf = (w, id) => w?.steps.find((x) => x.id === id);
  await ev(`document.querySelector('#autolist .row[data-workflow="triage"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'triage' && !!document.querySelector('#steps .wfacts [data-act=addfirst]')`, 8000);
  await ev(`document.querySelector('#steps .wfacts [data-act=addfirst]').click()`); await wait(300);
  await ev(`document.querySelector('.menu .item[data-kind="branch"]').click()`);
  await b.until(`!!document.querySelector('#steps .autoview .step[data-id="branch"]')`, 8000).catch(() => {});
  await wait(400);
  ok(JSON.stringify(stepOf(triage(), 'branch')?.routes) === '{"ontrue":["pause"]}' && !('next' in (stepOf(triage(), 'branch') ?? {})) && JSON.stringify(stepOf(await beWf(), 'branch')?.routes) === '{"ontrue":["pause"]}', 'an If added at the start carries on down its Yes, with no plain next, in the file and on the backend', stepOf(triage(), 'branch'));
  ok(await ev(`(() => { const words = [...document.querySelectorAll('#steps svg.wires text.portword')].map((t) => t.textContent); return words.includes('Yes') && words.includes('No'); })()`) && await ev(`!!document.querySelector('#steps svg.wires path[data-open="onfalse"][data-from="branch"]') && !!document.querySelector('#steps .wireplus button[data-open="onfalse"][data-from="branch"]')`), 'the If draws Yes on its wire and an open No with a "+" on it', await ev(`[...document.querySelectorAll('#steps svg.wires text.portword')].map((t) => t.textContent)`));
  await ev(`document.querySelector('#steps .wireplus button[data-from="branch"][data-to="pause"]').click()`); await wait(300);
  await ev(`document.querySelector('.menu .item[data-kind="wait"]').click()`);
  await b.until(`!!document.querySelector('#steps .autoview .step[data-id="wait"]')`, 8000).catch(() => {});
  await wait(300);
  ok(JSON.stringify(stepOf(triage(), 'branch')?.routes) === '{"ontrue":["wait"]}' && JSON.stringify(stepOf(triage(), 'wait')?.next) === '["pause"]' && JSON.stringify(stepOf(await beWf(), 'wait')?.next) === '["pause"]', 'a step put with the "+" on the Yes wire lands between the If and the step after it, in the file and on the backend', [stepOf(triage(), 'branch'), stepOf(triage(), 'wait')]);
  await ev(`document.querySelector('#steps .wireplus button[data-open="onfalse"][data-from="branch"]').click()`); await wait(300);
  await ev(`document.querySelector('.menu .item[data-kind="stop"]').click()`);
  await b.until(`!!document.querySelector('#steps .autoview .step[data-id="stop"]')`, 8000).catch(() => {});
  await wait(300);
  ok(JSON.stringify(stepOf(triage(), 'branch')?.routes) === '{"ontrue":["wait"],"onfalse":["stop"]}', 'the "+" on the open No adds on No', stepOf(triage(), 'branch'));
  // an agent's (or an older Studio's) branch with a plain next: drawn and said, and put on a side in a click
  {
    const legacy = { ...triage(), steps: triage().steps.map((x) => (x.id === 'branch' ? { ...x, routes: { ontrue: ['wait'] }, next: ['stop'] } : x)) };
    const r = await fetch(url + 'api/automations/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: legacy }) });
    const j = await r.json();
    ok(r.ok && JSON.stringify(stepOf(triage(), 'branch')?.next) === '["stop"]', 'a branch carrying a plain next, written as an agent writes it', j.error);
    await b.until(`(() => { const t = [...document.querySelectorAll('#steps svg.wires text.portword')].map((x) => x.textContent); return t.includes('Always'); })()`, 8000).catch(() => {});
    ok(await ev(`[...document.querySelectorAll('#steps svg.wires text.portword')].map((x) => x.textContent).includes('Always') && !!document.querySelector('#steps svg.wires path[data-kind="always"][data-from="branch"][data-to="stop"]')`), 'its next is drawn as its own wire, named Always, never as the No');
    await ev(`document.querySelector('#steps .autoview .step[data-id="branch"]').click()`);
    await b.until(`!!document.querySelector('#wfinspect [data-always]')`, 5000).catch(() => {});
    ok(await ev(`/Always, as well: stop/.test(document.querySelector('#wfinspect [data-always]')?.innerText ?? '') && /runs whatever this step decides/.test(document.getElementById('wfinspect').innerText)`), 'the panel says it: it runs whatever the If decides', await ev(`document.getElementById('wfinspect').innerText.slice(0, 400)`));
    await ev(`document.querySelector('#wfinspect [data-act="onto-onfalse"]').click()`);
    await b.until(`!document.querySelector('#wfinspect [data-always]')`, 8000).catch(() => {});
    await wait(300);
    ok(JSON.stringify(stepOf(triage(), 'branch')?.routes) === '{"ontrue":["wait"],"onfalse":["stop"]}' && !('next' in stepOf(triage(), 'branch')) && !('next' in stepOf(await beWf(), 'branch')), 'put on No: the If decides again, in the file and on the backend', stepOf(triage(), 'branch'));
  }
  // a webhook made in Studio answers at the address it shows, with the key it shows once; the file never holds the key
  await b.clickSel('#newauto'); await wait(300);
  await ev(`(() => { const m = document.querySelector('.menu.newauto'); const set = (sel, v, t) => { const el = m.querySelector(sel); el.value = v; el.dispatchEvent(new Event(t)); }; set('select[aria-label="What starts it"]', 'webhook', 'change'); set('input[aria-label="Workflow name"]', 'New order', 'input'); set('select[aria-label="The function it runs first"]', 'kind:transform', 'change'); })()`);
  await ev(`[...document.querySelectorAll('.menu.newauto .foot button')].find((x) => x.textContent === 'Create').click()`);
  await b.until(`!!document.querySelector('.menu.hookmade [data-hook-secret]')`, 10000).catch(() => {});
  {
    const hook = await ev(`({ url: document.querySelector('.hookmade [data-hook-url]')?.textContent, key: document.querySelector('.hookmade [data-hook-secret]')?.textContent })`);
    const t = fileNow().triggers.find((x) => x.target?.name === 'new-order');
    ok(t?.type === 'webhook' && t.webhook.slug === 'new-order' && !JSON.stringify(fileNow()).includes(hook.key ?? '§') && fileNow().workflows.find((w) => w.id === 'new-order')?.steps[0]?.kind === 'transform', 'a webhook workflow, its first step any kind (a Transform), in the file with no key', t);
    const yes = hook.url && await fetch(hook.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-token': hook.key }, body: '{"order":7}' });
    const no = hook.url && await fetch(hook.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const ran = yes && await yes.json().catch(() => ({}));
    ok(yes?.status === 200 && ran.status === 'success' && no?.status === 401, 'a POST at the address it shows, with its key, runs the workflow; without the key it is refused', [hook.url, yes?.status, ran, no?.status]);
    await ev(`document.querySelector('.menu.hookmade .foot button')?.click()`);
  }
  await shot('p132-bwf001');
  // P132-STEPPANEL, measured with Richard (2026-11-02): on a trigger's page he clicked the workflow it starts and nothing
  // came up; neither card answered a click, only a small link did. Both cards answer now, and what starts it has settings
  console.log('check: P132-STEPPANEL, a trigger\'s cards');
  const rowsT = () => fileNow().triggers.find((x) => x.id === rowsId);
  await ev(`document.querySelector('#autolist .row[data-trigger="${rowsId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(rowsId)}`, 8000).catch(() => {});
  await b.clickSel('#steps .autoview .step[data-id="target"] h3');
  ok(await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'triage'`, 5000), 'a click on the workflow a trigger starts opens that workflow');
  await ev(`document.querySelector('#autolist .row[data-trigger="${rowsId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(rowsId)}`, 8000).catch(() => {});
  await b.clickSel('#steps .autoview .step[data-id="trigger"] h3');
  ok(await b.until(`!document.getElementById('wfinspect').hidden && /What starts the workflow/.test(document.getElementById('wfinspect').innerText) && document.getElementById('wfinspect').getBoundingClientRect().right <= innerWidth + 1`, 5000), 'a click on what starts it opens its settings on the right, on screen', await ev(`document.getElementById('wfinspect').innerText.slice(0, 200)`));
  await ev(`(() => { const x = document.querySelector('#wfinspect input[type=checkbox][value="update"]'); x.checked = true; x.dispatchEvent(new Event('change')); })()`);
  await b.until(`/It watches Task now/.test(document.body.innerText)`, 8000).catch(() => {});
  await wait(300);
  ok(JSON.stringify(rowsT()?.dbChange?.actions) === '["create","update"]' && JSON.stringify((await be(`/admin/triggers/${encodeURIComponent(rowsId)}`)).trigger?.dbChange?.actions) === '["create","update"]', 'a change ticked in its settings: watched in the file and on the backend', rowsT()?.dbChange);
  ok(await b.until(`!document.getElementById('wfinspect').hidden && document.querySelector('#steps .autoview h2')?.textContent === 'When a Task is created or changed'`, 5000), 'the panel stays open, and the trigger is named by what it now watches', await ev(`document.querySelector('#steps .autoview h2')?.textContent`));
  await ev(`document.querySelector('#autolist .row[data-trigger="${dailyId}"]').click()`);
  await b.until(`document.querySelector('#steps .autoview')?.dataset.trigger === ${JSON.stringify(dailyId)}`, 8000).catch(() => {});
  await b.clickSel('#steps .autoview .step[data-id="trigger"] h3');
  await b.until(`!!document.querySelector('#wfinspect select[aria-label="Which days"]')`, 5000).catch(() => {});
  await ev(`(() => { const d = document.querySelector('#wfinspect select[aria-label="Which days"]'); d.value = '1-5'; d.dispatchEvent(new Event('change')); })()`);
  await b.until(`/monday to friday/.test(document.body.innerText)`, 8000).catch(() => {});
  await wait(300);
  ok(fileNow().triggers.find((x) => x.id === dailyId)?.schedule?.cron === '0 10 * * 1-5' && (await backendTrigger())?.schedule?.cron === '0 10 * * 1-5', 'its days changed in its settings: Monday to Friday at 10:00, in the file and on the backend', fileNow().triggers.find((x) => x.id === dailyId)?.schedule);
  await shot('p132-trigger-panel');

  // P132 BWF-002: a two-step workflow a Task row starts, tested on a picked Task row, then up to its first step
  console.log('check: P132 BWF-002, a workflow tested on a sample');
  {
    const steps = [
      { id: 'read', name: 'Read the task', kind: 'transform', params: { output: { task: { $path: 'body.title' }, action: { $path: 'trigger.action' } } }, next: ['say'] },
      { id: 'say', name: 'Say it', kind: 'transform', params: { output: { line: { $path: 'upstream.read.task' } } } }];
    const r = await fetch(url + 'api/automations/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: { id: 'watered', name: 'When a task is made', entry: 'read', steps }, trigger: { type: 'db-change', name: 'A task made', dbChange: { collection: 'Task', actions: ['create'] } } }) });
    ok(r.ok, 'a two-step workflow a new Task starts, written as Studio writes one', r.ok || (await r.json()).error);
    await b.until(`!!document.querySelector('#autolist .row[data-workflow="watered"]')`, 8000).catch(() => {});
    await ev(`document.querySelector('#autolist .row[data-workflow="watered"]').click()`);
    await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'watered' && /No sample yet/.test(document.querySelector('#steps .testrow')?.innerText ?? '')`, 8000).catch(() => {});
    ok(await ev(`/No sample yet/.test(document.querySelector('#steps .testrow')?.innerText ?? '') && document.querySelector('#steps [data-act="test"]').disabled`), 'no sample yet: said, and Test waits for one', await ev(`document.querySelector('#steps .testrow')?.innerText`));
    await b.clickSel('#steps [data-act="sample"]');
    await b.until(`!!document.querySelector('.menu.sample [data-row]')`, 8000).catch(() => {});
    ok(await ev(`(() => { const m = document.querySelector('.menu.sample'); return m?.querySelector('[data-input=samplekind]').value === 'db-change' && m.querySelector('[data-input=sampletable]').value === 'Task' && m.querySelector('[data-input=sampleaction]').value === 'create' && /Water the plants/.test(m.querySelector('.samplerows').innerText); })()`), 'the sample starts as what starts it: a Task made, its rows offered by name', await ev(`document.querySelector('.menu.sample')?.innerText`));
    await ev(`document.querySelector('.menu.sample [data-row]').click()`);
    await ev(`document.querySelector('.menu.sample [data-act=keepsample]').click()`);
    await b.until(`/Sample: Task Water the plants, made/.test(document.querySelector('#steps .testrow')?.innerText ?? '')`, 8000).catch(() => {});
    ok(await ev(`/Sample: Task Water the plants, made/.test(document.querySelector('#steps .testrow')?.innerText ?? '')`), 'the sample named in the panel: "Sample: Task Water the plants, made"', await ev(`document.querySelector('#steps .testrow')?.innerText`));
    const kept = JSON.parse(readFileSync(join(project, '.nodegx', 'workflow-samples.json'), 'utf8'));
    ok(kept.samples.watered?.rowId === row.objectId && kept.samples.watered.body.title === 'Water the plants', 'kept beside the project, the row and all', kept);
    spawnSync('git', ['init', '-q'], { cwd: project });
    const ignored = spawnSync('git', ['check-ignore', '-q', '.nodegx/workflow-samples.json'], { cwd: project }).status;
    ok(ignored === 0 && /^\.nodegx\/$/m.test(readFileSync(join(project, '.gitignore'), 'utf8')), 'and in no file git tracks: `git check-ignore` says ignored (.nodegx/ added to .gitignore)', ignored);
    // the first test says it runs for real; then both steps lit, each with what went in and came out
    const testRuns = (await be('/admin/workflow-step-kinds')).testRuns === true;
    await b.clickSel('#steps [data-act="test"]');
    await b.until(`/rows it makes are real/.test(document.querySelector('.surescrim')?.innerText ?? '')`, 5000).catch(() => {});
    ok(await ev(`/This runs on your development backend: rows it makes are real/.test(document.querySelector('.surescrim')?.innerText ?? '')`), 'the first test says it runs for real, on the development backend');
    await ev(`document.querySelector('.surescrim [data-act=yes]').click()`);
    if (!testRuns) {
      // the kit's backend predates NodeGX 511e41d5d: refused before anything runs, rather than every step run for real
      await b.until(`/older than tests/.test(document.body.innerText)`, 8000).catch(() => {});
      ok(await ev(`/older than tests: it would run every step for real/.test(document.body.innerText)`) && !(await be('/admin/workflow-defs')).lastRuns?.watered, 'a backend older than tests refuses the test in words, and nothing ran');
      console.log('  (AC1 and AC2 not graded: this backend has no tests yet. Run with NODEGX_REPO at NodeGX 511e41d5d or later, or after a release carrying it)');
    } else {
      await b.until(`/Tested/.test(document.querySelector('#steps .fnfacts .run')?.innerText ?? '')`, 10000).catch(() => {});
      const v = await view();
      const card = (id) => v?.cards.find((c) => c.id === id);
      const last = (await be('/admin/workflow-defs')).lastRuns?.watered;
      const rec = last ? await be(`/executions/${encodeURIComponent(last.id)}`) : null;
      const recStep = (id) => rec?.steps?.find((x) => x.nodeId === id);
      ok(/litok/.test(card('read')?.cls) && /litok/.test(card('say')?.cls) && /^● Tested .* · finished/m.test(v?.facts), 'AC1: tested, both steps lit', v && { facts: v.facts, cards: v.cards.map((c) => c.cls) });
      ok(rec?.metadata?.test === true && rec.triggerType === 'db_change' && recStep('read')?.outputData?.task === 'Water the plants' && recStep('read')?.outputData?.action === 'create' && recStep('say')?.outputData?.line === 'Water the plants', 'AC1: in the backend\'s history it is a test, started as a Task made, the row read', rec && { meta: rec.metadata, trigger: rec.triggerType, steps: rec.steps?.map((x) => [x.nodeId, x.outputData]) });
      await b.clickSel('#steps .autoview .step[data-id="read"] h3');
      await b.until(`!!document.querySelector('#wfinspect .rundata .vtree')`, 5000).catch(() => {});
      const box = await ev(`(() => { const b = document.querySelector('#wfinspect .rundata'); return b && { head: b.querySelector('.sechead')?.textContent, in: [...b.querySelectorAll('.rdin li[data-path]')].map((l) => l.dataset.path), out: b.querySelector('.rdout')?.innerText }; })()`);
      ok(box?.head === 'In the test' && box.in.includes('body.title') && box.in.includes('trigger.action') && /task\s+"Water the plants"/.test(box.out) && /action\s+"create"/.test(box.out), 'AC1: its panel shows what went in and what came out, as a tree a field a line', box);
      // AC2: up to this step: step 2 not reached, the record says where it stopped
      await b.clickSel('#wfinspect [data-act="testupto"]');
      await b.until(`/stopped after step 1, Read the task/.test(document.querySelector('#steps .fnfacts .run')?.innerText ?? '')`, 10000).catch(() => {});
      const v2 = await view();
      const last2 = (await be('/admin/workflow-defs')).lastRuns?.watered;
      const rec2 = last2 ? await be(`/executions/${encodeURIComponent(last2.id)}`) : null;
      ok(!(await ev(`!!document.querySelector('.surescrim')`)) && /stopped after step 1, Read the task/.test(v2?.facts), 'AC2: Test up to this step, asked once already: "stopped after step 1, Read the task"', v2?.facts);
      ok(/litok/.test(v2?.cards.find((c) => c.id === 'read')?.cls) && /Not reached in the test/.test(v2?.cards.find((c) => c.id === 'say')?.text), 'AC2: step 2 is shown not reached', v2?.cards.map((c) => c.text));
      ok(rec2?.metadata?.stoppedAfter === 'read' && rec2.status === 'success' && rec2.steps?.find((x) => x.nodeId === 'say')?.status === 'skipped', 'AC2: the record says it stopped after step 1, not that it failed', rec2 && { meta: rec2.metadata, status: rec2.status });
    }
    // AC3: the sample is the page's to read again, not to hold
    await b.goto(url);
    await b.waitTitle((t) => t.startsWith('ready'), 90000);
    await b.clickSel('#rail [data-tab=backend]');
    await b.until(`!!document.querySelector('#autolist .row[data-workflow="watered"]')`, 8000).catch(() => {});
    await ev(`document.querySelector('#autolist .row[data-workflow="watered"]').click()`);
    ok(await b.until(`/Sample: Task Water the plants, made/.test(document.querySelector('#steps .testrow')?.innerText ?? '')`, 8000), 'AC3: Studio opened again, the sample is still there');
    // AC4: never on live
    const live = await fetch(url + 'api/automations/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: 'watered', env: 'live' }) });
    ok(live.status === 409 && /never on live/.test((await live.json()).error), 'AC4: a test against live is refused in words');
    await shot('p132-bwf002');
  }
  // P132 BWF-003: a value picked from what came before. A new workflow a Task starts, never run: an If, then a Wait
  console.log('check: P132 BWF-003, a value picked from what came before');
  {
    const kinds = (await be('/admin/workflow-step-kinds')).kinds ?? [];
    const silent = kinds.filter((k) => !['call-function', 'transform'].includes(k.kind) && !shapeFields(k.output).length).map((k) => k.kind);
    ok(kinds.length > 10 && !silent.length, "every kind's output in the catalog names its fields (a function's come from its Response, a transform's from its own object)", silent);
    const steps = [{ id: 'first', name: 'Is it there', kind: 'branch', params: { condition: { left: '', op: 'truthy' } }, routes: { ontrue: ['second'] } }, { id: 'second', kind: 'wait', params: { duration: 1 } }];
    const r = await fetch(url + 'api/automations/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: { id: 'picked', name: 'Picked', entry: 'first', steps }, trigger: { type: 'db-change', name: 'A task made', dbChange: { collection: 'Task', actions: ['create'] } } }) });
    ok(r.ok, 'an If then a Wait a new Task starts, written as Studio writes one', r.ok || (await r.json()).error);
    await b.until(`!!document.querySelector('#autolist .row[data-workflow="picked"]')`, 8000).catch(() => {});
    await ev(`document.querySelector('#autolist .row[data-workflow="picked"]').click()`);
    await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'picked'`, 8000).catch(() => {});
    await b.clickSel('#steps .autoview .step[data-id="first"] h3');
    await b.until(`!!document.querySelector('#wfinspect .reads .readsrc')`, 8000).catch(() => {});
    const reads = () => ev(`[...document.querySelectorAll('#wfinspect .reads .readsrc')].map((x) => ({ root: x.dataset.root, from: x.dataset.from, words: x.querySelector('summary, .pickfield')?.innerText, paths: [...x.querySelectorAll('.vtree .pickfield')].map((f) => f.dataset.path) }))`);
    const first = await reads();
    const body = first?.find((x) => x.root === 'body');
    ok(body?.from === 'shape' && /no run yet/.test(body.words) && body.paths.includes('body.title') && body.paths.includes('body.objectId'), "AC3: no run, the first step reads the Task table's columns, said \"no run yet\"", first);
    ok(first?.map((x) => x.root).join() === 'body,trigger', 'the first step reads what started it and how, and no step', first?.map((x) => x.root));
    // AC1 (in Chrome): a field dragged onto the If's "This"
    await ev(`(() => { const dt = new DataTransfer(); const from = document.querySelector('#wfinspect .reads .pickfield[data-path="body.title"]'); const to = document.querySelector('#wfinspect .condwords .field.runvalue'); from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); })()`);
    const pickedWf = () => fileNow().workflows.find((w) => w.id === 'picked');
    for (let i = 0; i < 40 && JSON.stringify(pickedWf()?.steps[0].params.condition.left) !== '{"$path":"body.title"}'; i++) await wait(150);
    await b.until(`!!document.querySelector('#wfinspect .condwords .pill[data-path="body.title"]')`, 5000).catch(() => {});
    ok(JSON.stringify(pickedWf()?.steps[0].params.condition.left) === '{"$path":"body.title"}' && JSON.stringify((await be('/admin/workflow-defs/picked')).workflow?.steps?.[0]?.params?.condition?.left) === '{"$path":"body.title"}', 'AC1: the Task\'s title dragged onto This: {"$path":"body.title"}, in the file and on the backend', pickedWf()?.steps[0]);
    ok(await ev(`document.querySelector('#wfinspect .condwords .pill[data-path="body.title"]')?.innerText === 'title · from the Task that was made'`), 'AC1: the panel says it in words: "title · from the Task that was made"', await ev(`document.querySelector('#wfinspect .condwords .rvpill')?.innerText`));
    // AC2 (in Chrome): the Wait reads the If, its shape from the catalog; picked from its menu
    await b.clickSel('#steps .autoview .step[data-id="second"] h3');
    await b.until(`[...document.querySelectorAll('#wfinspect .reads .readsrc')].some((x) => x.dataset.root === 'upstream.first')`, 8000).catch(() => {});
    const second = await reads();
    const up = second?.find((x) => x.root === 'upstream.first');
    ok(second?.map((x) => x.root).join() === 'body,trigger,upstream.first' && up?.from === 'shape' && JSON.stringify(up.paths) === '["upstream.first.result","upstream.first.isfalse"]' && /^Is it there/.test(up.words), 'AC2: the step after reads the If by its name, its result and isfalse from the catalog, no run yet', second);
    await ev(`(() => { const sel = document.querySelector('#wfinspect .field.runvalue .rvmode'); sel.value = 'from'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await b.until(`!!document.querySelector('.menu.picker .pickfield[data-path="upstream.first.result"]')`, 5000).catch(() => {});
    ok(await ev(`[...document.querySelectorAll('.menu.picker .readsrc')].map((x) => x.dataset.root).join() === 'body,trigger,upstream.first'`), '"From the run" opens a menu of what it can read', await ev(`document.querySelector('.menu.picker')?.innerText`));
    await ev(`document.querySelector('.menu.picker .pickfield[data-path="upstream.first.result"]').click()`);
    for (let i = 0; i < 40 && JSON.stringify(pickedWf()?.steps[1].params.duration) !== '{"$path":"upstream.first.result"}'; i++) await wait(150);
    await b.until(`!!document.querySelector('#wfinspect .pill[data-path="upstream.first.result"]')`, 5000).catch(() => {});
    ok(JSON.stringify(pickedWf()?.steps[1].params.duration) === '{"$path":"upstream.first.result"}' && !(await ev(`!!document.querySelector('.menu.picker')`)), 'a click in the menu writes {"$path":"upstream.first.result"}, and the menu closes', pickedWf()?.steps[1]);
    ok(await ev(`document.querySelector('#wfinspect .pill[data-path="upstream.first.result"]')?.innerText === 'result · from Is it there'`), 'its pill: "result · from Is it there"', await ev(`document.querySelector('#wfinspect .rvpill')?.innerText`));
    await shot('p132-bwf003');
    await ev(`document.querySelector('#wfinspect .pill[data-path="upstream.first.result"]').click()`);
    await b.until(`!!document.querySelector('.menu.picker [data-act=aspath]')`, 5000).catch(() => {});
    await ev(`document.querySelector('.menu.picker [data-act=aspath]').click()`);
    ok(await ev(`document.querySelector('#wfinspect input[data-input=aspath]')?.value === 'upstream.first.result' && !document.querySelector('.menu.picker')`), 'the path is typed only when asked: the pill\'s menu, "Edit as path"', await ev(`document.querySelector('#wfinspect .field.runvalue')?.innerHTML.slice(0, 300)`));
    // P132-FILTERNOCONDITION, and AC4 in Chrome: a Filter added from the menu is taken; its condition reads the item first
    await b.clickSel('#steps .autoview .step[data-id="second"] h3');
    await b.until(`!!document.querySelector('#wfinspect [data-act=addafter]')`, 5000).catch(() => {});
    await ev(`document.querySelector('#wfinspect [data-act=addafter]').click()`); await wait(300);
    await ev(`document.querySelector('.menu .item[data-kind="filter"]').click()`);
    for (let i = 0; i < 40 && !pickedWf()?.steps.some((x) => x.kind === 'filter'); i++) await wait(150);
    const filt = pickedWf()?.steps.find((x) => x.kind === 'filter');
    ok(!!filt && JSON.stringify(filt.params.condition) === '{"left":{"$path":"item"},"op":"truthy"}' && (await be('/admin/workflow-defs/picked')).workflow?.steps?.some((x) => x.kind === 'filter'), 'P132-FILTERNOCONDITION: a Filter added from the menu starts with a condition, in the file and on the backend', pickedWf()?.steps);
    await b.clickSel(`#steps .autoview .step[data-id="${filt?.id}"] h3`);
    await b.until(`!!document.querySelector('#wfinspect .condwords .pill[data-path="item"]')`, 5000).catch(() => {});
    ok(await ev(`document.querySelector('#wfinspect .condwords .pill[data-path="item"]')?.innerText === 'this item · from the list'`), 'its condition says it in words: "this item · from the list"', await ev(`document.querySelector('#wfinspect .condwords')?.innerText`));
    await ev(`document.querySelector('#wfinspect .condwords .pill[data-path="item"]').click()`);
    await b.until(`!!document.querySelector('.menu.picker .readsrc')`, 5000).catch(() => {});
    ok(await ev(`[...document.querySelectorAll('.menu.picker .readsrc')].map((x) => x.dataset.root).join() === 'item,index,body,trigger,upstream.first,upstream.second'`), 'AC4: in its condition, this item and its position first, then what came before', await ev(`[...document.querySelectorAll('.menu.picker .readsrc')].map((x) => x.dataset.root)`));
    await ev(`document.querySelector('.menu.picker')?.remove()`);
  }
  // P132 BWF-004: a formula from the menu, no JSON typed: the days between a date and now, run in a test
  console.log('check: P132 BWF-004, a formula picked by its words');
  {
    const cat = await be('/admin/workflow-step-kinds');
    const steps = [{ id: 'days', name: 'How many days', kind: 'return', params: { value: '' } }];
    const r = await fetch(url + 'api/automations/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflow: { id: 'thirsty', name: 'Thirsty', entry: 'days', steps }, trigger: { type: 'db-change', name: 'A task made', dbChange: { collection: 'Task', actions: ['create'] } } }) });
    ok(r.ok, 'a Return a new Task starts, written as Studio writes one', r.ok || (await r.json()).error);
    await b.until(`!!document.querySelector('#autolist .row[data-workflow="thirsty"]')`, 8000).catch(() => {});
    await ev(`document.querySelector('#autolist .row[data-workflow="thirsty"]').click()`);
    await b.until(`document.querySelector('#steps .autoview')?.dataset.workflow === 'thirsty'`, 8000).catch(() => {});
    await b.clickSel('#steps .autoview .step[data-id="days"] h3');
    await b.until(`!!document.querySelector('#wfinspect .field.runvalue .rvmode')`, 8000).catch(() => {});
    const thirsty = () => fileNow().workflows.find((w) => w.id === 'thirsty');
    const offered = await ev(`[...document.querySelector('#wfinspect .field.runvalue .rvmode').options].map((o) => o.value)`);
    if (!cat.formulaLanguage) {
      ok(!offered?.includes('fn'), 'a backend with no formulas is offered none (its catalog has no formulaLanguage)', offered);
      console.log('  (AC3 not graded: this backend has no formulas yet. Run with NODEGX_REPO at a NodeGX carrying BWF-004, its dist rebuilt, or after a release carrying it)');
    } else {
      ok(offered?.join() === 'typed,from,fn', 'a setting is typed, read from the run, or a formula', offered);
      await ev(`(() => { const sel = document.querySelector('#wfinspect .field.runvalue .rvmode'); sel.value = 'fn'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await b.until(`!!document.querySelector('.menu.formulas .item[data-fn="date-difference"]')`, 5000).catch(() => {});
      const menu = await ev(`(() => { const m = document.querySelector('.menu.formulas'); return m && { heads: [...m.querySelectorAll('.h')].map((x) => x.textContent), items: m.querySelectorAll('.item').length, between: m.querySelector('.item[data-fn="date-difference"]')?.innerText }; })()`);
      ok(menu?.heads.join() === 'Text,Numbers,Yes or no,Dates,Lists' && menu.items === cat.formulaLanguage.formulas.length && /^Time between/.test(menu.between), "the menu is the backend's list, in groups, by its words", menu);
      await ev(`document.querySelector('.menu.formulas .item[data-fn="date-difference"]').click()`);
      for (let i = 0; i < 40 && thirsty()?.steps[0].params.value?.$fn !== 'date-difference'; i++) await wait(150);
      ok(JSON.stringify(thirsty()?.steps[0].params.value) === '{"$fn":"date-difference","args":[{"$fn":"now"},{"$fn":"now"},"days"]}' && (await be('/admin/workflow-defs/thirsty')).workflow?.steps?.[0]?.params?.value?.$fn === 'date-difference', 'picked: saved at once with values the backend takes (its dates Now, its unit days), in the file and on the backend', thirsty()?.steps[0]);
      await b.until(`!!document.querySelector('#wfinspect .formula .fxwords')`, 5000).catch(() => {});
      ok(await ev(`document.querySelector('#wfinspect .formula .fxwords')?.innerText === 'days between now and now'`), 'drawn as its sentence: "days between now and now"', await ev(`document.querySelector('#wfinspect .formula')?.innerText`));
      // From: typed, then a date typed into it
      await ev(`(() => { const sel = document.querySelector('#wfinspect .formula .field[data-arg="from"] .rvmode'); sel.value = 'typed'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      for (let i = 0; i < 40 && typeof thirsty()?.steps[0].params.value?.args?.[0] !== 'string'; i++) await wait(150);
      await b.until(`!!document.querySelector('#wfinspect .formula .field[data-arg="from"] input[type=text]')`, 5000).catch(() => {});
      await ev(`(() => { const i = document.querySelector('#wfinspect .formula .field[data-arg="from"] input[type=text]'); i.value = '2026-10-28'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      for (let i = 0; i < 40 && thirsty()?.steps[0].params.value?.args?.[0] !== '2026-10-28'; i++) await wait(150);
      await b.until(`document.querySelector('#wfinspect .formula .fxwords')?.innerText === 'days between 2026-10-28 and now'`, 5000).catch(() => {});
      ok(JSON.stringify(thirsty()?.steps[0].params.value) === '{"$fn":"date-difference","args":["2026-10-28",{"$fn":"now"},"days"]}' && await ev(`document.querySelector('#wfinspect .formula .fxwords')?.innerText === 'days between 2026-10-28 and now'`), 'its From typed as a date: "days between 2026-10-28 and now", no JSON typed', thirsty()?.steps[0].params.value);
      const unit = await ev(`[...document.querySelector('#wfinspect .formula .field[data-arg="unit"] select:not(.rvmode)').options].map((o) => o.value)`);
      ok(unit?.slice(1).join() === 'minutes,hours,days,weeks,months,years', 'its unit is a choice of the served words', unit);
      await shot('p132-bwf004');
      if (cat.testRuns) {
        // a sample first (BWF-002): a Task made, its first row
        await b.clickSel('#steps [data-act="sample"]');
        await b.until(`!!document.querySelector('.menu.sample [data-row]')`, 8000).catch(() => {});
        await ev(`document.querySelector('.menu.sample [data-row]').click()`);
        await ev(`document.querySelector('.menu.sample [data-act=keepsample]').click()`);
        await b.until(`!document.querySelector('#steps [data-act="test"]')?.disabled`, 8000).catch(() => {});
        const lo = Math.trunc((Date.now() - Date.parse('2026-10-28T00:00:00Z')) / 864e5);
        await b.clickSel('#steps [data-act="test"]');
        await b.until(`!!document.querySelector('.surescrim [data-act=yes]') || /Tested/.test(document.querySelector('#steps .fnfacts .run')?.innerText ?? '')`, 8000).catch(() => {});
        await ev(`document.querySelector('.surescrim [data-act=yes]')?.click()`);
        await b.until(`/Tested/.test(document.querySelector('#steps .fnfacts .run')?.innerText ?? '')`, 10000).catch(() => {});
        const hi = Math.trunc((Date.now() - Date.parse('2026-10-28T00:00:00Z')) / 864e5);
        const last = (await be('/admin/workflow-defs')).lastRuns?.thirsty;
        const rec = last ? await be(`/executions/${encodeURIComponent(last.id)}`) : null;
        const got = rec?.steps?.find((x) => x.nodeId === 'days')?.outputData?.value;
        ok(got === lo || got === hi, `AC3: the test works it out on the backend: ${got} days`, rec && { status: rec.status, steps: rec.steps?.map((x) => [x.nodeId, x.status, x.outputData, x.error]) });
        await b.clickSel('#steps .autoview .step[data-id="days"] h3');
        await b.until(`!!document.querySelector('#wfinspect .rundata .rdout')`, 5000).catch(() => {});
        ok(got !== undefined && await ev(`(document.querySelector('#wfinspect .rundata .rdout')?.innerText ?? '').split(String.fromCharCode(10)).some((l) => l.trim().split(' ').filter(Boolean).join(' ') === 'value ${got}')`), 'AC3: and the panel shows the number that came out', await ev(`document.querySelector('#wfinspect .rundata')?.innerText`));
      }
      // More: its JSON only when asked
      await ev(`document.querySelector('#wfinspect .formula [data-act=fxmore]').click()`);
      await b.until(`!!document.querySelector('.menu [data-act=fxjson]')`, 5000).catch(() => {});
      await ev(`document.querySelector('.menu [data-act=fxjson]').click()`);
      ok(await ev(`/"date-difference"/.test(document.querySelector('#wfinspect textarea.json')?.value ?? '')`), 'its JSON is behind More, "Edit as JSON"');
    }
  }
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
