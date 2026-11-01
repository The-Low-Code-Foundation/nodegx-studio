const SP = '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/78fa302f-6795-4edc-b63f-1e7e78b7c527/scratchpad';
import { readFileSync } from 'node:fs';
const file = () => JSON.parse(readFileSync(`${SP}/gh/nodegx.automations.json`, 'utf8'));
const be = async (p) => (await fetch('http://127.0.0.1:47611/api/backend' + p)).json();
export default async (b, u) => {
  const out = {};
  await u.ev(`document.querySelector('#rail [data-tab=backend]').click()`); await u.wait(1500);
  const tid = file().triggers.find((t) => t.target?.name === 'when-a-plant-is-added').id;
  await u.ev(`document.querySelector('#autolist .row[data-trigger="${tid}"]').click()`); await u.wait(1200);
  await u.ev(`document.querySelector('.wfacts [data-act=deltrigger]').click()`); await u.wait(300);
  await u.ev(`document.querySelector('.menu [data-act=confirm]').click()`); await u.wait(1800);
  out.trigGone = { file: !file().triggers.some((t) => t.id === tid), be: !(await be('/admin/triggers')).triggers.some((t) => t.id === tid) };
  await u.ev(`document.querySelector('#autolist .row[data-workflow="when-a-plant-is-added"]').click()`); await u.wait(1200);
  await u.ev(`document.querySelector('.wfacts [data-act=delete]').click()`); await u.wait(300);
  await u.ev(`document.querySelector('.menu [data-act=confirm]').click()`); await u.wait(1800);
  out.wfGone = { file: !file().workflows.some((w) => w.id === 'when-a-plant-is-added'), be: (await fetch('http://127.0.0.1:47611/api/backend/admin/workflow-defs/when-a-plant-is-added')).status, list: await u.ev(`document.querySelectorAll('#autolist .row').length`) };
  return out;
};
