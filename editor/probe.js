/*
 * NodeGX Studio's probe in the app's frame (STU-011). serve.mjs puts it first in the runtime's index.html, so it runs
 * before the runtime does, in the frame only: the deployed app never has it. It writes down what the app asks the
 * backend and when the app moves to another page, so Studio can say how many queries a page runs on open and when
 * each page data item last ran — counted off the requests the app really made, never off the nodes that could make
 * them. Nothing here changes a request or its answer.
 *
 *   window.__studioLog = [{ kind: 'request', method, url, path, body, t0, t1, status, rows } | { kind: 'nav', path, t }]
 */
(function () {
  var log = (window.__studioLog = []);
  var here = function () { return location.pathname + location.hash; };
  var nav = function () { var p = here(); var last = null; for (var i = log.length - 1; i >= 0; i--) if (log[i].kind === 'nav') { last = log[i]; break; } if (!last || last.path !== p) log.push({ kind: 'nav', path: p, t: performance.now() }); };
  nav();
  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    history[name] = function () { var r = orig.apply(this, arguments); nav(); return r; };
  });
  addEventListener('popstate', nav);
  addEventListener('hashchange', nav);
  var open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__studio = { kind: 'request', method: String(method).toUpperCase(), url: String(url) }; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    var e = this.__studio;
    if (e) {
      try { e.path = new URL(e.url, location.href).pathname; } catch (_) { e.path = e.url; }
      try { e.body = typeof body === 'string' ? JSON.parse(body) : undefined; } catch (_) { e.body = undefined; }
      e.page = here();
      e.t0 = performance.now();
      log.push(e);
      var xhr = this;
      this.addEventListener('loadend', function () {
        e.t1 = performance.now();
        e.status = xhr.status;
        try { var r = JSON.parse(xhr.responseText); if (r && Array.isArray(r.results)) e.rows = r.results.length; } catch (_) { /* not JSON */ }
      });
    }
    return send.apply(this, arguments);
  };
})();
