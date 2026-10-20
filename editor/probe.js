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

  /*
   * The screen (STU-031): every change to the app's document from the frame's first moment, so a recording of the
   * page opening has its drawing from 0 ms. Elements added or taken away and text changed, never styles (an animation
   * would fill the log). Kept as the changed element itself, so Studio can say which page element it belongs to; the
   * last few thousand only.
   *
   *   window.__studioScreen = [{ t, el, added, removed, text }]
   */
  var screen = (window.__studioScreen = []);

  /*
   * The screen as it was (STU-032): when the screen is next painted after a change, the page's body as HTML, with
   * what the fields hold (a typed value is a property, not in the HTML) and the frame's size, so the timeline's
   * scrubber can show it again. A copy, not a picture: Chrome will not let a page turn its own HTML into pixels (a
   * canvas that draws it through SVG is tainted), and drawn again with the page's styles a copy is the page as it
   * was, minus a canvas's pixels and where things were scrolled. Taken at the next frame, the moment the browser
   * paints, not inside the observer: what a frame shows is what was on the screen (a list inserted holding "Text" that
   * gets its values two frames later was on screen holding "Text", and its copy says so). A hidden window paints no
   * frames, so a timer stands in. Each copy carries the time its change began.
   * Without the page's scripts and its "enable JavaScript" notice: on the todo template those are 836 KB of an 851 KB
   * body, the app's own drawing 14 KB. Typing changes no element, so a field's input takes one too, at once. The
   * newest only, up to a budget of characters.
   *
   *   window.__studioShots = [{ t, html, w, h, values }]   window.__studioShotCost = { n, chars, ms, dropped }
   */
  var shots = (window.__studioShots = []);
  var cost = (window.__studioShotCost = { n: 0, chars: 0, ms: 0, dropped: 0 });
  var BUDGET = 40e6, held = 0, lastHtml = null;
  // a batch's copy carries the batch's own millisecond, so the screen row and the copy it shows have the same time
  var shoot = function (at) {
    if (!document.body) return;
    var s = typeof at === 'number' ? at : performance.now(), started = performance.now(), html = copyOf(document.body), fields = document.body.querySelectorAll('input, textarea, select'), values = [];
    for (var i = 0; i < fields.length; i++) values.push(fields[i].type === 'checkbox' || fields[i].type === 'radio' ? fields[i].checked : fields[i].value);
    var v = JSON.stringify(values);
    var last = shots[shots.length - 1];
    if (last && html === lastHtml && v === last.v) { cost.ms += performance.now() - started; return; }
    // the same HTML as the last one is kept once: a shot that only changes a field's value points at it
    shots.push({ t: s, html: html === lastHtml ? last.html : html, w: innerWidth, h: innerHeight, values: values, v: v });
    if (html !== lastHtml) { held += html.length; cost.chars += html.length; }
    lastHtml = html;
    cost.n++; cost.ms += performance.now() - started;
    while (held > BUDGET && shots.length > 1) { var gone = shots.shift(); if (gone.html !== shots[0].html) held -= gone.html.length; cost.dropped++; }
  };
  var copyOf = function (body) {
    var shell = body.cloneNode(false).outerHTML, parts = '';
    for (var c = body.firstElementChild; c; c = c.nextElementSibling) if (!/^(SCRIPT|NOSCRIPT)$/.test(c.tagName)) parts += c.outerHTML;
    return shell.slice(0, shell.lastIndexOf('</body>')) + parts + '</body>';
  };
  var pending = null;
  var take = function () { if (!pending) return; var t = pending.t; cancelAnimationFrame(pending.frame); clearTimeout(pending.timer); pending = null; shoot(t); };
  var soon = function (t) { if (!pending) pending = { t: t, frame: requestAnimationFrame(take), timer: setTimeout(take, 100) }; };
  // a copy waiting for its frame is taken first, so the copies stay in time order
  var typed = function () { take(); shoot(); };
  addEventListener('input', typed, true);
  addEventListener('change', typed, true);
  // the deploy page's own scripts, styles and "enable JavaScript" notice are written into the frame too: not drawing
  var unseen = /^(SCRIPT|STYLE|NOSCRIPT|LINK|META|TEMPLATE)$/;
  var seen = function (node) { return !(node.nodeType === 1 && unseen.test(node.tagName)); };
  var words = function (nodes) { var s = ''; for (var i = 0; i < nodes.length && s.length < 80; i++) if (seen(nodes[i])) s += ' ' + (nodes[i].textContent || ''); return s.replace(/\s+/g, ' ').trim().slice(0, 80); };
  var elements = function (nodes) { var n = 0; for (var i = 0; i < nodes.length; i++) if (nodes[i].nodeType === 1 && seen(nodes[i])) n++; return n; };
  new MutationObserver(function (list) {
    var t = performance.now();
    for (var i = 0; i < list.length; i++) {
      var m = list[i], el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      // the parser building the page (body into html, the page's skeleton into body) is not the app drawing
      if (!el || el === document.documentElement || (el === document.body && document.readyState === 'loading') || (el.closest && el.closest('head')) || !seen(el)) continue;
      if (m.type === 'characterData') screen.push({ t: t, el: el, added: 0, removed: 0, text: String(m.target.data).trim().slice(0, 80) });
      else {
        var added = elements(m.addedNodes), removed = elements(m.removedNodes), text = words(m.addedNodes);
        if (added || removed || text) screen.push({ t: t, el: el, added: added, removed: removed, text: text });
      }
    }
    if (screen.length > 6000) screen.splice(0, 1000);
    if (document.readyState !== 'loading') soon(t);
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();
