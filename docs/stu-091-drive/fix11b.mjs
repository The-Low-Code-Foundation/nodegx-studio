export default async (b, u) => {
  const { ev, wait } = u, out = {};
  await ev(`document.querySelector('#rail [data-tab=workflow]').click()`); await wait(500);
  await ev(`[...document.querySelectorAll('#autolist .row')].find((r) => /A workflow on the backend/.test(r.textContent)).click()`); await wait(500);
  out.before = await ev(`document.querySelector('#steps .event-card h2')?.textContent`);
  await ev(`document.querySelector('#rail [data-tab=design]').click()`); await wait(800);
  out.bolts = await ev(`document.querySelectorAll('.bolt.oncanvas').length`);
  const r = await ev(`(() => { const x = document.querySelector('.bolt.oncanvas'); if (!x) return null; const q = x.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()`);
  if (r) { await b.click(r.x, r.y); await wait(600); }
  // more than one workflow on it: a menu
  await ev(`document.querySelector('.menu .item')?.click()`); await wait(700);
  out.after = await ev(`({ tab: document.querySelector('#rail [aria-selected=true]')?.dataset.tab, backendView: !!document.querySelector('#steps .autoview'), card: document.querySelector('#steps .event-card h2')?.textContent })`);
  return out;
};
