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
 *      origins) and, once it has run on the backend, its last run, with the nodes that run acted in lit (FNSTEPS)
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
import { attach, browser } from './cdp.mjs';
import { AGENT_FN, makeFunctionAsAgent } from './agentmade-check.mjs';
import { cspFor, hostPage } from './hosted-host.mjs';
import { REQUEST } from './fngraph.mjs';

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
let b, host, tab;
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

  const chromePort = await freePort();
  b = await browser({ port: chromePort, width: 1400, height: 900 });
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
    // P127-BKO004-FNSTEPS: the nodes a run acted in are lit, read from the backend's own record of it (`GET /executions/<id>`)
    const cardsLit = `(() => { const v = ${P}.querySelector('#steps .fnview'); const c = [...(v?.querySelectorAll('.fnflow .step') ?? [])]; return c.some((x) => x.classList.contains('ran') || x.classList.contains('refused')) ? c.map((x) => ({ id: x.dataset.id, type: x.dataset.type, ran: x.classList.contains('ran'), refused: x.classList.contains('refused') })) : false; })()`;
    const door = await until(cardsLit, 10000);
    ok(door && door.every((c) => (c.type === REQUEST) === c.refused && !c.ran), 'a call turned away at the door (not signed in) lights the start refused, and no node as run', door);
    // the same function called by someone signed in: its nodes act, and the backend records each by its id
    const signup = await (await fetch(`${bound.endpoint}/users`, { method: 'POST', headers: { 'X-Parse-Application-Id': bound.appId, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'fnsteps@example.com', email: 'fnsteps@example.com', password: 'a-long-test-password-1' }) })).json();
    const signedIn = await fetch(`${bound.endpoint}/functions/${encodeURIComponent('List Role Members')}`, { method: 'POST', headers: { 'X-Parse-Application-Id': bound.appId, 'X-Parse-Session-Token': signup.sessionToken ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'nobody', page: 0 }) });
    const signedInText = await signedIn.text();
    await click(`#fnlist .row[data-fn="__cloud__/List Role Members"]`); await wait(300);
    await click(`#fnlist .row[data-fn="${AGENT_FN}"]`);
    const runs = await (await fetch(`${studio}/api/backend/executions?kind=function&name=${encodeURIComponent('List Role Members')}&limit=20`)).json();
    const record = runs[0] ? await (await fetch(`${studio}/api/backend/executions/${encodeURIComponent(runs[0].id)}`)).json() : null;
    const want = new Map((record?.steps ?? []).map((s) => [s.nodeId, s.status]));
    const lit = await until(`(() => { const l = ${cardsLit}; return l && l.some((c) => c.ran && c.type !== ${JSON.stringify(REQUEST)}) ? l : false; })()`, 10000);
    const onGraph = (lit || []).filter((c) => c.type !== REQUEST);
    const agrees = lit && want.size > 0 && onGraph.every((c) => (want.get(c.id) === 'error') === c.refused && (want.has(c.id) && want.get(c.id) !== 'error' && want.get(c.id) !== 'skipped') === c.ran)
      && [...want.keys()].every((id) => onGraph.some((c) => c.id === id));
    ok(agrees, 'called by someone signed in, the steps it ran are lit: each node the backend recorded wears "ran" ("refused" where it failed), and no other', { call: signedIn.status, said: signedInText.slice(0, 80), recorded: [...want], lit: lit && lit.filter((c) => c.ran || c.refused).map((c) => `${c.id}:${c.ran ? 'ran' : 'refused'}`) });
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

  // P125-MUDDY-NATIVEDIALOG: the host's frame has no allow-modals, so prompt() and confirm() answer nothing there. Studio
  // asks a name in its own field and a yes in its own card: both driven here as a person would, typing and pressing
  console.log('check: P125-MUDDY-NATIVEDIALOG Studio asks in its own controls inside the conversation');
  const onDisk = (rel) => { try { return JSON.parse(readFileSync(join(project, rel), 'utf8')); } catch { return null; } };
  const answer = async (name) => {
    const asked = await until(`!!${P}.querySelector('.ask [data-input=askname]')`, 5000);
    if (asked) await ev(`(() => { const i = ${P}.querySelector('.ask [data-input=askname]'); i.focus(); i.value = ${JSON.stringify(name)}; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    return asked;
  };
  const yes = async () => { const asked = await until(`!!${P}.querySelector('.sure [data-act=yes]')`, 5000); if (asked) await ev(`${P}.querySelector('.sure [data-act=yes]').click()`); return asked; };
  await click('[data-tab=data]'); await wait(300);
  await click('[data-sub=options]'); await wait(300);
  await click('#newoptset');
  const setAsked = await answer('Priorities');
  const setKey = 'components/Option sets/Priorities/';
  // P128-S6-OPTSETFLAKE: the set was made every time (the toast, the list, its page: read beside the ok below), and the
  // gate read the disk before Studio's save had landed. The disk is waited for, as the page is
  const onDiskSoon = async (test, ms = 8000) => { const t = Date.now(); let v = test(); while (!v && Date.now() - t < ms) { await wait(150); v = test(); } return v; };
  const setMade = await until(`!!${P}.querySelector('#optmain .bar button')`, 8000) && await onDiskSoon(() => onDisk(setKey + 'nodes.json')?.nodes?.some((n) => n.type === 'Static Data'));
  // P128-S6-OPTSETFLAKE: what the panel showed at that step, read beside the ok (the field still up? the toast? the set in the registry?)
  const optSeen = setMade ? undefined : await ev(`(() => ({ fieldUp: !!${P}.querySelector('.ask [data-input=askname]'), field: ${P}.querySelector('.ask [data-input=askname]')?.value ?? null, toast: ${P}.querySelector('.toast, #toast')?.textContent ?? null, list: ${P}.getElementById('optsets')?.innerText ?? null, main: ${P}.getElementById('optmain')?.innerText?.slice(0, 120) ?? null }))()`);
  ok(setAsked && setMade, 'New option set: Studio asks the name in its own field, and the set is a component on disk', { asked: setAsked, made: !!setMade, seen: optSeen, registry: Object.keys(onDisk('components/_registry.json')?.components ?? {}).filter((k) => k.startsWith('Option sets/')) });
  if (setMade) {
    await ev(`[...${P}.querySelectorAll('#optmain .bar button')].find((x) => x.textContent.includes('New attribute')).click()`);
    const attrAsked = await answer('rank'); await wait(700);
    const attrs = onDisk(setKey + 'component.json')?.metadata?.optionSet?.attributes?.map((a) => a.name);
    ok(attrAsked && attrs?.includes('rank'), 'New attribute: asked in the same field, written into the set', { asked: attrAsked, attrs });
    await ev(`[...${P}.querySelectorAll('#optmain .bar button')].find((x) => x.textContent.includes('Delete option set')).click()`);
    const delAsked = await yes(); await wait(700);
    ok(delAsked && !onDisk(setKey + 'nodes.json') && !onDisk('components/_registry.json')?.components?.['Option sets/Priorities'], 'Delete option set: asked in Studio\'s card, and the set is gone', { asked: delAsked });
  }
  await click('[data-sub=types]'); await wait(300);
  await click('#newtype');
  const typeAsked = await answer('Note');
  const typeMade = await until(`!!${P}.querySelector('#types .row[data-type="Note"]')`, 10000);
  const declaredNote = () => onDisk('nodegx.project.json')?.metadata?.dbCollections?.some((c) => c.name === 'Note');
  ok(typeAsked && typeMade && declaredNote(), 'New data type: asked in Studio\'s field, declared in the project', { asked: typeAsked, made: typeMade });
  if (typeMade) {
    await ev(`[...${P}.querySelectorAll('#datamain button')].find((x) => x.textContent.includes('Delete type')).click()`);
    const delAsked = await yes();
    const gone = await until(`!${P}.querySelector('#types .row[data-type="Note"]')`, 10000);
    ok(delAsked && gone && !declaredNote(), 'Delete type: asked in Studio\'s card, and the type is gone from the project', { asked: delAsked, gone });
  }

  // STU-082: the frame has no allow-downloads, so Export's <a download> saved nothing and the toast said "exported".
  // Inside a host Studio hands the file to the host (ui/download-file), and this host offers it
  console.log('check: STU-082 Export inside the conversation');
  await click('[data-sub=app]'); await wait(400);
  await click('#apptypes .row[data-type=Task]');
  await click('#appmain [data-act=export]'); await wait(300);
  await ev(`[...${P}.querySelectorAll('.menu .item')].find((x) => x.textContent.startsWith('As CSV')).click()`);
  const saved = await until(`(window.__downloads || []).length ? window.__downloads[0].contents[0].resource : false`, 8000);
  ok(saved && /Task-development\.csv$/.test(saved.uri) && saved.mimeType === 'text/csv' && saved.text.includes('Water the plants'), 'Export → As CSV hands the file to the host to save: its name, its type and the row in it', saved && { uri: saved.uri, mimeType: saved.mimeType, text: saved.text.slice(0, 120) });

  // STU-084: a part's card inside the conversation. The frame opens no window, so Get the editor goes to the host as a
  // link (ui/open-link); Ask the agent goes into the conversation as the person's message (ui/message), and into the project
  console.log('check: STU-084 a part Studio does not edit, inside the conversation');
  await click('[data-tab=design]'); await wait(600);
  await click('#logiclist .row[data-part]'); await wait(300);
  const partId = await ev(`${P}.querySelector('.partcard')?.dataset.part ?? null`);
  await click('.partcard [data-act=editor]');
  const linked = await until(`(window.__links || []).find((u) => u.includes('nodegx.io/start#download')) ?? false`, 6000);
  ok(partId && linked === 'https://nodegx.io/start#download', 'Get the editor, from a part\'s card in the frame, asks the host to open the download', { partId, linked });
  await click('#logiclist .row[data-part]'); await wait(300);
  await click('.partcard [data-act=ask]');
  const said = await until(`(window.__messages || []).length ? window.__messages[0] : false`, 6000);
  const asked = onDisk('.nodegx-questions.json')?.questions ?? [];
  ok(said?.role === 'user' && said.content?.[0]?.text?.includes("a part Studio doesn't edit") && asked.some((q) => q.node === partId), 'Ask the agent says the question into the conversation as the person, and writes it into the project', { role: said?.role, text: said?.content?.[0]?.text?.slice(0, 90), asked: asked.length });

  // P128 S5 (STU-083): Help inside the conversation, from the strip's ?: the canon's headings, and its links through the host
  console.log('check: STU-083 Help inside the conversation');
  const canonText = readFileSync(kit.canon, 'utf8');
  const wantHeads = [...canonText.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()).filter((x) => !['For the agent (the rules, not copy)', 'Waits on'].includes(x));
  await click('#striphelp');
  const help = await until(`(() => { const p = ${P}.getElementById('helppanel'); if (!p || p.hidden || !p.querySelector('section[data-heading]')) return false;
    return { heads: [...p.querySelectorAll('section[data-heading] > h2')].map((x) => x.textContent), links: [...p.querySelectorAll('.downloads button')].map((x) => x.dataset.url) }; })()`, 10000);
  ok(help && JSON.stringify(help.heads) === JSON.stringify(wantHeads), "the strip's ? opens Help in the frame: the canon's headings, read across origins from Studio's vendored copy", { want: wantHeads, got: help?.heads });
  await shot('stu-083-hosted-help');
  if (help) {
    await ev(`${P}.querySelector('#helppanel .downloads button[data-url="https://nodegx.io/start#download"]').click()`);
    const asked = await until(`(window.__links || []).filter((u) => u === 'https://nodegx.io/start#download').length >= 2 ? true : false`, 6000);
    ok(asked && help.links.includes('https://nodegx.io/your-own-editor') && help.links.includes('https://nodegx.io/start'), "Help's buttons are the canon's links, and one pressed in the frame asks the host to open it", help.links);
  }
  if (help) await click('#helppanel [data-act=close]');
  ok(/HOLD stops it\. Change a heading, a font, a button colour or a translation yourself\.$/.test(await ev(`${P}.getElementById('hoststate')?.textContent ?? ''`)), "the strip's line ends on what Studio is for, in the canon's words", await ev(`${P}.getElementById('hoststate')?.textContent ?? null`));

  // P128 S7 (STU-080): Preview ↗ beside Window ↗. The host is asked to open Studio's /app; that page, opened in a tab of
  // its own as the person's browser would, draws the app alone and follows a headline changed in Studio, without a reload
  console.log('check: STU-080 Preview, the app alone in a tab');
  await click('#previewbtn');
  const appUrl = await until(`(window.__links || []).find((u) => u.endsWith('/app')) ?? false`, 6000);
  ok(appUrl === studio + '/app', 'Preview ↗ in the strip asks the host to open Studio\'s /app', appUrl);
  if (appUrl) {
    const { targetId } = await b.send('Target.createTarget', { url: appUrl });
    tab = await attach({ port: chromePort, match: (t) => t.id === targetId });
    const T = `window.__preview?.preview?.frame?.contentDocument?.body?.innerText ?? ''`;
    const first = await tab.until(`document.documentElement.dataset.status === 'ok' && (${T}).includes('Sign in') ? Number(document.documentElement.dataset.draws) : false`, 45000);
    ok(first === 1, 'the /app tab draws the app alone, full window: the page a visitor lands on (Sign in)', first || await tab.evaluate(`({ status: document.documentElement.dataset.status, text: (${T}).slice(0, 120) })`));
    await tab.evaluate(`window.__sameDocument = 'yes'`);
    // the headline, changed in Studio inside the frame as a person changes it: clicked in the page, typed in its Text field
    await click('[data-tab=design]'); await wait(800);
    const titleId = await ev(`${P}.defaultView.__ob.store.readComponent('Pages/Sign in').files.nodes.nodes.find((n) => n.label === 'App name')?.id ?? null`);
    const at = await ev(`(() => { const d = ${P}, w = d.defaultView; const el = w.__ob.preview.elementsOf(${JSON.stringify(titleId)})[0]; if (!el) return null; const r = el.getBoundingClientRect(), o = d.getElementById('overlay').getBoundingClientRect(), f = document.getElementById('app').getBoundingClientRect(); return { x: Math.round(f.left + o.left + r.left + r.width / 2), y: Math.round(f.top + o.top + r.top + r.height / 2) }; })()`);
    if (at) await b.click(at.x, at.y);
    const field = await until(`(() => { const f = [...${P}.querySelectorAll('#right .field')].find((x) => x.querySelector('label')?.textContent === 'Text'); const i = f?.querySelector('input,textarea'); if (!i) return false; i.focus(); i.select(); return true; })()`, 8000);
    if (field) await b.type('Changed in Studio');
    const onDiskTitle = await onDiskSoon(() => onDisk('components/Pages/Sign in/nodes.json')?.nodes?.find((n) => n.id === titleId)?.parameters?.text === 'Changed in Studio');
    const followed = await tab.until(`(${T}).includes('Changed in Studio') ? { draws: Number(document.documentElement.dataset.draws), same: window.__sameDocument } : false`, 15000);
    ok(field && onDiskTitle && followed && followed.draws > 1 && followed.same === 'yes', 'the headline changed in Studio in the conversation changes in the /app tab, drawn again in the same page, no reload', { at, field, onDisk: onDiskTitle, followed, seen: field ? undefined : await ev(`({ head: ${P}.querySelector('#right .head input')?.value ?? null, fields: [...${P}.querySelectorAll('#right .field label')].map((l) => l.textContent).slice(0, 8), side: ${P}.documentElement.dataset.side ?? null, page: ${P}.getElementById('pagepick')?.value, hit: (() => { const e = document.elementFromPoint(${at?.x ?? 0}, ${at?.y ?? 0}); return e ? e.tagName + '#' + e.id : null; })() })`) });
    await shot('stu-080-preview');
  }
} catch (e) {
  ok(false, 'the gate ran to the end', e.message);
} finally {
  if (tab) await tab.close().catch(() => {});
  if (b) await b.close().catch(() => {});
  if (host) host.close();
  for (const c of children) c.kill('SIGTERM');
  await wait(1500); // the server stops the backends it started on SIGTERM
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${results.length - passed} of ${results.length}`);
process.exit(passed === results.length ? 0 : 1);
