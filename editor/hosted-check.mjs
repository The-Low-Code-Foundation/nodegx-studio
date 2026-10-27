/**
 * NodeGX Studio — Studio inside a conversation (P127 BKO-002): Data's Privacy and Map, drawn from a FOREIGN origin.
 *
 * A host that renders MCP Apps (Claude Desktop) draws Studio's `/panel` at a sandbox origin of its own, with a CSP that
 * lets the page fetch from Studio and frame nothing (Claude names no `frameDomains`). This gate does the same: a copy
 * of NodeGX's todo-list template, its backend started by Studio's own "Start a backend", and a host of the gate's own
 * on another port that serves the panel with that CSP and answers `ui/initialize`, driven in headless Chrome.
 *
 *   1. Privacy draws each type's rule from the map's answers (`/backend-map/api/map`, `/backend-map/words.js`), which
 *      the panel asks for across origins
 *   2. Map draws the map itself, not the "Open the map" card: Studio's `/backend-map/` written into a src-less frame
 *      (the way the app preview is drawn), so no frame origin is needed
 *   3. "See it on the map" opens the map on that type (`#t:<type>`), and the map's live feed answers
 *   4. (BKO-004) a cloud function the agent made opens on Workflow as its graph, says what it touches (asked across
 *      origins) and, once it has run on the backend, its last run
 *
 *   node editor/hosted-check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node editor/hosted-check.mjs --shots    also writes ../docs/look/bko-002-*.png
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { AGENT_FN, makeFunctionAsAgent } from './agentmade-check.mjs';
import { cspFor, hostPage } from './hosted-host.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.argv.includes('--shots');
const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-hosted-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // the server inherits it: nothing is written to ~/.noodl
const { kit } = await import('../lib/nodegx.mjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); };

const project = join(tmp, 'todo-list');
cpSync(join(kit.templates, 'todo-list'), project, { recursive: true });

const children = [];
let b, host;
try {
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(server);
  let log = '';
  server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('nodegx-studio: http'); i++) await wait(100);
  const studio = `http://127.0.0.1:${port}`;

  const made = await (await fetch(studio + '/api/backend-provision', { method: 'POST' })).json();
  ok(made.phase === 'running', 'Start a backend: the todo copy has a backend of its own, running', made.phase);
  // a fresh backend has no Task table until a row lands, and the map draws the backend's tables: one task, as its admin
  const bound = JSON.parse(readFileSync(join(project, 'nodegx.project.json'), 'utf8')).metadata.cloudservices;
  const adminToken = JSON.parse(readFileSync(join(process.env.NODEGX_BACKENDS_DIR, bound.instanceId, 'secrets.json'), 'utf8')).adminToken;
  const row = await fetch(bound.endpoint + '/classes/Task', { method: 'POST', headers: { 'X-Parse-Application-Id': bound.appId, 'X-Parse-Master-Key': adminToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Water the plants' }) });
  ok(row.status < 300, 'a task on the backend, so Task is one of its tables', row.status);

  // BKO-004: the agent makes a cloud function (the kit's MCP server; the NodeGX checkout holds the example it sends)
  const repo = process.env.NODEGX_REPO ? process.env.NODEGX_REPO : join(here, '..', '..', 'OpenNoodl');
  let agentMade = true; try { await makeFunctionAsAgent(project, kit.mcpServer, repo, bound.instanceId); } catch (e) { agentMade = false; ok(false, 'the agent makes a cloud function and deploys it', e.message); }

  const panel = await (await fetch(studio + '/panel')).text();
  const hostPort = await freePort();
  host = http.createServer((req, res) => {
    if (req.url === '/panel.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': cspFor(studio) }); return res.end(panel); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(hostPage);
  });
  await new Promise((r) => host.listen(hostPort, '127.0.0.1', r));

  b = await browser({ port: await freePort(), width: 1400, height: 900 });
  await b.goto(`http://127.0.0.1:${hostPort}/`);
  const P = `document.getElementById('app').contentDocument`;
  const ev = (expr) => b.evaluate(expr);
  const until = (expr, ms = 8000) => b.until(expr, ms);
  /** Click the first element `sel` matches in the panel, once there is one; throws naming it when there never is. */
  const click = async (sel, ms = 15000) => {
    if (!(await until(`!!${P}.querySelector(${JSON.stringify(sel)})`, ms))) throw new Error(`nothing to click: ${sel}`);
    await ev(`${P}.querySelector(${JSON.stringify(sel)}).click()`);
  };
  const ready = await until(`(${P}?.title || '').startsWith('ready')`, 90000);
  ok(ready, 'the panel, drawn from another origin than Studio\'s, comes up', await ev(`${P}?.title`));
  const shot = async (name) => { if (shots) { await wait(600); await b.screenshot(name.startsWith('bko-00') ? join(here, '..', '..', 'OpenNoodl', 'dev-docs', 'tasks', 'phase-127-the-backend-in-the-open', 'look', `${name}.png`) : join(here, '..', 'docs', 'look', `bko-002-${name}.png`)); } };

  console.log('check: BKO-002 Privacy in the conversation');
  await click('[data-tab=data]'); await wait(400);
  await click('[data-sub=privacy]');
  const drew = await until(`!!${P}.querySelector('#privtypes .row[data-type=Task]')`, 15000);
  ok(drew, 'Privacy lists the app\'s types, read from the map across origins', drew ? undefined : await ev(`${P}.querySelector('#privmain')?.textContent`));
  if (drew) {
    await click('#privtypes .row[data-type=Task]');
    const said = await until(`${P}.querySelector('#privmain select[data-rule=read]') && ${P}.querySelector('#privmain').textContent`, 15000);
    ok(said && /Task/.test(said), 'a type says who can reach it, in the map\'s words, with the rule to change', String(said).slice(0, 160));
    await shot('privacy');
  }

  console.log('check: BKO-002 the map in the conversation');
  await click('[data-sub=map]'); await wait(400);
  const F = `${P}.getElementById('mapframe')`;
  const shown = await ev(`(() => { const f = ${F}; return !!f && getComputedStyle(f).display !== 'none' && !${P}.querySelector('#data-map .hostedmap:not([hidden])'); })()`);
  ok(shown, 'Map shows the map\'s frame, not the "Open the map" card');
  const opened = await until(`(() => { const d = ${F}?.contentDocument; const l = d?.getElementById('backendLine')?.textContent || ''; return d?.getElementById('map') && l && !/^Opening the backend/.test(l) ? l : false; })()`, 20000);
  ok(opened, 'the map draws inside it: its canvas, and the backend it read', opened || await ev(`${F}?.contentDocument?.body?.innerText?.slice(0, 200) ?? null`));
  await shot('map');

  if (drew) {
    await click('[data-sub=privacy]');
    await click('#privtypes .row[data-type=Task]');
    await click('#privmain h2 .acts button');
    const focused = await until(`(() => { const w = ${F}?.contentWindow; const d = w?.document; return d && w.location.hash === '#t:Task' && d.getElementById('panel') && !d.getElementById('panel').classList.contains('hidden') ? d.getElementById('panelBody').textContent.slice(0, 120) : false; })()`, 20000);
    ok(focused && /Task/.test(focused), '"See it on the map" opens the map on Task (#t:Task): its story is up', focused || await ev(`(() => { const f = ${F}; return { src: f?.src, href: f?.contentWindow?.location?.href, sub: ${P}.querySelector('#data .subtabs [aria-selected=true], #data .subtabs .on')?.textContent, ids: Object.keys(f?.contentWindow?.__map?.byId || {}).slice(0, 12), panel: f?.contentDocument?.getElementById('panel')?.className, selected: f?.contentWindow?.__map?.selected ?? null }; })()`));
    const feed = await until(`(() => { const t = ${F}?.contentDocument?.getElementById('tickerNote')?.textContent || ''; return t && !/^listening to the backend/.test(t) ? t : false; })()`, 15000);
    ok(feed, 'the map\'s live feed of what just ran answers inside the frame', feed || await ev(`${F}?.contentDocument?.getElementById('tickerNote')?.textContent ?? null`));
    await shot('map-on-task');
  }

  if (agentMade) {
    console.log('check: BKO-004 a cloud function in the conversation');
    await click('[data-tab=workflow]');
    await click(`#fnlist .row[data-fn="${AGENT_FN}"]`);
    const read = `(() => { const v = ${P}.querySelector('#steps .fnview'); if (!v || v.querySelector('.fnfacts .touches').textContent.startsWith('Reading') || v.querySelector('.fnfacts .run').textContent.startsWith('Reading')) return false;
      const cards = [...v.querySelectorAll('.fnflow .step')]; return { key: v.dataset.fn, cards: cards.length, sized: cards.every((c) => c.getBoundingClientRect().width > 60 && c.getBoundingClientRect().height > 30),
      wires: [...v.querySelectorAll('svg.wires path[data-kind]')].map((p) => p.dataset.kind), touches: v.querySelector('.fnfacts .touches').textContent, run: v.querySelector('.fnfacts .run').textContent }; })()`;
    const fn = await until(read, 15000);
    ok(fn && fn.key === AGENT_FN && fn.cards === 5 && fn.sized && fn.wires.length === 10 && fn.wires.includes('signal') && fn.wires.includes('value'), 'inside the conversation, List Role Members draws as its graph: 5 cards, 10 wires, signals and values', fn);
    ok(fn && !/could not be read|isn’t installed/.test(fn.touches), 'what it reads and writes is asked of Studio across origins, and answered', fn?.touches);
    ok(fn && /Not run on this backend yet/.test(fn.run), 'before it has run, its last run says so', fn?.run);
    await shot('bko-004-hosted-function');
    // it runs once on the backend, as a caller would call it; opened again, its last run is said
    const called = await fetch(`${bound.endpoint}/functions/${encodeURIComponent('List Role Members')}`, { method: 'POST', headers: { 'X-Parse-Application-Id': bound.appId, 'X-Parse-Master-Key': adminToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'nobody', page: 0 }) });
    const calledText = await called.text();
    await click(`#fnlist .row[data-fn="__cloud__/List Role Members"]`); await wait(300);
    await click(`#fnlist .row[data-fn="${AGENT_FN}"]`);
    const again = await until(`(() => { const t = ${P}.querySelector('#steps .fnview .fnfacts .run')?.textContent || ''; return t.startsWith('●') ? t : false; })()`, 15000);
    ok(again, 'after one call on the backend, its last run is said: when, how it ended, how long', again || { status: called.status, body: calledText.slice(0, 200), run: await ev(`${P}.querySelector('#steps .fnview .fnfacts .run')?.textContent`) });
    await shot('bko-004-hosted-function-ran');

    // the map's "Open its steps" (published with @nodegx/backend-map 0.1.3): its frame posts the function, Studio opens
    // it and Back goes to the map. Said here as the map says it, so Studio's half is graded before the map is out; a
    // message from anywhere else is not obeyed
    await click('[data-tab=data]'); await wait(300);
    await click('[data-sub=map]'); await wait(600);
    await ev(`${P}.defaultView.postMessage({ nodegx: 'open-function', component: ${JSON.stringify(AGENT_FN)} }, '*')`); await wait(500);
    ok(await ev(`!${P}.querySelector('#workflow:not([hidden]) .fnview')`), 'a message to open a function from anywhere but the map\'s frame is not obeyed');
    await ev(`${P}.getElementById('mapframe').contentWindow.eval("parent.postMessage({ nodegx: 'open-function', component: ${JSON.stringify(AGENT_FN).replace(/"/g, "'")} }, '*')")`);
    const fromMap = await until(`${P}.querySelector('#workflow:not([hidden]) .fnview')?.dataset.fn`, 8000);
    ok(fromMap === AGENT_FN, 'from the map\'s frame, "Open its steps" opens the function on Workflow', fromMap);
    await click('#steps .fnview .cardnav .back');
    ok(await until(`!${P}.getElementById('data').hidden && ${P}.querySelector('[data-sub=map][aria-selected=true]') && !${P}.getElementById('data-map').hidden`, 8000), 'Back goes to the map');
  }

  // BKO-005: a backend's trigger and workflow, drawn and switched off inside the conversation. Made on the backend and
  // kept in nodegx.automations.json as BKO-001 keeps them (the kit's published MCP server predates it; the agent's own
  // path is automations-drive.mjs's)
  console.log('check: BKO-005 triggers and workflows in the conversation');
  const admin = (method, path, body) => fetch(bound.endpoint + path, { method, headers: { 'X-Parse-Application-Id': bound.appId, 'X-Parse-Master-Key': adminToken, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then((r) => r.json());
  const wfDef = { id: 'nightly', name: 'Nightly tidy', entry: 'pause', steps: [{ id: 'pause', kind: 'wait', params: { duration: 5, unit: 'milliseconds' }, next: ['tidy'] }, { id: 'tidy', kind: 'call-function', ref: 'tidyUp' }] };
  const trigDef = { id: 'nightly-at-2', type: 'schedule', name: 'Every night', enabled: true, target: { kind: 'workflow', name: 'nightly' }, schedule: { cron: '0 2 * * *', missedFirePolicy: 'skip' } };
  await admin('POST', '/admin/workflow-defs', wfDef);
  await admin('POST', '/admin/triggers', trigDef);
  writeFileSync(join(project, 'nodegx.automations.json'), JSON.stringify({ version: 1, workflows: [{ ...wfDef, concurrency: 1 }], triggers: [trigDef] }, null, 2) + '\n');
  await click('[data-tab=workflow]');
  const listedRow = await until(`(() => { const r = ${P}.querySelector('#autolist .row[data-trigger="nightly-at-2"]'); return r && /^Every day at 02:00/.test(r.innerText.trim()) ? r.innerText.replace(/\\s+/g, ' ').trim() : false; })()`, 15000);
  ok(listedRow, 'inside the conversation, the trigger is listed in the backend\'s words for its cron, asked across origins', listedRow || await ev(`${P}.getElementById('autolist')?.innerText`));
  await click('#autolist .row[data-workflow="nightly"]');
  const drawn = await until(`(() => { const v = ${P}.querySelector('#steps .autoview[data-workflow="nightly"]'); if (!v || /Reading its last run/.test(v.innerText)) return false;
    return { cols: [...v.querySelectorAll('.fncol')].map((c) => [...c.querySelectorAll('.step')].map((s) => s.dataset.id)), wires: v.querySelectorAll('svg.wires path[data-kind]').length, facts: v.querySelector('.fnfacts').innerText }; })()`, 15000);
  ok(drawn && JSON.stringify(drawn.cols) === '[["pause"],["tidy"]]' && drawn.wires === 1 && /Started by Every day at 02:00/.test(drawn.facts) && /Not run on this backend yet/.test(drawn.facts), 'its workflow draws as two steps, wired, started by the trigger, not run yet', drawn);
  await shot('bko-005-hosted-workflow');
  await click('#autolist .row[data-trigger="nightly-at-2"] .trigswitch');
  const off = await until(`${P}.querySelector('#autolist .row[data-trigger="nightly-at-2"] .trigswitch')?.getAttribute('aria-checked') === 'false'`, 10000);
  const fileSays = JSON.parse(readFileSync(join(project, 'nodegx.automations.json'), 'utf8')).triggers[0].enabled;
  const backendSays = (await admin('GET', '/admin/triggers/nightly-at-2')).trigger?.enabled;
  ok(off && fileSays === false && backendSays === false, 'switched off inside the conversation: the project\'s file and the backend both say off', { off, fileSays, backendSays });
} catch (e) {
  ok(false, 'the gate ran to the end', e.message);
} finally {
  if (b) await b.close().catch(() => {});
  if (host) host.close();
  for (const c of children) c.kill('SIGTERM');
  await wait(1500); // the server stops the backends it started on SIGTERM
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${results.length - passed} of ${results.length}`);
process.exit(passed === results.length ? 0 : 1);
