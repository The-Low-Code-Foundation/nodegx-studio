/**
 * The fake MCP Apps host the hosted gates draw Studio's panel in (hosted-check, brief-check): its page, and the CSP a
 * host builds from the panel resource's `_meta.ui.csp`.
 */

/** The host's page: the panel in a sandboxed frame, and the few answers Studio's bridge waits for. */
export const hostPage = `<!doctype html><meta charset="utf-8"><title>host</title>
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
 * is the part the gates are about: any frame that has to load a URL stays blank under it.
 */
export const cspFor = (studio) => [
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
