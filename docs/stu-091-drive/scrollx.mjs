// P123-GH-FLOWNOSCROLLX: open the page's longest workflow, zoom to 150%, open a step's panel, and read whether #steps scrolls sideways
export default async (b, u) => {
  const { ev, wait } = u;
  await ev(`document.querySelector('#rail [data-tab=workflow]').click()`);
  await wait(600);
  // the row with the most steps ("· N steps")
  await ev(`(() => { const rows = [...document.querySelectorAll('#events .row')]; const n = (r) => +((r.textContent.match(/(\\d+) steps?/) || [])[1] || 0); rows.sort((a, z) => n(z) - n(a)); rows[0]?.click(); return rows.map((r) => r.textContent.trim().slice(0, 60)); })()`);
  await wait(800);
  for (let i = 0; i < 5; i++) { await ev(`[...document.querySelectorAll('#steps .zoom button')].find((x) => x.textContent === '+')?.click()`); await wait(150); }
  await ev(`document.querySelector('#steps .flow .step[data-id]')?.click()`);
  await wait(700);
  return ev(`(() => { const s = document.getElementById('steps'), sec = document.getElementById('workflow'), fa = s.querySelector('.flowarea'), insp = document.getElementById('wfinspect');
    const before = s.scrollLeft; s.scrollLeft = 99999; const after = s.scrollLeft; s.scrollLeft = before;
    const steps = [...s.querySelectorAll('.flow .step[data-id]')].map((x) => Math.round(x.getBoundingClientRect().right));
    return { viewport: innerWidth, zoom: s.querySelector('.zoomval')?.textContent, sectionW: Math.round(sec.getBoundingClientRect().width), sectionCols: getComputedStyle(sec).gridTemplateColumns,
      stepsClientW: s.clientWidth, stepsScrollW: s.scrollWidth, scrolledTo: after, flowareaW: fa && Math.round(fa.getBoundingClientRect().width), panelOpen: !insp.hidden, panelLeft: Math.round(insp.getBoundingClientRect().left), rightmostStep: Math.max(...steps) }; })()`);
};
