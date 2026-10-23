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
const abs = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? ORIGIN + u : u);
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
    #hoststrip { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #0b0e12; color: #c4cedb;
      font: 13px/1.3 Inter, system-ui, sans-serif; border-bottom: 1px solid #232a33; position: relative; z-index: 50; }
    #hoststrip .name { font-weight: 600; color: #eef2f6; }
    #hoststrip .grow { flex: 1; }
    #hoststrip button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #2a3340; background: #141a22;
      color: #eef2f6; cursor: pointer; min-height: 32px; }
    #hoststrip button:hover { background: #1b2430; }
    #hoststrip button.hold { background: #b42318; border-color: #d92d20; font-weight: 700; letter-spacing: .02em; }
    #hoststrip button.hold:hover { background: #d92d20; }
    #hoststrip button.release { background: #1570ef; border-color: #2f8aff; font-weight: 600; }
    #hoststrip .state { color: #9aa7b8; }
    #hoststrip .state.held { color: #fda29b; font-weight: 600; }
    #hoststrip input { font: inherit; padding: 5px 8px; border-radius: 6px; border: 1px solid #2a3340; background: #0f141b;
      color: #eef2f6; width: 220px; }
  </style>
  <span class="name">NodeGX Studio</span>
  <span class="state" id="hoststate">${hosted ? 'connecting to the conversation…' : 'open in a browser; the agent is not told about holds from here'}</span>
  <span class="grow"></span>
  <input id="holdnote" placeholder="what you saw (optional)" title="A sentence the agent reads when it is refused">
  <button class="hold" id="holdbtn" title="Nothing is written to the project until you release it">HOLD</button>
  <button id="fullbtn" title="Studio over the whole conversation" ${hosted ? '' : 'hidden'}>Full screen</button>
  <button id="windowbtn" title="The same Studio in your browser, beside the conversation" ${hosted ? '' : 'hidden'}>Open in a window</button>
`;
document.documentElement.insertBefore(strip, document.body ?? null);
if (!document.body) document.addEventListener('DOMContentLoaded', () => document.documentElement.insertBefore(strip, document.body), { once: true });

const $ = (id) => strip.querySelector('#' + id);
const stateEl = $('hoststate');
const holdBtn = $('holdbtn');
const noteEl = $('holdnote');

let app = null;
const say = (text, held = false) => { stateEl.textContent = text; stateEl.classList.toggle('held', held); };

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
$('windowbtn').addEventListener('click', async () => {
  if (!app) return;
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
  if (app && inline) app.sendSizeChanged({ width: Math.ceil(window.innerWidth), height: INLINE_HEIGHT }).catch(() => {});
}

// 2. The handshake.
if (hosted) {
  app = new App({ name: 'NodeGX Studio', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: false });
  app.onhostcontextchanged = (ctx) => { if (ctx.displayMode) fitTo(ctx.displayMode); };
  app.ontoolresult = () => { /* open_studio's result is for the model; the page reads the project itself */ };
  fitTo('inline');
  app.connect().then(
    () => {
      const ctx = app.getHostContext() ?? {};
      fitTo(ctx.displayMode ?? 'inline');
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
