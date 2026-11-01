export default async (b, u) => {
  await u.ev(`document.querySelector('#rail [data-tab=backend]').click()`); await u.wait(1500);
  const list = await u.ev(`({ rows: [...document.querySelectorAll('#autolist .row, #fnlist .row')].map((r) => r.innerText.replace(/\\s+/g, ' ').slice(0, 90)), pageHidden: getComputedStyle(document.querySelector('.wfpage')).display, how: document.getElementById('backhow').innerText.slice(0, 60) })`);
  await u.ev(`document.querySelector('#autolist .row[data-workflow="morning-check"]').click()`); await u.wait(1500);
  await u.ev(`document.querySelector('.autoview .step[data-id="check"]').click()`); await u.wait(500);
  const panel = await u.ev(`document.getElementById('wfinspect').innerText.slice(0, 1500)`);
  await u.shot('s92-step.png');
  return { list, panel };
};
