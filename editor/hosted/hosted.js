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
// Every stream the page opens is kept, so a panel that goes quiet can close them (P125-PUPPY2-THREEPANELS), and
// Studio's own /api/events is where this bridge hears the hold and which panel is live: one stream per panel, not two.
const streams = new Set();
window.EventSource = function (url, init) {
  const es = new NativeEventSource(abs(url), init);
  streams.add(es);
  if (String(url).includes('/api/events')) es.addEventListener('message', (ev) => onStudioEvent(ev.data));
  return es;
};
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
    #hoststrip .state.lifted { color: #a6f4c5; }
    html[data-hosted="inline"] #hoststrip .state.lifted { display: block; flex: 1 1 auto; }
    /* P125-PUPPY2-THREEPANELS: a quiet panel is its strip and nothing else — no app, no connection, 45 px. */
    #wakebtn { display: none; }
    html[data-quiet] body { display: none !important; }
    html[data-quiet] #hoststrip > :not(.name):not(.state):not(#wakebtn) { display: none !important; }
    html[data-quiet] #hoststrip .state { display: block !important; flex: 1 1 auto; color: #9aa7b8; }
    html[data-quiet] #wakebtn { display: inline-block; }
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
    #propsclose { display: none; }
    html[data-hosted="inline"][data-side="props"] #design { position: relative; }
    html[data-hosted="inline"][data-side="props"] #propsclose {
      display: block; position: absolute; top: 8px; right: 320px; z-index: 30; width: 22px; height: 44px; padding: 0;
      border-radius: 8px 0 0 8px; border: 1px solid var(--line, #3b3a37); border-right: 0; background: var(--panel, #262624);
      color: inherit; font-size: 16px; line-height: 1; cursor: pointer;
    }
    /* the header's controls are not hidden inline: what has no room goes into Studio's own "⋯" (P123-STU-TOPBAROVERFLOW) */
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
  <button id="wakebtn" title="Studio is live in the newest answer; this brings it back to this one">Bring it back here</button>
  <button id="windowbtn" title="Studio in its own window: the desktop app if it is installed, otherwise your browser" ${hosted ? '' : 'hidden'}>Window ↗</button>
`;
document.documentElement.insertBefore(strip, document.body ?? null);
if (!document.body) document.addEventListener('DOMContentLoaded', () => document.documentElement.insertBefore(strip, document.body), { once: true });

const $ = (id) => strip.querySelector('#' + id);
const stateEl = $('hoststate');
const holdBtn = $('holdbtn');
const noteEl = $('holdnote');

let app = null;
const say = (text, held = false, lifted = false) => {
  stateEl.textContent = text; stateEl.classList.toggle('held', held); stateEl.classList.toggle('lifted', lifted);
};

/* P125-PUPPY2-THREEPANELS — one live panel. A host keeps every panel an open_studio call drew, and each live one holds
   a connection to Studio: three held all six of the browser's connections to that origin and every panel's app stopped
   loading (and HOLD's own request queued). Each call's result names its panel (`panelId`, `issuedAt`); the newest is
   live, and the others go quiet: their streams closed, the app's frame gone, the strip alone with "Bring it back here".
   A panel that is not the newest when it mounts (a conversation reopened, a host remounting an old answer) never
   starts Studio at all. A host that sends no result: the panel names itself, as of when it mounted. */
let quiet = null; // null, 'fresh' (Studio never started here) or 'booted'
let releaseStudio = null; // resolves __studioReady for a fresh quiet panel the person brings back
let me = null;
let resolveMe;
const identity = new Promise((resolve) => { resolveMe = resolve; });
setTimeout(() => resolveMe({ id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, seq: Date.now() }), 2500);
function takeResult(result) {
  for (const c of result?.content ?? []) {
    if (c?.type !== 'text') continue;
    try { const d = JSON.parse(c.text); if (d?.panelId) return resolveMe({ id: d.panelId, seq: Number(d.issuedAt) || 0 }); } catch { /* not JSON */ }
  }
}
async function claim(wake = false) {
  me = me ?? (await identity);
  try {
    const r = await fetch('/api/panel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...me, wake }) });
    if (!r.ok) return true; // a Studio without panels: every panel is live, as before
    return (await r.json()).you;
  } catch { return true; }
}
function goQuiet(how) {
  if (quiet) return;
  quiet = how;
  for (const es of streams) es.close();
  streams.clear();
  if (how === 'booted') { try { window.__ob?.preview?.dispose(); } catch { /* the frame goes with the page anyway */ } }
  document.documentElement.dataset.quiet = how;
  say('Studio is live in a newer answer below.');
  fitTo(document.documentElement.dataset.hosted === 'full' ? 'fullscreen' : 'inline');
  if (document.documentElement.dataset.hosted === 'full') app?.requestDisplayMode({ mode: 'inline' }).catch(() => {});
  // Ask the host to take this panel away. Not measured in Claude Desktop: if it ignores it, the strip stays.
  try { app?.requestTeardown?.(); } catch { /* the quiet strip is the fallback */ }
}
async function wake() {
  await claim(true);
  if (quiet === 'booted') { location.reload(); return; }
  quiet = null;
  delete document.documentElement.dataset.quiet;
  fitTo('inline');
  readHold().then(drawHold);
  releaseStudio?.();
}
function onStudioEvent(data) {
  let d; try { d = JSON.parse(data); } catch { return; }
  if (d.hold) drawHold(d.hold);
  if (d.panel && me && d.panel.live !== me.id) goQuiet('booted');
}

// Studio's own module awaits this (the /panel rewrite puts `await window.__studioReady` at its top): served through
// NodeGX's proxy, the origin answers 503 until the agent's open_studio has started Studio, and a page that asked
// for the project then would draw nothing. Polled on /api/hold, the smallest answer there is; direct from Studio
// it resolves on the first try.
window.__studioReady = (async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch('/api/hold');
      if (r.ok) {
        if (!hosted || (await claim())) return;
        goQuiet('fresh');
        return new Promise((resolve) => { releaseStudio = resolve; });
      }
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
  if (quiet) return;
  if (h.held) {
    holdBtn.textContent = 'Release';
    holdBtn.className = 'release';
    say(`HELD since ${new Date(h.at).toLocaleTimeString()} — the agent cannot write${h.note ? `: “${h.note}”` : ''}`, true);
  } else {
    holdBtn.textContent = 'HOLD';
    holdBtn.className = 'hold';
    // shown while it is news (a quarter of an hour), then the strip says what it always says
    if (h.lifted?.by === 'agent' && Date.now() - Date.parse(h.lifted.at) < 15 * 60_000) say(`The agent lifted your hold at ${new Date(h.lifted.at).toLocaleTimeString()}, because you asked${h.lifted.words ? `: “${h.lifted.words}”` : ''}`, false, true);
    else say(hosted && app ? 'in the conversation — the agent writes, you watch; HOLD stops it' : stateEl.textContent);
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

$('wakebtn').addEventListener('click', () => { wake(); });
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

// The backend map is a page of its own that Data frames (#mapframe, src /backend-map/). The host lets this page fetch
// from Studio's origin but names no frame origin for it (Claude restricts `frameDomains`), so a frame that loads a URL
// stays blank. P127 BKO-002: the map is drawn the way the app preview is, into a frame with no src, written from
// Studio's /backend-map/ with a <base> there. Such a frame is this page's own origin, so the host's frame rule never
// applies, and the map's own requests (its script, api/map, the runs feed) go to Studio, which answers them with CORS.
// Studio's renderMap sets `src`; here that setter draws instead. Each new focus (#t:<type>, read once when the map
// starts) is a fresh frame, so the old map's timers go with it. The card that opens it in a window is what is left
// when the drawing fails, with the reason. The timeline's screen is a srcdoc frame and stays.
if (hosted) {
  let drawn = null;
  const card = (why) => {
    const box = document.getElementById('data-map');
    if (!box) return;
    box.querySelector('.hostedmap')?.remove();
    const el = document.createElement('div');
    el.className = 'hostedmap';
    el.innerHTML = '<p>The backend map could not be drawn here, so it opens in its own window: who can reach which rows, run as each person.</p><p class="why"></p><button type="button">Open the map ↗</button>';
    el.querySelector('.why').textContent = why;
    el.querySelector('button').addEventListener('click', async () => {
      try { await app?.openLink({ url: ORIGIN + '/backend-map/' }); } catch (e) { say(`could not open the map: ${e.message}`); }
    });
    box.append(el);
    document.getElementById('mapframe')?.setAttribute('data-failed', '');
  };
  const take = (frame) => {
    Object.defineProperty(frame, 'src', { configurable: true, get: () => drawn ?? '', set: (want) => { drawMap(frame, String(want)); } });
  };
  async function drawMap(old, want) {
    if (want === drawn) return;
    drawn = want;
    try {
      const r = await nativeFetch(ORIGIN + '/backend-map/');
      if (!r.ok) throw new Error(`Studio answered ${r.status} for the map`);
      const hash = new URL(want, ORIGIN + '/').hash;
      const head = `<base href="${ORIGIN}/backend-map/">` + (hash ? `<script>history.replaceState(null, '', location.href.split('#')[0] + ${JSON.stringify(hash)})</script>` : ''); // not the bare hash: it would resolve against <base>, Studio's origin, and be refused
      const page = (await r.text()).replace(/<head[^>]*>/i, (tag) => tag + head);
      if (drawn !== want) return; // a newer focus came in while this one was fetched
      const frame = document.createElement('iframe');
      frame.id = old.id;
      frame.title = old.title;
      take(frame);
      old.replaceWith(frame);
      document.querySelector('#data-map .hostedmap')?.remove();
      const doc = frame.contentDocument;
      doc.open();
      doc.write(page.includes('<base ') ? page : head + page);
      doc.close();
    } catch (e) {
      drawn = null;
      card(e.message);
    }
  }
  const style = document.createElement('style');
  style.textContent = `#data-map #mapframe[data-failed] { display: none; }
    #data-map .hostedmap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; padding: 24px; text-align: center; }
    #data-map .hostedmap .why { opacity: .7; font-size: 12px; }
    #data-map .hostedmap button { font: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer; }`;
  document.documentElement.append(style);
  const start = () => { const f = document.getElementById('mapframe'); if (f) take(f); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}

// Studio lays itself out to the viewport. Inline in a conversation the host sizes the frame from what the page
// reports, and the SDK's own measure reads Studio's max-content (303 px in the fake host: the empty stage), so the
// page names its height itself: 640 inline, and in full screen the host's viewport.
const INLINE_HEIGHT = 640;
const QUIET_HEIGHT = 45;
function fitTo(mode) {
  const inline = mode !== 'fullscreen';
  const height = quiet ? QUIET_HEIGHT : INLINE_HEIGHT;
  document.documentElement.style.height = inline ? `${height}px` : '';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.dataset.hosted = inline ? 'inline' : 'full';
  if (app && inline) app.sendSizeChanged({ width: Math.ceil(window.innerWidth), height }).catch(() => {});
}

// The side panels, inline: one at a time, on the strip's buttons. The properties panel comes up by itself when a
// DIFFERENT element is picked, and goes when the pick is cleared; the strip's Properties (or Hide properties) and the
// tab on the panel's edge put it away, and it stays away until the next pick.
// 🔴 P125-STU-PROPSPIN (Richard's Muddy Paws run, 2026-10-25: "we should be able to hide the props panel once finished
// editing"): it used to open on any redraw of #right while something was picked, and Studio redraws #right after
// every edit and every refresh, so closing it never held and the page stayed squeezed to a phone's width.
const sideButtons = { elements: $('elemsbtn'), props: $('propsbtn') };
function showSide(which) {
  const root = document.documentElement;
  if (which) root.dataset.side = which; else delete root.dataset.side;
  for (const [k, b] of Object.entries(sideButtons)) b.setAttribute('aria-pressed', String(k === which));
  sideButtons.props.textContent = which === 'props' ? 'Hide properties' : 'Properties';
}
sideButtons.elements.addEventListener('click', () => showSide(document.documentElement.dataset.side === 'elements' ? null : 'elements'));
sideButtons.props.addEventListener('click', () => showSide(document.documentElement.dataset.side === 'props' ? null : 'props'));
let lastPick = null;
document.addEventListener('studio:select', (e) => {
  const id = e.detail?.id ?? null;
  const fresh = id !== lastPick;
  lastPick = id;
  if (document.documentElement.dataset.hosted !== 'inline') return;
  if (id && fresh && document.documentElement.dataset.side !== 'props') showSide('props');
  else if (!id && document.documentElement.dataset.side === 'props') showSide(null);
});
document.addEventListener('DOMContentLoaded', () => {
  const right = document.getElementById('right');
  if (!right) return;
  // The panel's own way out, inline: a tab on its left edge (outside #right, which Studio empties on every redraw).
  const close = document.createElement('button');
  close.id = 'propsclose';
  close.type = 'button';
  close.title = 'Hide the properties';
  close.setAttribute('aria-label', 'Hide the properties');
  close.textContent = '›';
  close.addEventListener('click', () => showSide(null));
  right.parentElement.append(close);
}, { once: true });

// 2. The handshake.
if (hosted) {
  app = new App({ name: 'NodeGX Studio', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen', 'pip'] }, { autoResize: false });
  app.onhostcontextchanged = (ctx) => { if (ctx.displayMode) fitTo(ctx.displayMode); };
  // open_studio's result is for the model; the page reads only which panel this is (its panelId)
  app.ontoolresult = (result) => takeResult(result);
  fitTo('inline');
  app.connect().then(
    () => {
      const ctx = app.getHostContext() ?? {};
      fitTo(ctx.displayMode ?? 'inline');
      const modes = ctx.availableDisplayModes ?? [];
      if (modes.includes('pip')) $('dockbtn').hidden = false;
      strip.title = `Host: ${app.getHostVersion()?.name ?? ctx.userAgent ?? '?'} · display modes it offers: ${modes.join(', ') || 'not stated'} · now: ${ctx.displayMode ?? '?'}`;
      say(`in the conversation (${ctx.hostInfo?.name ?? ctx.userAgent ?? 'host'}) — the agent writes, you watch; HOLD stops it`);
      if (!quiet) readHold().then(drawHold);
    },
    (e) => { app = null; say(`not connected to the conversation (${e.message}); HOLD still works through the file`); readHold().then(drawHold); }
  );
} else {
  readHold().then(drawHold);
}

// The project's hold can change from elsewhere (the agent's release_hold, a second Studio): heard on Studio's own
// /api/events stream (onStudioEvent above). This bridge used to open a second stream for it; one per panel is enough.
