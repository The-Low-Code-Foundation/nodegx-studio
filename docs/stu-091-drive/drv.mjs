// Drive the Studio page in the headless Chrome on :9341, one step per call.
//   node drv.mjs goto <url> | ev '<expr>' | run <step.mjs> [args…] | shot <file.png>
// A step module: export default async (b, u) => result   (u: ev, wait, shot, click, setIn, clickText)
import { attach } from '/Users/richardosborne/vscode_projects/nodegx-studio/editor/cdp.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [cmd, arg, ...rest] = process.argv.slice(2);
const b = await attach({ port: 9341, width: +(process.env.W || 1920), height: +(process.env.H || 1080) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (x) => b.evaluate(x);
const J = JSON.stringify;
const u = {
  ev, wait, J,
  shot: (f) => b.screenshot(resolve(here, 'shots', f)),
  setIn: (sel, v, e = 'input') => ev(`(() => { const el = document.querySelector(${J(sel)}); if (!el) throw new Error('no ' + ${J(sel)}); el.value = ${J(v)}; el.dispatchEvent(new Event(${J(e)}, { bubbles: true })); if (${J(e)} === 'input') el.dispatchEvent(new Event('change', { bubbles: true })); })()`),
  // click the first element matching sel whose text includes txt (visible ones first)
  clickText: (sel, txt) => ev(`(() => { const all = [...document.querySelectorAll(${J(sel)})].filter((x) => x.textContent.includes(${J(txt)})); const el = all.find((x) => x.getClientRects().length) || all[0]; if (!el) throw new Error('no ' + ${J(sel)} + ' with ' + ${J(txt)}); el.click(); return el.textContent.trim().slice(0, 80); })()`),
  args: rest
};
let out;
try {
  if (cmd === 'goto') { await b.goto(arg); await b.waitTitle((t) => t.startsWith('ready'), 90000).catch((e) => (out = String(e))); }
  else if (cmd === 'ev') out = await ev(arg);
  else if (cmd === 'shot') out = await u.shot(arg);
  else if (cmd === 'run') out = await (await import(resolve(here, arg) + `?t=${Date.now()}`)).default(b, u);
} catch (e) { out = { error: String(e.stack || e).split('\n').slice(0, 4).join('\n') }; }
console.log(typeof out === 'string' ? out : J(out, null, 1));
if (b.problems.length) console.log('PROBLEMS:', J(b.problems.slice(0, 8)));
await b.close();
process.exit(0);
