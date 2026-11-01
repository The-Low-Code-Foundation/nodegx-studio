const SP = '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/78fa302f-6795-4edc-b63f-1e7e78b7c527/scratchpad';
import { readFileSync } from 'node:fs';
const fileWf = (id) => JSON.parse(readFileSync(`${SP}/gh/nodegx.automations.json`, 'utf8')).workflows.find((w) => w.id === id);
export default async (b, u) => {
  const out = {};
  await u.ev(`document.querySelector('#autolist .row[data-workflow="when-watered"]').click()`); await u.wait(1800);
  await u.ev(`document.querySelector('.autoview .step[data-id="check"]').click()`); await u.wait(500);
  out.validatePanel = await u.ev(`document.getElementById('wfinspect').innerText.slice(0, 900)`);
  await u.shot('s92-validate.png');
  // a branch after the validate step: the condition in words
  await u.ev(`document.querySelector('#wfinspect [data-act=addafter]').click()`); await u.wait(300);
  await u.ev(`document.querySelector('.menu .item[data-kind="branch"]').click()`); await u.wait(1800);
  out.branch = { step: fileWf('when-watered').steps.find((s) => s.kind === 'branch'), check: fileWf('when-watered').steps.find((s) => s.id === 'check').next };
  out.branchPanel = await u.ev(`document.getElementById('wfinspect').innerText.slice(0, 900)`);
  // compare: previous.result "is" "ok"
  await u.ev(`(() => { const s = [...document.querySelectorAll('#wfinspect .condwords select')].find((x) => x.getAttribute('aria-label') === 'How it compares'); s.value = 'eq'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await u.wait(1800);
  await u.ev(`(() => { const f = [...document.querySelectorAll('#wfinspect .condwords .field')].find((x) => x.querySelector('label')?.textContent === 'That'); const i = f.querySelector('.rvctl input'); i.value = 'ok'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`); await u.wait(1800);
  out.condition = fileWf('when-watered').steps.find((s) => s.kind === 'branch').params.condition;
  await u.shot('s92-branch.png');
  return out;
};
