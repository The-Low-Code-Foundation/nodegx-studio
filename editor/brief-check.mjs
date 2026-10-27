/**
 * NodeGX Studio — P127 BKO-006 "it is drawn": any app an agent built, drawn in Studio inside a conversation.
 *
 * hosted-check grades Studio on a template; this grades it on an app nobody templated. A copy of the app's folder,
 * unbound from its backend, gets a backend from Studio's own "Start a backend" (so what is drawn is what the project's
 * files carry, R1), and the panel is drawn by a host of the gate's own at a foreign origin with the host's CSP, as
 * hosted-check does. For every table, function, trigger and workflow the app has:
 *
 *   1. Privacy lists the table and says who can reach it
 *   2. the map draws, and has a block for the table
 *   3. Workflow → On the backend lists each cloud function, and it opens as its graph
 *   4. the same list has each trigger and workflow, and each opens
 *   5. no word of the training app's reaches any of those screens (the app's own words excepted: a repair shop has staff)
 *
 *   node editor/brief-check.mjs <app folder> [--expect <json>] [--shots <dir>]
 *
 * `--expect` names what the app has when its files do not say it all, `{ "tables": [...] }` (the grader reads them off
 * the backend the agent built); otherwise the tables are the project's declared ones and its rules file's. Exit 0 and
 * PASS n/n, or the failing lines and exit 1.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { cspFor, hostPage } from './hosted-host.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const source = argv[0] && !argv[0].startsWith('--') ? resolve(argv[0]) : null;
if (!source || !existsSync(join(source, 'nodegx.project.json'))) { console.error('usage: brief-check.mjs <app folder> [--expect <json>] [--shots <dir>]'); process.exit(2); }
const shotsDir = opt('--shots') ? resolve(opt('--shots')) : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const expect = opt('--expect') ? JSON.parse(readFileSync(resolve(opt('--expect')), 'utf8')) : {};

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-brief-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // nothing is written to ~/.noodl
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined && !cond ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };

const project = join(tmp, basename(source));
cpSync(source, project, { recursive: true, filter: (p) => !/[/\\](node_modules|\.git)$/.test(p) });
const pjPath = join(project, 'nodegx.project.json');
{ const pj = JSON.parse(readFileSync(pjPath, 'utf8')); delete pj.metadata?.cloudservices; writeFileSync(pjPath, JSON.stringify(pj, null, 2)); }
const readJson = (f) => { try { return JSON.parse(readFileSync(join(project, f), 'utf8')); } catch { return null; } };

// what the app has, from its files (and --expect)
const declared = (readJson('nodegx.project.json').metadata?.dbCollections ?? []).map((c) => c.name);
const ruled = Object.keys(readJson('nodegx.security.json')?.collections ?? {}).filter((n) => !n.startsWith('_'));
const tables = [...new Set([...(expect.tables ?? []), ...declared, ...ruled])].filter((n) => !n.startsWith('_'));
const autos = readJson('nodegx.automations.json') ?? { triggers: [], workflows: [] };
const functions = [];
const walk = (d, rel) => { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const p = join(d, e.name); if (existsSync(join(p, 'component.json'))) functions.push(join(rel, e.name)); walk(p, join(rel, e.name)); } };
if (existsSync(join(project, 'components', '__cloud__'))) walk(join(project, 'components', '__cloud__'), '__cloud__');
// the training app's words; a word the app's own files use is the app's, not the training app's
const componentText = [];
const walkText = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walkText(p); else if (e.name.endsWith('.json')) componentText.push(readFileSync(p, 'utf8')); } };
if (existsSync(join(project, 'components'))) walkText(join(project, 'components'));
const ownText = ['nodegx.project.json', 'nodegx.security.json', 'nodegx.automations.json'].map((f) => JSON.stringify(readJson(f) ?? '')).join(' ') + ' ' + tables.join(' ') + ' ' + componentText.join(' ');
const trainingWords = ['learner', 'learners', 'staff', 'training', 'course', 'courses', 'concept', 'concepts', 'cohort', 'cohorts', 'programme', 'programmes', 'LearnerProfile']
  .filter((w) => !new RegExp(`\\b${w}\\b`, 'i').test(ownText));
const TRAINING = new RegExp(`\\b(${trainingWords.join('|')})\\b`, 'gi');
console.log(`check: ${basename(source)} — ${tables.length} tables (${tables.join(', ')}), ${functions.length} functions, ${autos.triggers?.length ?? 0} triggers, ${autos.workflows?.length ?? 0} workflows`);
const seen = [];

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
  ok(made.phase === 'running', 'Start a backend: the copy gets a backend of its own, from its files', made);

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
  const click = async (sel, ms = 15000) => {
    if (!(await until(`!!${P}.querySelector(${JSON.stringify(sel)})`, ms))) throw new Error(`nothing to click: ${sel}`);
    await ev(`${P}.querySelector(${JSON.stringify(sel)}).click()`);
  };
  const look = async (where) => { seen.push({ where, text: await ev(`${P}.body.innerText`) }); };
  const shot = async (name) => { if (shotsDir) { await wait(600); await b.screenshot(join(shotsDir, `${name}.png`)); } };
  ok(await until(`(${P}?.title || '').startsWith('ready')`, 90000), 'the panel comes up inside the host', await ev(`${P}?.title`));

  console.log('check: Privacy');
  await click('[data-tab=data]'); await wait(400);
  await click('[data-sub=privacy]');
  await until(`${P}.querySelectorAll('#privtypes .row').length > 0`, 15000);
  const listed = await ev(`[...${P}.querySelectorAll('#privtypes .row')].map((r) => r.dataset.type)`);
  for (const t of tables) {
    const has = listed.includes(t);
    ok(has, `Privacy lists ${t}`, listed);
    if (!has) continue;
    await click(`#privtypes .row[data-type="${t}"]`);
    const said = await until(`${P}.querySelector('#privmain select[data-rule=read]') && ${P}.querySelector('#privmain').innerText`, 15000);
    ok(said && said.includes(t), `${t} says who can reach it, with the rule to change`, String(said).slice(0, 160));
    await look(`Privacy ${t}`);
  }
  await shot('privacy');

  console.log('check: the map');
  await click('[data-sub=map]'); await wait(400);
  const F = `${P}.getElementById('mapframe')`;
  const opened = await until(`(() => { const d = ${F}?.contentDocument; const l = d?.getElementById('backendLine')?.textContent || ''; return d?.getElementById('map') && l && !/^Opening the backend/.test(l) ? l : false; })()`, 20000);
  ok(opened, 'the map draws inside the conversation', opened || await ev(`${F}?.contentDocument?.body?.innerText?.slice(0, 200) ?? null`));
  if (opened) {
    await wait(1500);
    const words = await ev(`${F}.contentWindow.__canvasWords?.() ?? []`);
    seen.push({ where: 'the map', text: [await ev(`${F}.contentDocument.body.innerText`), ...words].join('\n') });
    const ids = await ev(`Object.keys(${F}.contentWindow.__map?.byId ?? {})`);
    for (const t of tables) ok(ids.includes(`t:${t}`), `the map has a block for ${t}`, ids.filter((i) => i.startsWith('t:')));
  }
  await shot('map');

  console.log('check: functions, triggers, workflows');
  await click('[data-tab=workflow]'); await wait(400);
  const fnRows = await ev(`[...${P}.querySelectorAll('#fnlist .row')].map((r) => r.dataset.fn)`);
  for (const key of functions) {
    const has = fnRows.includes(key);
    ok(has, `On the backend lists ${key.slice('__cloud__/'.length)}`, fnRows);
    if (!has) continue;
    await click(`#fnlist .row[data-fn="${key}"]`);
    const fn = await until(`(() => { const v = ${P}.querySelector('#steps .fnview'); if (!v || v.dataset.fn !== ${JSON.stringify(key)} || /^Reading/.test(v.querySelector('.fnfacts .touches')?.textContent ?? 'Reading')) return false;
      return { cards: v.querySelectorAll('.fnflow .step').length, wires: v.querySelectorAll('svg.wires path[data-kind]').length, touches: v.querySelector('.fnfacts .touches').textContent }; })()`, 15000);
    ok(fn && fn.cards > 0 && !/could not be read/.test(fn.touches), `${key.slice('__cloud__/'.length)} opens as its graph, with what it reads and writes`, fn);
    await look(`function ${key}`);
    await shot(`function-${basename(key)}`);
  }
  const autoRows = await ev(`[...${P}.querySelectorAll('#autolist .row')].map((r) => r.dataset.trigger ? 't:' + r.dataset.trigger : 'w:' + r.dataset.workflow)`);
  for (const [kind, list] of [['trigger', autos.triggers ?? []], ['workflow', autos.workflows ?? []]]) {
    for (const a of list) {
      const has = autoRows.includes(`${kind[0]}:${a.id}`);
      ok(has, `On the backend lists the ${kind} ${a.name ?? a.id}`, autoRows);
      if (!has) continue;
      await click(`#autolist .row[data-${kind}="${a.id}"]`);
      const drawn = await until(`(() => { const v = ${P}.querySelector('#steps .autoview[data-${kind}="${a.id}"]'); return v && !/Reading/.test(v.innerText) ? v.querySelectorAll('.step').length : false; })()`, 15000);
      ok(drawn > 0, `the ${kind} ${a.name ?? a.id} opens, drawn`, drawn);
      await look(`${kind} ${a.id}`);
      await shot(`${kind}-${a.id}`);
    }
  }
  await look('Workflow');

  const hits = seen.flatMap(({ where, text }) => [...text.matchAll(TRAINING)].map((m) => `${m[0]} (${where}: “${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}”)`));
  ok(!hits.length, `no training word on any of the ${seen.length} screens`, hits.slice(0, 4));
} catch (e) {
  ok(false, 'the gate ran to the end', e.message);
} finally {
  if (b) await b.close().catch(() => {});
  if (host) host.close();
  for (const c of children) c.kill('SIGTERM');
  await wait(1500);
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${results.length - passed} of ${results.length}`);
process.exit(passed === results.length ? 0 : 1);
