// Workflow helpers: Studio's action menu, the step panel (#wfinspect), ⚡ sources
export function wf(b, { ev, wait }) {
  const J = JSON.stringify;
  const api = {
    async addAction(name, after = 'Add an action') {
      const r = await ev(`(() => { const bt = [...document.querySelectorAll('#steps button, #wfinspect button')].filter((x) => x.getClientRects().length).find((x) => x.textContent.trim().includes(${J(after)})); if (!bt) return 'no ' + ${J(after)}; bt.click(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r);
      await b.until(`[...document.querySelectorAll('.menu .item')].length > 0`, 4000); await wait(200);
      const m = await ev(`(() => { const its = [...document.querySelectorAll('.menu .item')]; const it = its.find((x) => (x.querySelector('b, .t, span')?.textContent.trim() || x.textContent.trim()).startsWith(${J(name)})) || its.find((x) => x.textContent.includes(${J(name)})); if (!it) return 'no item ' + ${J(name)} + ': ' + its.map((x) => x.textContent.trim().slice(0, 24)).join(' | '); it.click(); return 'ok'; })()`);
      if (m !== 'ok') throw new Error(m);
      await wait(1500);
    },
    inspect: () => ev(`[...document.querySelectorAll('#wfinspect .field, #wfinspect h3, #wfinspect h4, #wfinspect .sub')].map((f) => f.matches('.field') ? '  ' + (f.querySelector('label')?.textContent || '?') + ' :: ' + [...f.querySelectorAll('input,select,textarea,button,.chip')].map((i) => i.tagName.toLowerCase() + (i.tagName === 'SELECT' ? '[' + [...i.options].map((o) => o.textContent).slice(0, 8).join(',') + ']' : i.tagName === 'BUTTON' || i.classList.contains('chip') ? '"' + (i.textContent.trim() || i.title).slice(0, 30) + '"' : '=' + (i.value || '').slice(0, 20))).join(' ') : '# ' + f.textContent.trim().slice(0, 50))`),
    // ⚡ on a field of the step panel, then pick a menu item by its words (nested menus: a list of words)
    async bolt(label, ...path) {
      const r = await ev(`(() => { const f = [...document.querySelectorAll('#wfinspect .field')].find((x) => x.querySelector('label')?.textContent.trim() === ${J(label)}); if (!f) return 'no field ' + ${J(label)}; const bt = f.querySelector('button.bolt') || [...f.querySelectorAll('button')].find((x) => /Take this value/.test(x.title)); if (!bt) return 'no bolt'; bt.click(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r);
      for (const w of path) {
        await b.until(`[...document.querySelectorAll('.menu .item')].some((x) => x.textContent.includes(${J(w)}))`, 4000).catch(() => {});
        const m = await ev(`(() => { const its = [...document.querySelectorAll('.menu .item')].filter((x) => x.getClientRects().length); const it = its.find((x) => x.textContent.trim().startsWith(${J(w)})) || its.find((x) => x.textContent.includes(${J(w)})); if (!it) return 'no item ' + ${J(w)} + ': ' + its.map((x) => x.textContent.trim().slice(0, 30)).join(' | '); it.click(); return 'ok'; })()`);
        if (m !== 'ok') throw new Error(m);
        await wait(500);
      }
      await wait(800);
    },
    async field(label, value) {
      const r = await ev(`(() => { const f = [...document.querySelectorAll('#wfinspect .field')].find((x) => x.querySelector('label')?.textContent.trim() === ${J(label)}); if (!f) return 'no field ' + ${J(label)}; const s = f.querySelector('select'), i = f.querySelector('input[type=text], input:not([type]), textarea, input[type=number]'); if (s && !i) { const o = [...s.options].find((o) => o.textContent.trim().startsWith(${J(value)})); if (!o) return 'no option ' + [...s.options].map((o) => o.textContent).join('|'); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; } i.focus(); i.value = ${J(value)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return 'ok'; })()`);
      if (r !== 'ok') throw new Error(r); await wait(900);
    },
    async pickStep(text) { const r = await ev(`(() => { const s = [...document.querySelectorAll('#steps .step')].find((x) => x.textContent.includes(${J(text)})); if (!s) return 'no step'; s.click(); return 'ok'; })()`); if (r !== 'ok') throw new Error(r + ' ' + text); await wait(600); }
  };
  return api;
}
