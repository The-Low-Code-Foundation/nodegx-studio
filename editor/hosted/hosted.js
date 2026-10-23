/**
 * Studio inside a conversation (STU-070, 2026-10-23).
 *
 * `GET /panel` serves studio.html with this module in its head, for a host that renders MCP Apps (Claude Desktop):
 * the page then runs at the host's sandbox origin, not Studio's, so three things are done here that the page itself
 * never has to think about:
 *
 *   1. every root-relative request the page makes (`fetch('/api/…')`, `new EventSource('/api/events')`, XHR) is sent
 *      to Studio's own origin, `window.__STUDIO_ORIGIN`, which serve.mjs set before this module ran;
 *   2. the MCP Apps handshake (`App.connect`), so the host knows the page is alive and sizes it; and
 *   3. the person's controls over the agent, in a strip above Studio's own header: HOLD (nothing is written to the
 *      project until they release it — the MCP server refuses every write while `.nodegx-hold.json` is in the
 *      folder), Release, Full screen, and Open in a window (the same Studio in the browser, beside the conversation).
 *
 * Outside a host (the URL opened in a browser) `window.parent === window`; the handshake is skipped, the strip
 * says so, and the page is the ordinary Studio at a different path.
 *
 * The bridge is `mcp-app.js`, the MCP Apps SDK's browser bundle (@modelcontextprotocol/ext-apps 1.7.5, Apache 2.0,
 * MCP-APPS-LICENSE beside it), copied rather than installed: Studio vendors what it does not publish.
 */
import { App } from './mcp-app.js';

const ORIGIN = window.__STUDIO_ORIGIN ?? location.origin;
const hosted = window.parent !== window;

// 1. Root-relative requests go to Studio. Absolute URLs and relative paths are left alone.
const abs = (u) =>
  typeof u !== 'string' ? u : u.startsWith('/') && !u.startsWith('//') ? ORIGIN + u : u.startsWith('./') ? ORIGIN + u.slice(1) : u;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => nativeFetch(typeof input === 'string' ? abs(input) : input instanceof URL ? input : input, init);
const NativeEventSource = window.EventSource;
window.EventSource = function (url, init) { return new NativeEventSource(abs(url), init); };
window.EventSource.prototype = NativeEventSource.prototype;
const nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) { return nativeOpen.call(this, method, abs(url), ...rest); };

// 3. The strip. Built before Studio's own script runs, so it is the first thing drawn.
const strip = document.createElement('div');
strip.id = 'hoststrip';
strip.innerHTML = `
  <style>
    /* Fixed, not in the flow: Studio scrolls the root element when it focuses or reveals something, and a strip in
       the flow above <body> went to y = -45 with it (measured). The body is pushed down by the strip's height. */
    #hoststrip { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #0b0e12; color: #c4cedb;
      font: 13px/1.3 Inter, system-ui, sans-serif; border-bottom: 1px solid #232a33; position: fixed; top: 0; left: 0;
      right: 0; height: 45px; box-sizing: border-box; z-index: 50; }
    html > body { margin-top: 45px !important; height: calc(100% - 45px) !important; }
    #hoststrip .name { font-weight: 600; color: #eef2f6; white-space: nowrap; }
    #hoststrip .grow { flex: 1; min-width: 0; }
    #hoststrip .state { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1 1 auto; }
    html[data-hosted="inline"] #hoststrip .state:not(.held) { display: none; }
    html[data-hosted="inline"] #hoststrip .grow { display: none; }
    html[data-hosted="inline"] #hoststrip .state.held { flex: 1 1 auto; }
    #hoststrip button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #2a3340; background: #141a22;
      color: #eef2f6; cursor: pointer; min-height: 32px; white-space: nowrap; }
    html[data-hosted="inline"] #hoststrip button { padding: 6px 9px; }
    #hoststrip button:hover { background: #1b2430; }
    #hoststrip button.hold { background: #b42318; border-color: #d92d20; font-weight: 700; letter-spacing: .02em; }
    #hoststrip button.hold:hover { background: #d92d20; }
    #hoststrip button.release { background: #1570ef; border-color: #2f8aff; font-weight: 600; }
    #hoststrip .state { color: #9aa7b8; }
    #hoststrip .state.held { color: #fda29b; font-weight: 600; }
    #hoststrip input { font: inherit; padding: 5px 8px; border-radius: 6px; border: 1px solid #2a3340; background: #0f141b;
      color: #eef2f6; width: 220px; }
    #hoststrip button.toggle[aria-pressed="true"] { background: #2a3340; border-color: #4da3ff; }
    html[data-hosted="inline"] #hoststrip input { width: 140px; }
    /* Inline in a conversation the panel is ~740 px wide: Studio's three columns (260 | stage | 360) leave the stage
       nothing. So inline is the stage, and the two side panels come on their own buttons; Full screen is Studio. */
    html[data-hosted="inline"] #design { grid-template-columns: minmax(0, 1fr); }
    html[data-hosted="inline"] #design > aside:not(.right), html[data-hosted="inline"] #right { display: none; }
    html[data-hosted="inline"][data-side="elements"] #design { grid-template-columns: 240px minmax(0, 1fr); }
    html[data-hosted="inline"][data-side="elements"] #design > aside:not(.right) { display: block; }
    html[data-hosted="inline"][data-side="props"] #design { grid-template-columns: minmax(0, 1fr) 320px; }
    html[data-hosted="inline"][data-side="props"] #right { display: block; }
    html[data-hosted="inline"] #widthseg, html[data-hosted="inline"] #recbtn, html[data-hosted="inline"] #reportpill,
    html[data-hosted="inline"] #agentpill { display: none; }
    html[data-hosted="inline"] header { padding: 0 8px; gap: 6px; }
    html[data-hosted="inline"] #stage { padding: 8px; }
    html[data-hosted="inline"] #appwrap { min-height: 0; height: calc(100% - 4px); width: 100%; }
  </style>
  <span class="name">NodeGX Studio</span>
  <span class="state" id="hoststate">${hosted ? 'connecting to the conversation…' : 'open in a browser; the agent is not told about holds from here'}</span>
  <span class="grow"></span>
  <input id="holdnote" placeholder="what you saw (optional)" title="A sentence the agent reads when it is refused">
  <button class="hold" id="holdbtn" title="Nothing is written to the project until you release it">HOLD</button>
  <button id="elemsbtn" class="toggle" title="The elements on this page and the palette" ${hosted ? '' : 'hidden'}>Elements</button>
  <button id="propsbtn" class="toggle" title="The selected element's properties" ${hosted ? '' : 'hidden'}>Properties</button>
  <button id="dockbtn" title="Studio docked beside the conversation (picture-in-picture), where it stays while the chat scrolls" hidden>Dock</button>
  <button id="fullbtn" title="Studio over the whole conversation" ${hosted ? '' : 'hidden'}>Full screen</button>
  <button id="windowbtn" title="Studio in its own window: the desktop app if it is installed, otherwise your browser" ${hosted ? '' : 'hidden'}>Window ↗</button>
`;
document.documentElement.insertBefore(strip, document.body ?? null);
if (!document.body) document.addEventListener('DOMContentLoaded', () => document.documentElement.insertBefore(strip, document.body), { once: true });

const $ = (id) => strip.querySelector('#' + id);
const stateEl = $('hoststate');
const holdBtn = $('holdbtn');
const noteEl = $('holdnote');

let app = null;
const say = (text, held = false) => { stateEl.textContent = text; stateEl.classList.toggle('held', held); };

// Studio's own module awaits this (the /panel rewrite puts `await window.__studioReady` at its top): served through
// NodeGX's proxy, the origin answers 503 until the agent's open_studio has started Studio, and a page that asked
// for the project then would draw nothing. Polled on /api/hold, the smallest answer there is; direct from Studio
// it resolves on the first try.
window.__studioReady = (async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch('/api/hold');
      if (r.ok) return;
    } catch { /* not up yet */ }
    say(i === 0 ? 'Studio is starting…' : `Studio is starting… (${i}s)`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  say('Studio did not start. Ask the agent to call open_studio.');
})();

// The model hears a hold the moment it happens, not on its next refused write. Best effort: a host without the
// capability, or a transport that is gone, changes nothing about the hold itself, which is the file.
async function tellTheModel(text) {
  if (!app) return;
  try { await app.updateModelContext({ content: [{ type: 'text', text }] }); } catch { /* the file is the hold */ }
}

async function readHold() {
  try { return await (await fetch('/api/hold')).json(); } catch { return { held: false }; }
}

function drawHold(h) {
  if (h.held) {
    holdBtn.textContent = 'Release';
    holdBtn.className = 'release';
    say(`HELD since ${new Date(h.at).toLocaleTimeString()} — the agent cannot write${h.note ? `: “${h.note}”` : ''}`, true);
  } else {
    holdBtn.textContent = 'HOLD';
    holdBtn.className = 'hold';
    say(hosted && app ? 'in the conversation — the agent writes, you watch; HOLD stops it' : stateEl.textContent);
  }
}

holdBtn.addEventListener('click', async () => {
  const current = await readHold();
  const held = !current.held;
  const note = noteEl.value.trim();
  const r = await fetch('/api/hold', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ held, note }) });
  const h = await r.json();
  drawHold(h);
  if (held) {
    await tellTheModel(`[Studio] The person pressed HOLD${note ? ` and wrote: "${note}"` : ''}. Every write to the project is refused until they release it. Stop building and ask them what they saw.`);
  } else {
    noteEl.value = '';
    await tellTheModel('[Studio] The person released the hold. Before writing again, re-read anything you were about to change: they may have edited it in Studio meanwhile.');
  }
});

$('fullbtn').addEventListener('click', async () => {
  if (!app) return;
  try { await app.requestDisplayMode({ mode: 'fullscreen' }); } catch (e) { say(`full screen refused: ${e.message}`); }
});
// Richard, run 6: "when you follow up with a new message, you have to scroll back up to the original output to see
// the editor … can it open in the artifact pane at the right side?" The spec's third mode, `pip`, is a docked panel
// that stays while the conversation scrolls. Whether this host offers it is in the hostContext it sends at the
// handshake: the button shows only then, and the modes are named in the strip's title so a person can read them.
$('dockbtn').addEventListener('click', async () => {
  if (!app) return;
  try { await app.requestDisplayMode({ mode: 'pip' }); } catch (e) { say(`dock refused: ${e.message}`); }
});
// P125 CCN-006 (Richard, 2026-10-23): the desktop app when this machine has it, so the window outlives the agent's
// host; the browser otherwise. NodeGX's proxy answers `/__nodegx/open-app` by launching the app on the project's
// folder ({ opened: false } when it is not installed). Studio serving the panel itself has no such path: a 404 here,
// and the browser.
$('windowbtn').addEventListener('click', async () => {
  if (!app) return;
  try {
    const r = await fetch('/__nodegx/open-app', { method: 'POST' });
    if (r.ok && (await r.json()).opened) { say('opened in NodeGX Studio, the desktop app'); return; }
  } catch { /* no proxy: the browser */ }
  try { await app.openLink({ url: ORIGIN + '/' }); } catch (e) { say(`could not open a window: ${e.message}`); }
});

// Studio lays itself out to the viewport. Inline in a conversation the host sizes the frame from what the page
// reports, and the SDK's own measure reads Studio's max-content (303 px in the fake host: the empty stage), so the
// page names its height itself: 640 inline, and in full screen the host's viewport.
const INLINE_HEIGHT = 640;
function fitTo(mode) {
  const inline = mode !== 'fullscreen';
  document.documentElement.style.height = inline ? `${INLINE_HEIGHT}px` : '';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.dataset.hosted = inline ? 'inline' : 'full';
  if (app && inline) app.sendSizeChanged({ width: Math.ceil(window.innerWidth), height: INLINE_HEIGHT }).catch(() => {});
}

// The side panels, inline: one at a time, on the strip's buttons; the properties panel comes up by itself when an
// element is picked (Studio fills #right then), and goes when the pick is cleared.
const sideButtons = { elements: $('elemsbtn'), props: $('propsbtn') };
function showSide(which) {
  const root = document.documentElement;
  if (which) root.dataset.side = which; else delete root.dataset.side;
  for (const [k, b] of Object.entries(sideButtons)) b.setAttribute('aria-pressed', String(k === which));
}
sideButtons.elements.addEventListener('click', () => showSide(document.documentElement.dataset.side === 'elements' ? null : 'elements'));
sideButtons.props.addEventListener('click', () => showSide(document.documentElement.dataset.side === 'props' ? null : 'props'));
document.addEventListener('DOMContentLoaded', () => {
  const right = document.getElementById('right');
  if (!right) return;
  new MutationObserver(() => {
    if (document.documentElement.dataset.hosted !== 'inline') return;
    const picked = !right.querySelector(':scope > .empty');
    if (picked && document.documentElement.dataset.side !== 'props') showSide('props');
    else if (!picked && document.documentElement.dataset.side === 'props') showSide(null);
  }).observe(right, { childList: true });
}, { once: true });

// 2. The handshake.
if (hosted) {
  app = new App({ name: 'NodeGX Studio', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen', 'pip'] }, { autoResize: false });
  app.onhostcontextchanged = (ctx) => { if (ctx.displayMode) fitTo(ctx.displayMode); };
  app.ontoolresult = () => { /* open_studio's result is for the model; the page reads the project itself */ };
  fitTo('inline');
  app.connect().then(
    () => {
      const ctx = app.getHostContext() ?? {};
      fitTo(ctx.displayMode ?? 'inline');
      const modes = ctx.availableDisplayModes ?? [];
      if (modes.includes('pip')) $('dockbtn').hidden = false;
      strip.title = `Host: ${app.getHostVersion()?.name ?? ctx.userAgent ?? '?'} · display modes it offers: ${modes.join(', ') || 'not stated'} · now: ${ctx.displayMode ?? '?'}`;
      say(`in the conversation (${ctx.hostInfo?.name ?? ctx.userAgent ?? 'host'}) — the agent writes, you watch; HOLD stops it`);
      readHold().then(drawHold);
    },
    (e) => { app = null; say(`not connected to the conversation (${e.message}); HOLD still works through the file`); readHold().then(drawHold); }
  );
} else {
  readHold().then(drawHold);
}

// The project's hold can change from elsewhere (a `rm .nodegx-hold.json`, a second Studio): follow the events.
try {
  const es = new EventSource('/api/events?client=hosted-' + Math.random().toString(36).slice(2));
  es.addEventListener('message', (ev) => {
    try { const d = JSON.parse(ev.data); if (d.hold) drawHold(d.hold); } catch { /* not ours */ }
  });
} catch { /* no events, no follow */ }
