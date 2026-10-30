// Design helpers: everything goes through Studio's own controls (palette, overlay click, tree, the property panel).
export function design(b, { ev, wait }) {
  const J = JSON.stringify;
  const shows = () => ev('__ob.shows || 0');
  const settle = async (n0) => { await b.until(`(__ob.shows || 0) > ${n0} && document.getElementById("status").textContent.startsWith("App on screen")`, 20000); await wait(250); };
  const nodes = () => ev(`(() => { const k = document.getElementById('pagepick').value; return __ob.store.readComponent(k).files.nodes.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, parent: n.parent, variant: n.variant })); })()`);
  const idOf = async (label) => { const all = await nodes(); let n = all.filter((x) => x.label === label); if (n.length > 1) n = n.filter((x) => x.parent || all.some((p) => (p.children || []).includes(x.id)) || ['Group', 'Page'].includes(x.type)); if (n.length !== 1) throw new Error(`${n.length} nodes labelled ${label}`); return n[0].id; };
  // a point inside the element's own padding, bottom-left, so the click lands on it and not on a child
  const insideOf = (id, centre = false) => ev(`(() => { if (${centre}) { const el = __ob.preview.elementsOf(${J(id)})[0]; if (!el) return null; const r = el.getBoundingClientRect(); const o = document.getElementById('overlay').getBoundingClientRect(); return { x: Math.round(o.left + r.left + r.width / 2), y: Math.round(o.top + r.top + r.height / 2) }; } const el = __ob.preview.elementsOf(${J(id)})[0]; if (!el) return null; const r = el.getBoundingClientRect(); const o = document.getElementById('overlay').getBoundingClientRect(); const cs = el.ownerDocument.defaultView.getComputedStyle(el); const pl = parseFloat(cs.paddingLeft) || 0, pb = parseFloat(cs.paddingBottom) || 0; return { x: Math.round(o.left + r.left + Math.max(2, Math.min(6, pl / 2))), y: Math.round(o.top + r.bottom - Math.max(2, Math.min(6, pb / 2))), h: r.height }; })()`);
  const api = {
    nodes, idOf, settle, shows,
    async page(key) { const n0 = await shows(); const cur = await ev(`document.getElementById('pagepick').value`); if (cur === key) return; await ev(`(() => { const s = document.getElementById('pagepick'); s.value = ${J(key)}; s.dispatchEvent(new Event('change')); })()`); await settle(n0).catch(() => {}); await wait(400); },
    async select(label) {
      await ev(`(() => { const s = document.getElementById('treesearch'); s.value = ${J(label)}; s.dispatchEvent(new Event('input')); })()`); await wait(200);
      const ok = await ev(`(() => { const r = [...document.querySelectorAll('#tree .row')].find((x) => [...x.querySelectorAll('span')].some((s) => !s.children.length && s.textContent.trim() === ${J(label)})); if (!r) return [...document.querySelectorAll('#tree .row')].map((x) => x.textContent.trim().slice(0, 30)).join(' | '); r.click(); return true; })()`);
      await ev(`(() => { const s = document.getElementById('treesearch'); s.value = ''; s.dispatchEvent(new Event('input')); })()`);
      if (ok !== true) throw new Error(`no tree row ${label}: ${ok}`);
      await wait(350);
      await ev(`[...document.querySelectorAll('#right .ptabs button')].find((x) => x.textContent.trim() === 'Visual' && x.getAttribute('aria-pressed') !== 'true')?.click()`); await wait(200);
    },
    // add a palette element into the container labelled `into`; name it `label`
    async add(paletteName, into, label) {
      if (label) { const all = await nodes(); const intoN = all.filter((n) => n.label === into); const have = all.find((n) => n.label === label && intoN.some((p) => p.id === n.parent)); if (have) { await api.select(label); return have.id; } }
      const before = new Set((await nodes()).map((n) => n.id));
      const intoId = await idOf(into);
      await ev(`[...document.querySelectorAll('#palette button, #components button')].find((x) => x.textContent.trim() === ${J(paletteName)}).click()`); await wait(150);
      const all0 = await nodes(); const empty = !all0.some((n) => n.parent === intoId);
      if (empty) { const par0 = all0.find((n) => n.id === all0.find((m) => m.id === intoId).parent); const par = all0.find((n) => n.id === par0?.parent && n.label && n.type !== 'Page') || par0; if (par?.label) { await api.select(par.label); } await ev(`[...document.querySelectorAll('#palette button, #components button')].find((x) => x.textContent.trim() === ${J(paletteName)}).click()`); await wait(150); }
      const at = await insideOf(intoId, empty); if (!at) throw new Error(`${into} is not on screen`);
      const n0 = await shows(); await b.click(at.x, at.y); await settle(n0);
      const made = (await nodes()).filter((n) => !before.has(n.id));
      const top = made.find((n) => !made.some((m) => m.id === n.parent)) || made[0];
      if (!top) throw new Error(`nothing added for ${paletteName} into ${into}`);
      if (top.parent !== intoId) throw new Error(`${paletteName} landed in ${(await nodes()).find((n) => n.id === top.parent)?.label}, not ${into}`);
      if (label) { await api.rename(label); await api.select(label); }
      return top.id;
    },
    async removeId(id) {
      const at = await insideOf(id); const n0 = await shows(); await b.click(at.x, at.y); await wait(400);
      await ev('document.activeElement && document.activeElement.blur()'); await b.key('Delete', 'Delete', 46); await settle(n0).catch(() => {});
    },
    async remove(label) {
      await api.select(label); const n0 = await shows();
      const r = await ev(`(() => { const bt = document.querySelector('#right .head button[title="Delete element"]'); if (!bt) return 'no trash'; bt.click(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r);
      await wait(300); await ev(`[...document.querySelectorAll('.ask button, .menu button')].find((x) => /Delete/.test(x.textContent))?.click()`);
      await settle(n0).catch(() => {}); await wait(300);
    },
    async rename(label) { await ev(`(() => { const i = document.querySelector('#right .head input'); i.focus(); i.value = ${J(label)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); })()`); await wait(450); },
    // set the field labelled `label` in the selected element's panel. value: text for an input (nth input: idx),
    // an option's words for a select, or {button: 'Row'} for a segmented control, {check: true}
    async set(label, value, idx = 0) {
      const n0 = await shows();
      const r = await ev(`(() => {
        const fs = [...document.querySelectorAll('#right .field, #right .row, #right label')].filter((x) => (x.querySelector(':scope > label, :scope > .l, :scope > span:first-child')?.textContent.trim() ?? x.textContent.trim()) === ${J(label)} || x.querySelector(':scope > label')?.textContent.trim() === ${J(label)});
        const f = fs[0]; if (!f) return 'no field ' + ${J(label)};
        f.closest('details') && (f.closest('details').open = true);
        const v = ${J(value)};
        if (v && typeof v === 'object' && v.button) { const bt = [...f.querySelectorAll('button')].find((x) => x.textContent.trim() === v.button || x.title === v.button || x.title.endsWith(' ' + v.button) || x.getAttribute('aria-label') === v.button); if (!bt) return 'no button ' + v.button + ' in ' + [...f.querySelectorAll('button')].map((x) => x.textContent.trim() || x.title).join('|'); bt.click(); return 'ok'; }
        if (v && typeof v === 'object' && 'check' in v) { const c = f.querySelector('input[type=checkbox]'); if (c.checked !== v.check) c.click(); return 'ok'; }
        const sel = [...f.querySelectorAll('select')][${idx}];
        const inp = [...f.querySelectorAll('input[type=text], input:not([type]), input[type=number], textarea')][${idx}];
        if (v && typeof v === 'object' && v.select) { const s = [...f.querySelectorAll('select')][v.i || 0]; const o = [...s.options].find((o) => o.textContent.trim().startsWith(v.select)); if (!o) return 'no option ' + v.select + ' in ' + [...s.options].map((o) => o.textContent).join('|'); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }
        if (inp) { inp.focus(); inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.blur(); return 'ok'; }
        if (sel) { const o = [...sel.options].find((o) => o.textContent.trim().startsWith(String(v))); if (!o) return 'no option ' + v; sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }
        return 'no control in ' + ${J(label)};
      })()`);
      if (r !== 'ok') throw new Error(`${label}: ${r}`);
      await settle(n0).catch(() => {}); await wait(450);
    },
    async ph(placeholder, value) {
      const n0 = await shows();
      const r = await ev(`(() => { const i = [...document.querySelectorAll('#right input')].find((x) => x.placeholder === ${J(placeholder)}); if (!i) return 'no input ' + ${J(placeholder)}; i.closest('details') && (i.closest('details').open = true); i.focus(); i.value = ${J(String(value))}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r); await settle(n0).catch(() => {}); await wait(450);
    },
    async newPage(name, type = '') {
      const have = await ev(`[...document.getElementById('pagepick').options].some((o) => o.value === 'Pages/' + ${J(name)})`);
      if (have) return api.page('Pages/' + name);
      const n0 = await shows();
      await ev(`document.getElementById('newpage').click()`); await b.until(`!!document.querySelector('.menu.newpage')`, 4000);
      await ev(`(() => { const m = document.querySelector('.menu.newpage'); const i = m.querySelector('input[aria-label="Page name"]'); i.value = ${J(name)}; i.dispatchEvent(new Event('input')); const t = m.querySelector('select[aria-label="Type of content"]'); t.value = ${J(type)}; t.dispatchEvent(new Event('change')); m.querySelector('.foot .primary').click(); })()`);
      await settle(n0).catch(() => {}); await wait(600);
    },
    async layout(dir) {
      const n0 = await shows();
      const r = await ev(`(() => { const sub = [...document.querySelectorAll('#right .sub')].find((x) => x.textContent.trim() === 'Container layout'); if (!sub) return 'no Container layout'; const bt = [...sub.nextElementSibling.querySelectorAll('button')].find((x) => x.textContent.includes(${J(dir)})); if (!bt) return 'no ' + ${J(dir)}; if (bt.getAttribute('aria-pressed') === 'true') return 'same'; bt.click(); return 'ok'; })()`);
      if (r === 'same') return; if (r !== 'ok') throw new Error(r); await settle(n0).catch(() => {}); await wait(400);
    },
    // ⚡ beside the field labelled `label`, then menu items by their words
    async bolt(label, ...path) {
      const n0 = await shows();
      const r = await ev(`(() => { const f = [...document.querySelectorAll('#right .field')].find((x) => x.querySelector('label')?.textContent.trim() === ${J(label)}); if (!f) return 'no field ' + ${J(label)}; const bt = [...f.querySelectorAll('button')].find((x) => /Take this value/.test(x.title)); if (!bt) return 'no bolt'; bt.click(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r);
      for (const w of path) {
        await b.until(`[...document.querySelectorAll('.menu .item')].some((x) => x.textContent.includes(${J(w)}))`, 4000).catch(() => {});
        const m = await ev(`(() => { const its = [...document.querySelectorAll('.menu .item')].filter((x) => x.getClientRects().length); const it = its.find((x) => x.textContent.trim().startsWith(${J(w)})) || its.find((x) => x.textContent.includes(${J(w)})); if (!it) return 'no item ' + ${J(w)} + ': ' + its.map((x) => x.textContent.trim().slice(0, 30)).join(' | '); it.click(); return 'ok'; })()`);
        if (m !== 'ok') throw new Error(m);
        await wait(400);
      }
      await settle(n0).catch(() => {}); await wait(400);
    },
    async colour(hex, title = 'Color') {
      const n0 = await shows();
      await ev(`document.querySelector('#right button.cbtn[title=${title}]').click()`); await wait(400);
      await ev(`(() => { const m = [...document.querySelectorAll('.menu.colours')].pop(); const i = [...m.querySelectorAll('input[type=text]')][0]; i.focus(); i.value = ${J(hex)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); })()`);
      await settle(n0).catch(() => {}); await wait(400); await ev(`document.querySelector('.menu.colours')?.remove()`);
    },
    // the composer on a field: parts are typed text, or '@<menu item words>' for a value chip
    async compose(label, parts) {
      const n0 = await shows();
      const composed = await ev(`(() => { const f = [...document.querySelectorAll('#right .field')].find((x) => x.querySelector('label')?.textContent.trim() === ${J(label)}); const c = f.querySelector('.chip.expr'); if (c) { c.click(); return true; } [...f.querySelectorAll('button')].find((x) => /Stop taking/.test(x.title))?.click(); return false; })()`); await wait(800);
      if (!composed) {
        await ev(`(() => { const f = [...document.querySelectorAll('#right .field')].find((x) => x.querySelector('label')?.textContent.trim() === ${J(label)}); [...f.querySelectorAll('button')].find((x) => /Take this value/.test(x.title)).click(); })()`); await wait(500);
        await ev(`[...document.querySelectorAll('.menu .item')].find((x) => x.textContent.includes('Compose an expression')).click()`); await wait(600);
      } else {
        await ev(`(() => { const e = [...document.querySelectorAll('[contenteditable=true]')].filter((x) => x.getClientRects().length).pop(); e.focus(); const r = document.createRange(); r.selectNodeContents(e); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
        await b.key('Backspace', 'Backspace', 8); await wait(300);
      }
      const box = `[...document.querySelectorAll('[contenteditable=true]')].filter((x) => x.getClientRects().length).pop()`;
      const end = () => ev(`(() => { const e = ${box}; e.focus(); const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); })()`);
      for (const p of parts) {
        if (p.startsWith('@')) {
          await end();
          await ev(`[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length).find((x) => x.textContent.trim() === 'Insert a value').click()`); await wait(400);
          const r = await ev(`(() => { const it = [...document.querySelectorAll('.menu .item')].filter((x) => x.getClientRects().length).find((x) => x.textContent.includes(${J(p.slice(1))})); if (!it) return 'no chip ' + ${J(p)}; it.click(); return 'ok'; })()`);
          if (r !== 'ok') throw new Error(r); await wait(400);
        } else { await end(); await b.type(p); await wait(250); }
      }
      const text = await ev(`(${box}).innerText`);
      await ev(`[...document.querySelectorAll('button')].filter((x) => x.getClientRects().length).find((x) => x.textContent.trim() === 'Save').click()`);
      await settle(n0).catch(() => {}); await wait(500);
      return text;
    },
    async style(name) { await api.set('Style', { select: name }); },
    async text(t) { await api.set('Text', t); },
    async tab(name) { await ev(`[...document.querySelectorAll('#right .ptabs button')].find((x) => x.textContent.trim() === ${J(name)})?.click()`); await wait(300); },
    async panel() { return ev(`[...document.querySelectorAll('#right .field')].map((f) => (f.querySelector('label')?.textContent || '?') + ' :: ' + [...f.querySelectorAll('input,select,textarea,button')].map((i) => i.tagName.toLowerCase() + (i.tagName === 'SELECT' ? '[' + [...i.options].map((o) => o.textContent).slice(0, 6).join(',') + ']' : i.tagName === 'BUTTON' ? '"' + (i.textContent.trim() || i.title).slice(0, 14) + '"' : '=' + (i.value || '').slice(0, 20))).join(' '))`); }
  };
  return api;
}
