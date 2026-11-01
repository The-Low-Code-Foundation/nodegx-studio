const SP = '/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/78fa302f-6795-4edc-b63f-1e7e78b7c527/scratchpad';
import { readFileSync } from 'node:fs';
const file = () => JSON.parse(readFileSync(`${SP}/gh/nodegx.automations.json`, 'utf8'));
const be = async (p) => (await fetch('http://127.0.0.1:47611/api/backend' + p)).json();
export default async (b, u) => {
  const out = {};
  await u.ev(`document.getElementById('newauto').click()`); await u.wait(300);
  out.form = await u.ev(`document.querySelector('.menu.newauto').innerText.slice(0, 400)`);
  await u.setIn('.menu.newauto input[aria-label="Workflow name"]', 'When a plant is added');
  await u.ev(`(() => { const s = document.querySelector('.menu.newauto select[aria-label="Which table"]'); s.value = 'Plant'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await u.shot('s92-new.png');
  await u.ev(`[...document.querySelectorAll('.menu.newauto .foot button')].find((x) => x.textContent === 'Create').click()`); await u.wait(2500);
  const f = file();
  out.made = { wf: f.workflows.find((w) => w.id === 'when-a-plant-is-added'), trig: f.triggers.find((t) => t.target?.name === 'when-a-plant-is-added') };
  out.onBackend = { wf: !!(await be('/admin/workflow-defs/when-a-plant-is-added')).workflow, trig: (await be('/admin/triggers')).triggers.filter((t) => t.target?.name === 'when-a-plant-is-added').map((t) => [t.id, t.type, t.dbChange]) };
  out.shown = await u.ev(`document.querySelector('.autoview h2')?.textContent`);
  out.list = await u.ev(`[...document.querySelectorAll('#autolist .row')].map((r) => r.innerText.replace(/\\s+/g, ' ').slice(0, 70))`);
  // rename
  await u.ev(`document.querySelector('.wfacts [data-act=rename]').click()`); await u.wait(300);
  await u.setIn('.menu input[aria-label="Workflow name"]', 'A new plant');
  await u.ev(`[...document.querySelectorAll('.menu .foot button')].find((x) => x.textContent === 'Rename').click()`); await u.wait(1800);
  out.renamed = { file: file().workflows.find((w) => w.id === 'when-a-plant-is-added').name, be: (await be('/admin/workflow-defs/when-a-plant-is-added')).workflow.name };
  // delete: refused while its trigger starts it
  await u.ev(`document.querySelector('.wfacts [data-act=delete]').click()`); await u.wait(600);
  out.refused = await u.ev(`[...document.querySelectorAll('.toast, #toast')].map((t) => t.textContent).join(' | ').slice(0, 200)`);
  return out;
};
