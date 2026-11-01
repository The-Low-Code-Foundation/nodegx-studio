const SP = '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/78fa302f-6795-4edc-b63f-1e7e78b7c527/scratchpad';
import { readFileSync } from 'node:fs';
const fileWf = () => JSON.parse(readFileSync(`${SP}/gh/nodegx.automations.json`, 'utf8')).workflows.find((w) => w.id === 'morning-check');
const beWf = async () => (await (await fetch('http://127.0.0.1:47611/api/backend/admin/workflow-defs/morning-check')).json()).workflow;
const shape = (w) => JSON.stringify(w.steps.map((s) => [s.id, s.kind, s.next ?? [], s.params ?? {}]));
export default async (b, u) => {
  const out = {};
  // add a Wait after step 1
  await u.ev(`document.querySelector('#wfinspect [data-act=addafter]').click()`); await u.wait(300);
  await u.ev(`document.querySelector('.menu .item[data-kind="wait"]').click()`); await u.wait(1500);
  out.afterAdd = { file: shape(fileWf()), backend: shape(await beWf()), picked: await u.ev(`document.querySelector('#wfinspect .type')?.innerText`), cards: await u.ev(`[...document.querySelectorAll('.autoview .step h3')].map((x) => x.firstChild.textContent)`) };
  // change its duration to 5
  await u.ev(`(() => { const f = [...document.querySelectorAll('#wfinspect .field')].find((x) => x.querySelector('label')?.textContent === 'duration' || x.querySelector('label')?.textContent === 'Duration'); const i = f.querySelector('.rvctl input'); i.value = '5'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`); await u.wait(1500);
  out.afterDuration = { file: fileWf().steps.find((s) => s.kind === 'wait').params, backend: (await beWf()).steps.find((s) => s.kind === 'wait').params };
  // move it earlier (to the start)
  await u.ev(`document.querySelector('#wfinspect [data-act=earlier]').click()`); await u.wait(1500);
  out.afterMove = { entry: fileWf().entry, beEntry: (await beWf()).entry, file: shape(fileWf()) };
  await u.shot('s92-moved.png');
  // delete it
  await u.ev(`document.querySelector('#wfinspect .head .danger').click()`); await u.wait(1500);
  out.afterDelete = { file: shape(fileWf()), backend: shape(await beWf()), entry: fileWf().entry, panelHidden: await u.ev(`document.getElementById('wfinspect').hidden`) };
  return out;
};
