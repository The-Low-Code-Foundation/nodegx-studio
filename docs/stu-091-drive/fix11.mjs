// note 11: a backend workflow open, then Design → an element with a workflow → Interactions → its workflow
export default async (b, u) => {
  const { ev, wait } = u, out = {};
  await ev(`document.querySelector('#rail [data-tab=workflow]').click()`); await wait(500);
  await ev(`[...document.querySelectorAll('#autolist .row')].find((r) => /A workflow on the backend/.test(r.textContent)).click()`); await wait(500);
  out.before = await ev(`document.querySelector('#steps .event-card h2')?.textContent`);
  await ev(`document.querySelector('#rail [data-tab=design]').click()`); await wait(600);
  // tree rows carrying a ⚡, one at a time, until the Interactions tab lists a workflow
  const n = await ev(`[...document.querySelectorAll('#tree .row')].filter((x) => x.querySelector('.bolt')).length`);
  out.rowsWithBolt = n;
  for (let i = 0; i < n && !out.clicked; i++) {
    await ev(`(() => { const r = [...document.querySelectorAll('#tree .row')].filter((x) => x.querySelector('.bolt'))[${i}]; r.click(); })()`); await wait(400);
    await ev(`[...document.querySelectorAll('#props button, .right button')].find((x) => /^Interactions/.test(x.textContent.trim()))?.click()`); await wait(400);
    out.clicked = await ev(`(() => { const r = document.querySelector('.props .row.wf'); if (!r) return null; const t = r.textContent.trim().slice(0, 60); r.click(); return t; })()`);
  }
  await wait(700);
  out.after = await ev(`({ tab: document.querySelector('#rail [aria-selected=true]')?.dataset.tab, backendView: !!document.querySelector('#steps .autoview'), card: document.querySelector('#steps .event-card h2')?.textContent })`);
  return out;
};
