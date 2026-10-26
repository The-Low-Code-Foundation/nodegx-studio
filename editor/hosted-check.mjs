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
 *
 *   node editor/hosted-check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node editor/hosted-check.mjs --shots    also writes ../docs/look/bko-002-*.png
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';

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

/** The host's page: the panel in a sandboxed frame, and the few answers Studio's bridge waits for. */
const hostPage = `<!doctype html><meta charset="utf-8"><title>host</title>
<style>body{margin:0}iframe{width:1400px;height:900px;border:0;display:block}</style>
<iframe id="app" src="/panel.html" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
<script>
const frame = document.getElementById('app');
window.__links = [];
window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (!m || m.jsonrpc !== '2.0' || m.id === undefined || !m.method) return;
  const reply = (result) => frame.contentWindow.postMessage({ jsonrpc: '2.0', id: m.id, result }, '*');
  if (m.method === 'ui/initialize') reply({ protocolVersion: m.params.protocolVersion, hostInfo: { name: 'gate-host', version: '0' }, hostCapabilities: { openLinks: {} },
    hostContext: { displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'], platform: 'desktop', theme: 'dark', containerDimensions: { maxHeight: 900 } } });
  else { if (m.method === 'ui/open-link') window.__links.push(m.params.url); reply({}); }
});
</script>`;

/**
 * The panel's CSP, as the MCP Apps host builds it from the resource's `_meta.ui.csp` (`openStudio.ts`
 * `studioResourceMeta`: connect, resource and base-uri domains are Studio's origin; no frame domains). `frame-src 'none'`
 * is the part this gate is about: any frame that has to load a URL stays blank under it.
 */
const cspFor = (studio) => [
  `default-src 'none'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: ${studio}`,
  `style-src 'self' 'unsafe-inline' blob: data: ${studio} https://fonts.googleapis.com`,
  `img-src 'self' data: blob: ${studio}`,
  `font-src 'self' data: blob: ${studio} https://fonts.gstatic.com`,
  `media-src 'self' data: blob: ${studio}`,
  `connect-src 'self' ${studio}`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri ${studio}`
].join('; ');

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
  const shot = async (name) => { if (shots) { await wait(600); await b.screenshot(join(here, '..', 'docs', 'look', `bko-002-${name}.png`)); } };

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
