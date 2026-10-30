// Richard's Greenhouse notes 1, 8, 9, 11 (2026-10-30), driven with real mouse and keys over CDP
export default async (b, u) => {
  const { ev, wait } = u, out = {};
  // 1 — pan: the page's longest workflow at 150%, a step's panel open, drag the empty canvas left
  await ev(`document.querySelector('#rail [data-tab=workflow]').click()`); await wait(500);
  await ev(`(() => { const rows = [...document.querySelectorAll('#events .row')]; const n = (r) => +((r.textContent.match(/(\\d+) steps?/) || [])[1] || 0); rows.sort((a, z) => n(z) - n(a)); rows[0].click(); })()`); await wait(700);
  for (let i = 0; i < 5; i++) { await ev(`[...document.querySelectorAll('#steps .zoom button')].find((x) => x.textContent === '+')?.click()`); await wait(120); }
  await ev(`document.querySelector('#steps .flow .step[data-id]').click()`); await wait(600);
  // an empty point of the canvas: inside .flowarea, on no step
  const at = await ev(`(() => { const fa = document.querySelector('#steps .flowarea').getBoundingClientRect(), s = document.getElementById('steps').getBoundingClientRect();
    for (let y = fa.top + 4; y < Math.min(fa.bottom, s.bottom) - 4; y += 6) for (let x = s.left + 10; x < s.right - 10; x += 6) { const el = document.elementFromPoint(x, y); if (el?.classList.contains('flowarea') || el?.closest('.flow') && !el.closest('.step, .evnode, .joinnote, button, .chip, .addrow, .wireplus')) return { x: Math.round(x), y: Math.round(y) }; }
    return null; })()`);
  out.emptyPoint = at;
  const before = await ev(`(() => { const s = document.getElementById('steps'); return { left: s.scrollLeft, max: s.scrollWidth - s.clientWidth, panel: !document.getElementById('wfinspect').hidden }; })()`);
  if (at) await b.drag(at, { x: at.x - 400, y: at.y }); await wait(300);
  const after = await ev(`(() => { const s = document.getElementById('steps'); return { left: s.scrollLeft, panel: !document.getElementById('wfinspect').hidden }; })()`);
  // the last step, scrolled fully right, clears the panel's edge by how much
  const clear = await ev(`(() => { const s = document.getElementById('steps'); s.scrollLeft = 99999; const r = Math.max(...[...s.querySelectorAll('.flow .step[data-id]')].map((x) => x.getBoundingClientRect().right)); return Math.round(s.getBoundingClientRect().right - r); })()`);
  out.pan = { before, after, panned: after.left - before.left, panelStayedOpen: after.panel, lastStepClearOfEdgePx: clear };

  // 11 — a backend workflow open, then Design → an element's workflow from its Interactions
  await ev(`[...document.querySelectorAll('#autolist .row')].find((r) => /A workflow on the backend/.test(r.textContent)).click()`); await wait(500);
  out.autoShown = await ev(`!!document.querySelector('#steps .autoview, #steps [data-auto], #steps .fnview')`);
  await ev(`document.querySelector('#rail [data-tab=design]').click()`); await wait(600);
  const opened = await ev(`(() => { const rows = [...document.querySelectorAll('.props .row.wf')]; if (rows.length) { const t = rows[0].textContent; rows[0].click(); return t.trim().slice(0, 60); } return null; })()`);
  if (!opened) {
    // select an element that has a workflow: the tree row with a ⚡
    await ev(`(() => { const r = [...document.querySelectorAll('#tree .row, .tree .row')].find((x) => x.querySelector('.bolt')); r?.click(); })()`); await wait(600);
    out.cardOpened = await ev(`(() => { const rows = [...document.querySelectorAll('.props .row.wf')]; if (!rows.length) return null; const t = rows[0].textContent.trim().slice(0, 60); rows[0].click(); return t; })()`);
  } else out.cardOpened = opened;
  await wait(600);
  out.afterInteraction = await ev(`({ tab: document.querySelector('#rail [aria-selected=true]')?.dataset.tab, backendView: !!document.querySelector('#steps .autoview, #steps .fnview'), card: document.querySelector('#steps .event-card h2, #steps .event-card .named')?.textContent.trim().slice(0, 60) })`);

  // 9 — a reusable armed, then Esc
  await ev(`document.querySelector('#rail [data-tab=design]').click()`); await wait(500);
  const comp = await ev(`(() => { const btn = document.querySelector('#components button'); if (!btn) return null; btn.click(); return btn.textContent; })()`);
  await wait(200);
  const lit = await ev(`document.querySelector('#components button')?.getAttribute('aria-pressed')`);
  await ev(`document.activeElement?.blur()`);
  await b.key('Escape', 'Escape', 27); await wait(200);
  out.esc = { component: comp, pressedBefore: lit, pressedAfter: await ev(`document.querySelector('#components button')?.getAttribute('aria-pressed')`), adding: await ev(`document.querySelector('.adding') ? true : false`) };

  // 8 — Help open, then the Workflow tab
  await ev(`document.getElementById('helpbtn').click()`); await wait(600);
  const helpOpen = await ev(`!document.getElementById('helppanel').hidden`);
  const guide = await ev(`document.querySelector('#helppanel [data-act=docs]')?.textContent`);
  await ev(`document.querySelector('#rail [data-tab=workflow]').click()`); await wait(400);
  out.help = { openedFirst: helpOpen, guideButton: guide, hiddenAfterTab: await ev(`document.getElementById('helppanel').hidden`), tab: await ev(`document.querySelector('#rail [aria-selected=true]')?.dataset.tab`) };
  return out;
};
