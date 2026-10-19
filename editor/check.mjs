/**
 * NodeGX Studio — the editor's gate. Copies the repo's todo-list template, starts an ephemeral backend for the copy, serves
 * the editor on it and drives every tab in headless Chrome over CDP: select, type, resize, reorder, add, delete,
 * undo (Design); the spacing guide; a custom state; a composed expression that runs in the app; the event list, a
 * step's settings, an added action, a branch with a No chain and a Yes chain (Workflow); a new type, a field, a row,
 * an option set (Data); a style saved from one button and worn by another (Styles).
 * Every assertion reads the files the kit's store wrote, the backend, or the app on screen — never the editor's
 * own claim.
 *
 *   node check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node check.mjs --shots    also writes ../docs/look/s2-*.png
 *
 * Needs the deploy runtime, the in-page preview bundle and Orbit's look.js / specs.js (serve.mjs says which is missing).
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
import { applyEdit } from './edits.mjs';
import { createEdits } from './pagedata.mjs';
import { nodegxRepo } from '../lib/nodegx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = nodegxRepo;
const shots = process.argv.includes('--shots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const lineFrom = (proc, pattern, ms = 30000) => new Promise((ok, no) => {
  let out = ''; const t = setTimeout(() => no(new Error(`no "${pattern}" in ${ms} ms:\n${out.slice(-800)}`)), ms);
  const on = (d) => { out += d; const m = out.match(pattern); if (m) { clearTimeout(t); ok(m); } };
  proc.stdout.on('data', on); proc.stderr.on('data', on);
});

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-check-'));
const project = join(tmp, 'todo-list');
cpSync(join(repo, 'templates/todo-list'), project, { recursive: true });
{
  // STU-014 (R8): a reusable with its own item, placed nowhere yet (its copies arrive at the end, as an outside edit). Its
  // copies say which one asked by the value they pass: "Task where position > n". mounted comes from the copy, as the importer writes it.
  const rel = 'Reusable/Probe panel', dir = join(project, 'components', rel), cid = '11111111-2222-5333-8444-555555555555';
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'component.json'), JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/component-v2.json', id: cid, name: 'Probe panel', path: '/' + rel, type: 'visual', created: '2026-10-19T00:00:00.000Z', modified: '2026-10-19T00:00:00.000Z', modifiedBy: 'check' }, null, 2));
  let files = {
    nodes: { $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: cid, version: 1, visualRoots: ['ppRoot'], nodes: [
      { id: 'ppIn', type: 'Component Inputs', label: 'From the copy', ports: [{ name: 'n', plug: 'output', type: 'number' }, { name: 'mounted', plug: 'output', type: 'boolean' }], x: 300, y: 40 },
      { id: 'ppRoot', type: 'Group', label: 'Panel', parameters: { sizeMode: 'contentHeight' }, children: ['ppText'], x: 40, y: 40 },
      { id: 'ppText', type: 'Text', label: 'Probe text', parent: 'ppRoot', parameters: { text: 'probe panel' }, x: 40, y: 120 }] },
    connections: { $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: cid, version: 1, connections: [{ fromId: 'ppIn', fromProperty: 'mounted', toId: 'ppRoot', toProperty: 'mounted' }] }
  };
  for (const e of createEdits({ id: 'ppQ', name: 'probe tasks', collection: 'Task', where: [{ field: 'position', op: 'greaterThan', from: { node: 'ppIn', port: 'n' } }] }, { component: rel, root: 'ppRoot' }).edits) files = applyEdit(files, e).files;
  writeFileSync(join(dir, 'nodes.json'), JSON.stringify(files.nodes, null, 2)); writeFileSync(join(dir, 'connections.json'), JSON.stringify(files.connections, null, 2));
  const regPath = join(project, 'components/_registry.json'), reg = JSON.parse(readFileSync(regPath, 'utf8'));
  reg.components[rel] = { path: rel, type: 'visual', nodeCount: files.nodes.nodes.length, connectionCount: files.connections.connections.length, modified: '2026-10-19T00:00:00.000Z', created: '2026-10-19T00:00:00.000Z' };
  writeFileSync(regPath, JSON.stringify(reg, null, 2));
}
const children = [];
const results = [];
const ok = (cond, what, detail) => { results.push({ cond: !!cond, what, detail }); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
let b;
try {
  const backendPort = await freePort();
  const backend = spawn(process.execPath, [join(repo, 'packages/nodegx-backend/bin/nodegx-backend.js'), 'serve', '--data-dir', join(tmp, 'backend'), '--port', String(backendPort), '--token', 'nodegx-studio-check', '--backend-id', 'nodegx_studio_check', '--backend-name', 'NodeGX Studio check', '--ephemeral'], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(backend);
  await lineFrom(backend, /NODEGX_BACKEND_READY/);
  const pjPath = join(project, 'nodegx.project.json');
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  pj.metadata ??= {};
  pj.metadata.cloudservices = { instanceId: 'studio_check', endpoint: `http://127.0.0.1:${backendPort}`, appId: 'studio_check', type: 'nodegx' };
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
  const port = await freePort();
  const server = spawn(process.execPath, [join(here, 'serve.mjs'), project, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(server);
  await lineFrom(server, /nodegx-studio: http/);
  const url = `http://127.0.0.1:${port}/`;

  b = await browser({ port: await freePort(), width: 1600, height: 1000 });
  await b.goto(url);
  const title = await b.waitTitle((t) => t.startsWith('ready'), 90000);
  console.log(`check: ${title}`);
  await wait(1200);
  const page = () => b.evaluate('document.getElementById("pagepick").value');
  const comp = (key) => b.evaluate(`JSON.stringify(__ob.store.readComponent(${JSON.stringify(key)}).files)`).then(JSON.parse);
  const onDisk = (rel) => JSON.parse(readFileSync(join(project, rel), 'utf8'));
  const SIGN = 'components/Pages/Sign in/';
  const centreOf = (id) => b.evaluate(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(id)})[0]; if (!el) return null; const r = el.getBoundingClientRect(); const o = document.getElementById('overlay').getBoundingClientRect(); return { x: Math.round(o.left + r.left + r.width/2), y: Math.round(o.top + r.top + r.height/2), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(o.top + r.top) }; })()`);
  const appText = () => b.evaluate('__ob.preview.frame.contentDocument.body.innerText');
  const shows = () => b.evaluate('__ob.shows || 0');
  const rebuilt = async (n0) => { await b.until(`(__ob.shows || 0) > ${n0} && document.getElementById("status").textContent.startsWith("App on screen")`, 30000); await wait(300); };
  const status = () => b.evaluate('document.getElementById("status").textContent');
  const clickText = async (sel, text) => { const at = await b.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`); if (!at) throw new Error(`no "${text}" in ${sel}`); await b.click(at.x, at.y); return at; };
  const menuItem = async (text) => { await b.until(`[...document.querySelectorAll('.menu .item')].some(e => e.textContent.includes(${JSON.stringify(text)}))`, 4000); await clickText('.menu .item', text); await wait(250); };
  const shot = async (name) => { if (shots) { await wait(400); await b.screenshot(join(here, '..', 'docs', 'look', `s2-${name}.png`)); } };
  const select = async (id) => { const at = await centreOf(id); await b.click(at.x, at.y); await wait(350); };

  console.log('check: Design');
  ok((await page()) === 'Pages/Sign in' && (await appText()).includes('Sign in'), 'the editor shows the page the app is on (Todo redirects a visitor to Sign in)', { page: await page() });
  const sign = await comp('Pages/Sign in');
  const title1 = sign.nodes.nodes.find((n) => n.label === 'App name').id;
  const lead = sign.nodes.nodes.find((n) => n.label === 'What this is').id;
  const card = sign.nodes.nodes.find((n) => n.label === 'Sign-in card').id;
  const signInBtn = sign.nodes.nodes.find((n) => n.label === 'Sign in' && n.type === 'net.noodl.controls.button').id;
  const createBtn = sign.nodes.nodes.find((n) => n.label === 'Create account').id;
  await select(title1);
  ok((await b.evaluate('document.querySelector("#right .head input")?.value')) === 'App name', 'clicking the app name in the page selects it and the property editor shows it');
  {
    // the spacing guide: four red distances from the element to its parent's content box, read back and compared with the frame's own geometry
    const guides = await b.evaluate(`[...document.querySelectorAll('#overlay .guide')].map(g => Number(g.dataset.n))`);
    const truth = await b.evaluate(`(() => { const w = __ob.preview.frame.contentWindow; const el = __ob.preview.elementsOf(${JSON.stringify(title1)})[0]; const pe = __ob.preview.elementsOf(${JSON.stringify(card)})[0]; const r = el.getBoundingClientRect(), pr = pe.getBoundingClientRect(), cs = w.getComputedStyle(pe); const p = (v) => Math.round(parseFloat(v) || 0); return [r.top - (pr.top + p(cs.paddingTop)), (pr.bottom - p(cs.paddingBottom)) - r.bottom, r.left - (pr.left + p(cs.paddingLeft)), (pr.right - p(cs.paddingRight)) - r.right].map(Math.round); })()`);
    const bands = await b.evaluate(`document.querySelectorAll('#overlay .band.pad').length`);
    ok(guides.length === truth.filter((n) => n > 0).length && truth.filter((n) => n > 0).every((n) => guides.includes(n)), 'the selected element wears the red distance lines to its parent\'s content box, each px value the frame\'s own geometry', { guides, truth, paddingBands: bands });
    await shot('design-selected');
  }
  {
    const fields = await b.evaluate(`[...document.querySelectorAll('#right .field')].map(f => f.querySelector('label').textContent)`);
    const idx = fields.indexOf('Text');
    const n0 = await shows();
    await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')][${idx}]; const i = f.querySelector('input,textarea'); i.focus(); i.select(); })()`);
    await b.type('Studio todo');
    await rebuilt(n0);
    ok(onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === title1).parameters.text === 'Studio todo' && (await appText()).includes('Studio todo'), 'typing in the Text field is written to nodes.json on disk and the app shows it');
  }
  {
    const n0 = await shows(); const before = (await centreOf(title1)).w;
    const hnd = await b.rectOf('.handle.e');
    await b.drag({ x: hnd.x, y: hnd.y }, { x: hnd.x - 100, y: hnd.y });
    await rebuilt(n0);
    const n = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === title1);
    const after = (await centreOf(title1)).w;
    ok(n.parameters.width?.unit && after < before - 60, 'pulling the east handle writes a width the app then has', { before, after, width: n.parameters.width });
  }
  {
    const n0 = await shows(); const from = await centreOf(lead); const to = await centreOf(title1);
    await b.drag({ x: from.x, y: from.y }, { x: to.x, y: to.top + 4 }, 16);
    await rebuilt(n0);
    const kids = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === card).children;
    ok(kids.indexOf(lead) < kids.indexOf(title1), 'dragging the lead above the title reorders the card\'s children on disk', { order: kids.slice(0, 3) });
  }
  {
    let n0 = await shows();
    await b.clickSel('#palette button:nth-child(3)');
    const at = await centreOf(title1); await b.click(at.x, at.y); await rebuilt(n0);
    const added = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.type === 'net.noodl.controls.button' && n.parameters?.label === 'Button');
    ok(added && added.parent === card && (await appText()).includes('Button'), 'a Button from the palette lands in the card on disk and in the app', { parent: added?.parent });
    n0 = await shows(); await b.evaluate('document.activeElement && document.activeElement.blur()'); await b.key('Delete', 'Delete', 46); await rebuilt(n0);
    ok(!onDisk(SIGN + 'nodes.json').nodes.some((n) => n.parameters?.label === 'Button'), 'the Delete key removes it from disk');
    n0 = await shows(); await b.clickSel('#undo'); await rebuilt(n0);
    ok(onDisk(SIGN + 'nodes.json').nodes.some((n) => n.parameters?.label === 'Button'), 'Undo puts it back on disk');
  }
  {
    // P123-S4-CANVASSCROLL: the overlay took the wheel, so a page could not be scrolled while editing (Richard, on the template)
    await select(title1);
    const before = await b.evaluate(`(() => { const w = __ob.preview.frame.contentWindow; w.document.body.style.minHeight = '4000px'; const s = document.querySelector('#overlay .box.sel'); return { y: w.scrollY, box: s ? s.getBoundingClientRect().top : null }; })()`);
    const at = await centreOf(title1); for (let i = 0; i < 3; i++) { await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: 200 }); await wait(120); } await wait(400);
    const after = await b.evaluate(`(() => { const w = __ob.preview.frame.contentWindow; const s = document.querySelector('#overlay .box.sel'); return { y: w.scrollY, box: s ? s.getBoundingClientRect().top : null, stage: document.getElementById('stage').scrollTop }; })()`);
    ok(after.y >= 500 && after.box !== null && before.box !== null && Math.abs((before.box - after.box) - (after.y - before.y)) < 2 && after.stage === 0, 'Design: a wheel over the app scrolls the page and the selection box follows', { before, after });
    await b.evaluate(`(() => { const w = __ob.preview.frame.contentWindow; w.scrollTo(0, 0); w.document.body.style.minHeight = ''; })()`); await wait(300);
  }
  console.log('check: custom states and the composer');
  let stateId;
  {
    // a custom state on the card, with a default (the card is picked in the tree: its centre on the page is the Email input)
    await clickText('#tree .row', 'Sign-in card'); await wait(350);
    let n0 = await shows();
    await clickText('#right .states button', 'New state'); await rebuilt(n0);
    const v = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.type === 'Variable2' && n.metadata?.customState?.of === card);
    stateId = v?.id;
    ok(v && v.metadata.customState.name === 'state' && v.parameters?.name === 'signInCard.state', 'New state on the card writes a Variable node that remembers the card (metadata.customState) with the name signInCard.state', { name: v?.parameters?.name });
    n0 = await shows();
    await b.evaluate(`(() => { const i = document.querySelector('#right .states td:nth-child(3) input'); i.focus(); i.select(); })()`);
    await b.type('Hello'); await b.evaluate(`document.querySelector('#right .states td:nth-child(3) input').dispatchEvent(new Event('change'))`); await rebuilt(n0);
    ok(onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === stateId)?.parameters?.value === 'Hello', 'its default value is the Variable\'s value parameter on disk');
    await shot('design-states');
  }
  {
    // the composer: the title's Text = the card's state + " world", as a chip in the mixed view, then JavaScript typed beside it
    await select(title1);
    const fields = await b.evaluate(`[...document.querySelectorAll('#right .field')].map(f => f.querySelector('label').textContent)`);
    const idx = fields.indexOf('Text');
    await b.evaluate(`[...document.querySelectorAll('#right .field')][${idx}].querySelector('.from button').click()`); await wait(250);
    const sources = await b.evaluate(`[...document.querySelectorAll('.menu .item')].map(e => e.textContent)`);
    ok(sources.some((s) => s.includes("Sign-in card's state")) && sources.some((s) => s.startsWith('Compose an expression')), 'Insert dynamic data lists the custom state and the composer', sources.slice(0, 4));
    await menuItem('Compose an expression');
    ok(await b.evaluate(`!!document.querySelector('.composer')`), 'the composer opens');
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'mixed').click()`); await wait(100);
    await clickText('.composer .tools button', 'Insert dynamic data'); await wait(250);
    await menuItem("Sign-in card's state");
    const chipNames = await b.evaluate(`[...document.querySelectorAll('.composer .mixed .chip')].map(c => c.dataset.name)`);
    ok(chipNames.length === 1 && /^signInCard/i.test(chipNames[0]), 'the state becomes a chip in the mixed view, a name in the text', chipNames);
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'js').click()`); await wait(100);
    const jsBefore = await b.evaluate(`document.querySelector('.composer textarea').value`);
    await b.evaluate(`(() => { const t = document.querySelector('.composer textarea'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); })()`);
    await b.type('+ " world"');
    const jsAfter = await b.evaluate(`document.querySelector('.composer textarea').value`);
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'chips').click()`); await wait(100);
    const chipsView = await b.evaluate(`[...document.querySelectorAll('.composer .chips > *')].map(e => e.classList.contains('chip') ? '[' + e.textContent + ']' : e.textContent)`);
    ok(jsAfter.trim() === `${jsBefore.trim()} + " world"` && chipsView[0]?.startsWith("[Sign-in card's state") && chipsView.includes('"world"') === false && chipsView.some((t) => t.includes('world')), 'the JavaScript view shows the same text with the chip as a name; the composer view shows the chip, the operator and the literal', { js: jsAfter, chips: chipsView });
    await shot('composer');
    const n0 = await shows();
    await clickText('.composer .foot button', 'Save'); await rebuilt(n0);
    const nodes = onDisk(SIGN + 'nodes.json').nodes; const wires = onDisk(SIGN + 'connections.json').connections;
    const expr = nodes.find((n) => n.type === 'Expression' && n.metadata?.composedFor?.node === title1 && n.metadata.composedFor.port === 'text');
    const name = expr && Object.keys(expr).length && (expr.parameters.expression.match(/[A-Za-z_$][\w$]*/) || [])[0];
    const chipWire = expr && wires.find((w) => w.fromId === stateId && w.fromProperty === 'value' && w.toId === expr.id && w.toProperty === name);
    const resultWire = expr && wires.find((w) => w.fromId === expr.id && w.fromProperty === 'result' && w.toId === title1 && w.toProperty === 'text');
    ok(expr && chipWire && resultWire, 'Save writes one Expression node for the field: the chip is a name wired from the state\'s value, the result is wired into the title\'s Text', { text: expr?.parameters?.expression, chipWire: !!chipWire, resultWire: !!resultWire });
    await wait(600);
    ok((await appText()).includes('Hello world'), 'the app shows "Hello world": the state\'s default through the composed expression into the title', { text: (await appText()).slice(0, 80) });
  }
  console.log('check: Workflow');
  await b.clickSel('[data-tab=workflow]'); await wait(300);
  const events = await b.evaluate('[...document.querySelectorAll("#events .row")].map(r => r.firstChild.textContent)');
  ok(events.some((e) => /^When Sign in: /.test(e)) && events.some((e) => /^When Create account: /.test(e)), 'the sign-in page lists its button events', events);
  await b.evaluate(`[...document.querySelectorAll("#events .row")].find(r => r.firstChild.textContent.startsWith("When Sign in: ")).click()`); await wait(300);
  const steps = await b.evaluate('[...document.querySelectorAll("#steps .step h3")].map(r => r.firstChild.textContent)');
  ok(steps.length >= 1 && /Log In/i.test(steps[0]), 'the Sign in click\'s first step is the Log In action', steps);
  await b.clickSel('#steps .step .acts button'); await wait(200);
  const fields = await b.evaluate(`[...document.querySelectorAll('#steps .step .settings')].filter(p => p.style.display !== 'none').flatMap(p => [...p.querySelectorAll('.field label')].map(l => l.textContent))`);
  ok(fields.length > 0, 'a step opens its settings as fields', fields.slice(0, 6));
  await b.clickSel('#steps .step .acts button'); await wait(100);
  {
    // a new workflow on the card's click, with a branch: Yes gets "Set state", No gets "Go to page", the condition is composed
    // (a click, not Did Mount: the app opening must not run it — STU-013-NAVLOOP below)
    await b.clickSel('#newevent'); await wait(250);
    await b.type('Sign-in card click'); await wait(200);
    const first = await b.evaluate(`document.querySelector('.menu .item')?.textContent`);
    await b.clickSel('.menu .item'); await wait(300);
    const evPort = (first.match(/: (.+?)[A-Z][a-z]+ *$/) || [])[1];
    await clickText('#steps .addrow button', 'Add a branch'); await wait(300);
    await b.until('document.querySelector("#steps .step.cond")', 5000);
    // the branch is drawn before its save lands: wait for the file, not a fixed time (it was read 300 ms in and missed, 1 run in 5)
    let wires, nodes, cond;
    for (const t0 = Date.now(); Date.now() - t0 < 5000; await wait(150)) {
      wires = onDisk(SIGN + 'connections.json').connections; nodes = onDisk(SIGN + 'nodes.json').nodes;
      cond = nodes.find((n) => n.type === 'Condition' && wires.some((w) => w.fromId === card && w.toId === n.id && w.toProperty === 'eval'));
      if (cond) break;
    }
    ok(cond, 'Add a branch on the card\'s event writes a Condition node wired from that signal into Evaluate', { event: first, condition: cond?.id });
    const cols = await b.evaluate(`[...document.querySelectorAll('#steps .branch h4')].map(h => h.textContent)`);
    ok(cols.join(',') === 'Yes,No', 'the branch shows a Yes column and a No column under the step', cols);
    await clickText('#steps .branch.no .addrow button', 'Add an action'); await wait(250);
    await b.type('Go to page'); await wait(200); await menuItem('Go to page');
    await wait(500);
    wires = onDisk(SIGN + 'connections.json').connections; nodes = onDisk(SIGN + 'nodes.json').nodes;
    const noNav = nodes.find((n) => n.type === 'RouterNavigate' && wires.some((w) => w.fromId === cond.id && w.fromProperty === 'onfalse' && w.toId === n.id && w.toProperty === 'navigate'));
    const yesEmpty = !wires.some((w) => w.fromId === cond.id && w.fromProperty === 'ontrue');
    ok(noNav && yesEmpty, 'an action added in the No column is a Navigate wired from the Condition\'s On False; the Yes column is still empty', { noNav: !!noNav, yesEmpty });
    await clickText('#steps .branch.yes .addrow button', 'Add an action'); await wait(250);
    await b.type('custom state'); await wait(200); await menuItem('Set a custom state');
    await b.until(`[...document.querySelectorAll('.menu .item')].some(e => e.textContent.includes("Sign-in card's state"))`, 4000);
    await menuItem("Sign-in card's state"); await wait(500);
    wires = onDisk(SIGN + 'connections.json').connections; nodes = onDisk(SIGN + 'nodes.json').nodes;
    const setV = nodes.find((n) => n.type === 'Set Variable' && wires.some((w) => w.fromId === cond.id && w.fromProperty === 'ontrue' && w.toId === n.id && w.toProperty === 'do'));
    ok(setV && setV.parameters?.name === 'signInCard.state', 'Set a custom state in the Yes column is a Set Variable step wired from On True, its name the card\'s state', { name: setV?.parameters?.name });
    // the condition, composed in JavaScript
    await clickText('#steps .step.cond button', 'Set the condition'); await wait(250);
    await menuItem('Compose an expression');
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'js').click()`); await wait(100);
    await b.evaluate(`document.querySelector('.composer textarea').focus()`); await b.type('1 > 2');
    await shot('workflow-branch');
    const n1 = await shows();
    await clickText('.composer .foot button', 'Save'); await wait(800);
    wires = onDisk(SIGN + 'connections.json').connections; nodes = onDisk(SIGN + 'nodes.json').nodes;
    const condExpr = nodes.find((n) => n.type === 'Expression' && n.metadata?.composedFor?.node === cond.id && n.metadata.composedFor.port === 'condition');
    ok(condExpr && condExpr.parameters.expression === '1 > 2' && wires.some((w) => w.fromId === condExpr.id && w.fromProperty === 'result' && w.toId === cond.id && w.toProperty === 'condition'), 'the branch\'s condition is an Expression (1 > 2) wired into the Condition\'s input', { expression: condExpr?.parameters?.expression });
    const shown = await b.evaluate(`document.querySelector('#steps .step.cond .cond-line')?.textContent`);
    ok(/1 > 2/.test(shown || ''), 'the branch card reads the condition back', shown);
    // STU-013-NAVLOOP: NodeGX re-tests a Condition when its value changes, Evaluate wired or not. A branch tests when its
    // event reaches it: its value arriving as the app opens must not send No's "Go to page" (the runtime's own trace says)
    ok(nodes.find((n) => n.id === cond.id)?.parameters?.['runOnChange-condition'] === false, 'the branch is written to test only when its event reaches it (run on change off)', nodes.find((n) => n.id === cond.id)?.parameters);
    await rebuilt(n1); await wait(500);
    const branchTrace = async () => JSON.parse(await b.evaluate(`JSON.stringify(__ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context.getTraceEvents(0).filter(e => e.toNode === ${JSON.stringify(cond.id)} || e.fromNode === ${JSON.stringify(cond.id)}).map(e => e.fromPort + ' > ' + e.toPort))`));
    const atOpen = await branchTrace();
    ok(first.includes('Click') && atOpen.includes('result > condition') && !atOpen.some((t) => /^on(true|false) > /.test(t)), 'in the app, the branch\'s value arrives as it opens and neither Yes nor No runs: nothing clicked the card', { event: first, atOpen });
    await b.evaluate(`__ob.preview.elementsOf(${JSON.stringify(card)})[0].click()`); await wait(500);
    const clicked = await branchTrace();
    ok(clicked.includes('onClick > eval') && clicked.includes('onfalse > navigate') && !clicked.includes('ontrue > do'), 'a click on the card in the app runs the branch: 1 > 2 is false, so No\'s Go to page runs', clicked);
  }
  console.log('check: Data');
  await b.clickSel('[data-tab=data]'); await wait(300);
  await b.evaluate(`window.prompt = () => 'Note'`); await b.clickSel('#newtype'); await wait(800);
  ok(onDisk('nodegx.project.json').metadata.dbCollections.some((c) => c.name === 'Note'), 'a new data type is written into nodegx.project.json');
  await b.evaluate(`window.prompt = () => 'title'`); await clickText('#datamain .bar button', 'New field'); await wait(800);
  ok(onDisk('nodegx.project.json').metadata.dbCollections.find((c) => c.name === 'Note').columns.some((c) => c.name === 'title'), 'a new field is written into the type');
  await wait(1200);
  await clickText('#datamain .bar button', 'New entry'); await wait(1500);
  const rows = await fetch(`http://127.0.0.1:${backendPort}/classes/Note?limit=10`, { headers: { 'X-Parse-Application-Id': 'studio_check' } }).then((r) => r.json());
  ok(rows.results?.length === 1, '"+ New entry" creates a row on the backend', { rows: rows.results?.length });
  await shot('data');
  {
    await b.clickSel('#data .subtabs button[data-sub=options]'); await wait(200);
    await b.evaluate(`window.prompt = () => 'Priorities'`); const n0 = await shows(); await b.clickSel('#newoptset'); await rebuilt(n0);
    const key = 'components/Option sets/Priorities/';
    ok(existsSync(join(project, key + 'nodes.json')) && onDisk('components/_registry.json').components['Option sets/Priorities']?.type === 'logic' && onDisk(key + 'nodes.json').nodes.some((n) => n.type === 'Static Data'), 'a new option set is a logic component on disk with a Static Data node, in the registry');
    await b.evaluate(`window.prompt = () => 'rank'`); await clickText('#optmain .bar button', 'New attribute'); await wait(700);
    for (const name of ['High', 'Low']) { await b.evaluate(`(() => { const i = document.querySelector('#optmain input[placeholder^="New option"]'); i.focus(); i.value = ''; })()`); await b.type(name); await b.key('Enter', 'Enter', 13); await wait(700); }
    const data = onDisk(key + 'nodes.json').nodes.find((n) => n.type === 'Static Data');
    const json = JSON.parse(data.parameters.json);
    const attrs = onDisk(key + 'component.json').metadata?.optionSet?.attributes?.map((a) => a.name);
    ok(json.length === 2 && json[0].display === 'High' && json[1].display === 'Low' && attrs?.includes('rank'), 'two options and an attribute are the Static Data\'s JSON and the component\'s metadata on disk', { json, attrs });
    await shot('option-sets');
    await wait(800);
    ok((await status()).startsWith('App on screen'), 'the app still validates and draws with the option set in the project', await status());
  }
  console.log('check: Styles');
  await b.clickSel('[data-tab=design]'); await wait(400);
  {
    await select(signInBtn);
    const bgSign0 = await b.evaluate(`__ob.preview.frame.contentWindow.getComputedStyle(__ob.preview.elementsOf(${JSON.stringify(signInBtn)})[0]).backgroundColor`);
    await b.evaluate(`window.prompt = () => 'Primary'`);
    let n0 = await shows(); await clickText('#right button', 'Save as a style'); await rebuilt(n0);
    const styles = onDisk('nodegx.styles.json');
    const v = styles.variants?.find((x) => x.name === 'Primary' && x.typename === 'net.noodl.controls.button');
    ok(v && v.parameters.backgroundColor === 'var(--primary)' && onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === signInBtn).variant === 'Primary', 'Save as a style writes a variant of the button type into nodegx.styles.json with the button\'s look, and the button wears it', { parameters: Object.keys(v?.parameters || {}).length });
    const bgBefore = await b.evaluate(`__ob.preview.frame.contentWindow.getComputedStyle(__ob.preview.elementsOf(${JSON.stringify(createBtn)})[0]).backgroundColor`);
    await select(createBtn);
    n0 = await shows();
    await b.evaluate(`(() => { const s = [...document.querySelectorAll('#right select')].find(s => s.options[0].textContent === '(no style)'); s.value = 'Primary'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0);
    const bgSign = await b.evaluate(`__ob.preview.frame.contentWindow.getComputedStyle(__ob.preview.elementsOf(${JSON.stringify(signInBtn)})[0]).backgroundColor`);
    const bgAfter = await b.evaluate(`__ob.preview.frame.contentWindow.getComputedStyle(__ob.preview.elementsOf(${JSON.stringify(createBtn)})[0]).backgroundColor`);
    // P123-S2-VARIANTLOST: the first button must keep the colour it had before it wore the style (the kit's export used to drop every node's variant, and both buttons went the runtime's default black)
    ok(onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === createBtn).variant === 'Primary' && bgAfter === bgSign && bgBefore !== bgAfter && bgSign === bgSign0, 'picking the style on the other button writes its variant and the app draws it as the first, which kept its own colour', { bgBefore, bgAfter, bgSign, bgSign0 });
    await b.clickSel('[data-tab=styles]'); await wait(300);
    await b.evaluate(`[...document.querySelectorAll('#stylelist .row')].find(r => r.textContent.includes('Primary')).click()`); await wait(300);
    const wearers = await b.evaluate(`document.querySelector('#stylemain .card h4')?.textContent`);
    ok(/· 2$/.test(wearers || ''), 'the Styles tab lists the two buttons wearing it', wearers);
    await shot('styles');
    await b.clickSel('[data-tab=design]'); await wait(300); await shot('design');
    await b.clickSel('[data-tab=workflow]'); await wait(300); await shot('workflow');
  }
  console.log('check: files changed outside Studio (STU-002)');
  {
    ok(!(await b.evaluate('__ob.outside || 0')), 'none of the editor\'s own saves came back to it as a change made outside Studio');
    await b.clickSel('[data-tab=design]'); await wait(300);
    await select(title1);
    // what NodeGX's MCP server does: the whole nodes.json written to a temp file and renamed over the old one
    const OUTSIDE = 'Written outside Studio';
    const outsideId = 'outside-text';
    const write = (mutate) => { const f = join(project, SIGN + 'nodes.json'); const j = JSON.parse(readFileSync(f, 'utf8')); mutate(j.nodes); writeFileSync(f + '.tmp-check', JSON.stringify(j, null, 2)); renameSync(f + '.tmp-check', f); };
    const t0 = Date.now();
    write((nodes) => { nodes.push({ id: outsideId, type: 'Text', label: 'Outside', parent: card, parameters: { text: OUTSIDE } }); nodes.find((n) => n.id === card).children.push(outsideId); });
    await b.until(`__ob.preview.frame.contentDocument.body.innerText.includes(${JSON.stringify(OUTSIDE)})`, 5000).catch(() => {});
    const ms = Date.now() - t0;
    const inTree = await b.evaluate(`[...document.querySelectorAll('#tree .row')].some(r => r.textContent.includes('Outside'))`);
    ok(ms < 2000 && (await appText()).includes(OUTSIDE) && inTree, 'a Text node written into nodes.json by another program is on screen and in the element tree within 2 s, with no reload', { ms, inTree });
    ok((await b.evaluate('document.querySelector("#right .head input")?.value')) === 'App name' && (await b.evaluate('document.querySelector("[data-tab=design]").getAttribute("aria-selected")')) === 'true', 'the selection and the open tab are kept');
    ok((await b.evaluate('document.getElementById("toast").textContent')).includes('Pages/Sign in changed outside Studio'), 'the editor says which component changed outside it', await b.evaluate('document.getElementById("toast").textContent'));
    let n0 = await shows(); await b.clickSel('#undo'); await rebuilt(n0);
    ok(onDisk(SIGN + 'nodes.json').nodes.some((n) => n.id === outsideId), 'Undo after it takes back the editor\'s own edit, never the change made outside');
    // a clash: the editor deletes an element while another program's write to the same file is still on its way in
    await select(outsideId);
    write((nodes) => { nodes.find((n) => n.id === lead).parameters.text = 'Theirs'; });
    await b.evaluate('document.activeElement && document.activeElement.blur()'); await b.key('Delete', 'Delete', 46);
    await b.until('!document.getElementById("clash").hidden', 4000).catch(() => {});
    const asked = await b.evaluate('document.getElementById("clash").hidden ? null : document.getElementById("clash-msg").textContent');
    ok(asked?.includes('Pages/Sign in') && onDisk(SIGN + 'nodes.json').nodes.some((n) => n.id === outsideId), 'an edit to a file somebody else wrote meanwhile is not saved over it: the editor asks', asked);
    n0 = await shows(); await b.clickSel('#clash-theirs'); await rebuilt(n0);
    ok(onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === lead).parameters.text === 'Theirs' && (await appText()).includes('Theirs') && (await appText()).includes(OUTSIDE), '"Take theirs" keeps the other program\'s file and drops the editor\'s delete, on disk and on screen');
    await select(outsideId);
    write((nodes) => { nodes.find((n) => n.id === lead).parameters.text = 'Theirs again'; });
    await b.evaluate('document.activeElement && document.activeElement.blur()'); await b.key('Delete', 'Delete', 46);
    await b.until('!document.getElementById("clash").hidden', 4000).catch(() => {});
    await b.clickSel('#clash-mine'); await wait(800);
    const after = onDisk(SIGN + 'nodes.json').nodes;
    ok(!after.some((n) => n.id === outsideId) && after.find((n) => n.id === lead).parameters.text === 'Theirs', '"Keep mine" writes the editor\'s version over theirs');
  }
  console.log('check: Claude Code (STU-005)');
  {
    const NAME = 'nodegx-todo-list';
    const MCP = join(project, '.mcp.json');
    const agentApi = (method = 'GET') => b.evaluate(`fetch('/api/agent${method === 'POST' ? '-connect' : ''}', { method: '${method}' }).then(r => r.json())`);
    await b.until('__ob.agent', 8000);
    ok(!existsSync(MCP) && (await b.evaluate('__ob.agent.state')) === 'none' && (await b.evaluate('document.getElementById("agentpill").textContent')) === 'Connect Claude Code', 'a project with no .mcp.json says "Connect Claude Code" in the header');
    const outside0 = await b.evaluate('__ob.outside || 0');
    await b.clickSel('#agentpill');
    await b.until('document.getElementById("agentconnect")', 8000);
    await b.clickSel('#agentconnect');
    await b.until('__ob.agent && __ob.agent.state === "connected"', 15000);
    const mcp = existsSync(MCP) ? JSON.parse(readFileSync(MCP, 'utf8')) : {};
    const reg = mcp.mcpServers?.[NAME];
    const bundle = join(repo, 'packages/noodl-mcp/dist/noodl-mcp.cjs');
    ok(reg?.type === 'stdio' && reg.args?.[0] === bundle && reg.args?.[1] === project && reg.args?.[2] === '--allow-writes' && Object.keys(mcp.mcpServers).length === 1, 'the button writes .mcp.json registering the checkout\'s NodeGX MCP server for this folder as nodegx-<folder>', reg);
    const claudeMd = existsSync(join(project, 'CLAUDE.md')) ? readFileSync(join(project, 'CLAUDE.md'), 'utf8') : '';
    ok(claudeMd.startsWith('# todo-list') && claudeMd.includes(`\`${NAME}\` MCP server`) && existsSync(join(project, 'AGENTS.md')) && /^\.mcp\.json$/m.test(readFileSync(join(project, '.gitignore'), 'utf8')), 'and the NodeGX editor\'s CLAUDE.md and AGENTS.md, with .mcp.json in .gitignore');
    const shown = await b.evaluate('document.getElementById("agentcmd")?.textContent');
    ok(shown === `cd ${/\s/.test(project) ? JSON.stringify(project) : project} && claude` && (await b.evaluate('document.getElementById("agentpill").textContent')) === 'Claude Code', 'the panel then shows the one command that starts a session in the folder', shown);
    await wait(700);
    ok((await b.evaluate('__ob.outside || 0')) === outside0, 'Studio\'s own writes of CLAUDE.md and AGENTS.md do not come back to it as a change made outside');
    // what `claude` in the folder does with the registration: start it, initialize, list the tools
    const tools = await new Promise((done) => {
      const p = spawn(reg.command, reg.args, { cwd: project, env: { ...process.env, ...reg.env }, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      const finish = (v) => { clearTimeout(t); p.kill(); done(v); };
      const t = setTimeout(() => finish({ error: 'no tools/list answer in 30 s' }), 30000);
      p.on('error', (err) => finish({ error: err.message }));
      p.stdout.on('data', (d) => {
        out += d;
        for (const line of out.split('\n')) {
          try { const m = JSON.parse(line); if (m.id === 2) finish(m.result?.tools?.map((x) => x.name) ?? { error: m.error }); } catch { /* partial */ }
        }
      });
      const msg = (m) => p.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
      msg({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'studio-check', version: '0' } } });
      msg({ method: 'notifications/initialized' });
      msg({ id: 2, method: 'tools/list', params: {} });
    });
    ok(Array.isArray(tools) && tools.includes('get_project_info') && tools.includes('update_component'), 'the registered command starts the NodeGX MCP server on this project and it lists its tools', Array.isArray(tools) ? tools.length : tools);
    const mtime = statSync(MCP).mtimeMs;
    const again = await agentApi('POST');
    ok(again.state === 'connected' && again.files.length === 0 && statSync(MCP).mtimeMs === mtime, 'connecting again writes nothing');
    // a copied project: its .mcp.json registers NodeGX for the folder it was copied from
    const elsewhere = JSON.stringify({ mcpServers: { 'nodegx-original': { ...reg, args: [bundle, '/Users/someone/original', '--allow-writes'] } } }, null, 2);
    writeFileSync(MCP, elsewhere); rmSync(join(project, 'CLAUDE.md')); rmSync(join(project, 'AGENTS.md'));
    const moved = await agentApi('POST');
    ok(moved.state === 'elsewhere' && moved.elsewhere === '/Users/someone/original' && readFileSync(MCP, 'utf8') === elsewhere && !existsSync(join(project, 'CLAUDE.md')), 'a .mcp.json that registers NodeGX for another folder is reported, and neither it nor a CLAUDE.md claiming a server is written', { state: moved.state, elsewhere: moved.elsewhere });
    await b.evaluate('__ob.openAgent()'); await b.until('document.querySelector("#agentpanel h4")', 8000);
    ok((await b.evaluate('document.querySelector("#agentpanel").textContent')).includes('/Users/someone/original'), 'the panel names the folder that app is connected to', await b.evaluate('document.querySelector("#agentpanel h4").textContent'));
    const theirs = JSON.stringify({ mcpServers: { svelte: { type: 'stdio', command: 'npx', args: ['-y', '@sveltejs/mcp'], env: {} } } }, null, 2);
    writeFileSync(MCP, theirs);
    const other = await agentApi('POST');
    ok(other.state === 'other' && other.others?.join() === 'svelte' && readFileSync(MCP, 'utf8') === theirs, 'a .mcp.json of the person\'s own servers is left as it is and the panel offers the entry to add', other.state);
    await b.evaluate('document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))'); await wait(100);
  }
  console.log('check: page data (STU-010, STU-011)');
  {
    // last: it wires the Sign in page's two texts, which the sections before read as plain text
    await b.clickSel('[data-tab=design]'); await wait(400);
    const qc = () => b.evaluate('document.getElementById("querycount").textContent');
    await b.until('/on open$/.test(document.getElementById("querycount").textContent)', 10000);
    ok((await qc()) === '0 queries on open', 'before: the Sign in page header reads "0 queries on open", counted off the requests the app made', await qc());
    for (const title of ['Water the plants', 'Buy milk']) await fetch(`http://127.0.0.1:${backendPort}/classes/Note`, { method: 'POST', headers: { 'X-Parse-Application-Id': 'studio_check', 'content-type': 'application/json' }, body: JSON.stringify({ title }) });
    const setIn = async (sel, value, event = 'input') => { await b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)})); })()`); await wait(event === 'input' ? 800 : 500); };
    /** The New page data form: a name, a type, every / first, an optional condition; returns what its note and button said. */
    const form = async ({ name = '', type, first = false, where }) => {
      await b.until('document.querySelector(".menu.newitem")', 4000);
      await setIn('.menu.newitem input[aria-label=Name]', name);
      await setIn('.menu.newitem select[aria-label=Type]', type, 'change');
      if (first) { await clickText('.menu.newitem .seg button', 'The first one'); await wait(200); }
      if (where) { await setIn('.menu.newitem input[aria-label="Where field"]', where.field); await setIn('.menu.newitem select[aria-label="Where operator"]', where.op, 'change'); }
      const said = await b.evaluate(`({ note: document.querySelector('.menu.newitem .note').textContent, button: document.querySelector('.menu.newitem .foot .primary').textContent })`);
      await clickText('.menu.newitem .foot button', said.button); await wait(800);
      return said;
    };
    await b.clickSel('#newpagedata'); await form({ name: 'latest note', type: 'Note' });
    await clickText('#right .pageitem .seg button', 'The first one'); await wait(500);
    await clickText('#right .pageitem button', 'Add a condition'); await wait(500);
    await setIn('#right .pageitem .cond input', 'title');
    await setIn('#right .pageitem .cond select', 'exists', 'change');
    await clickText('#right .pageitem button', 'Sort by'); await wait(500);
    await setIn('#right .pageitem .cond.sort input', 'title');
    await shot('page-data-item');
    const signNodes = () => onDisk(SIGN + 'nodes.json').nodes;
    const q = signNodes().find((n) => n.metadata?.pageData?.name === 'latest note');
    ok(q?.type === 'DbCollection2' && q.parent === undefined && q.parameters.collectionName === 'Note' && q.parameters.storageLimit === 1
      && JSON.stringify(q.parameters.visualFilter) === JSON.stringify({ type: 'and', conditions: [{ field: 'title', operator: 'exists', value: true, valueSource: 'static' }] })
      && JSON.stringify(q.parameters.visualSort) === JSON.stringify([{ property: 'title', order: 'ascending' }]), '"latest note" made in Design\'s Page data is one Query Records node on disk: first Note where title is set, by title', q?.parameters);
    const rec = signNodes().find((n) => n.metadata?.pageDataRecord?.item === q?.id);
    ok(rec?.type === 'Model2' && onDisk(SIGN + 'connections.json').connections.some((c) => c.fromId === q.id && c.fromProperty === 'firstItemId' && c.toId === rec.id && c.toProperty === 'modelId'), 'its first record is an Object node bound to it', rec);
    // two Texts on screen whose text nothing feeds yet: the lead, and one placed now from the palette (the App name's is the composer's by now)
    { const n0 = await shows(); await b.clickSel('#palette button:nth-child(2)'); const at = await centreOf(signNodes().find((n) => n.label === 'What this is').id); await b.click(at.x, at.y); await rebuilt(n0); }
    const fed = new Set(onDisk(SIGN + 'connections.json').connections.filter((c) => c.toProperty === 'text').map((c) => c.toId));
    const free = signNodes().filter((n) => n.type === 'Text' && !fed.has(n.id)).map((n) => n.id);
    const visible = await b.evaluate(`${JSON.stringify(free)}.filter((id) => (__ob.preview.elementsOf(id)[0]?.getBoundingClientRect().height || 0) > 0)`);
    const texts = visible.slice(0, 2);
    if (texts.length < 2) throw new Error(`fewer than two free Texts on the Sign in page: ${JSON.stringify(visible)}`);
    for (const id of texts) {
      await select(id);
      const at = await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Text'); const btn = f?.querySelector('.from button'); if (!btn) return null; btn.scrollIntoView({ block: 'nearest' }); const r = btn.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      if (!at) throw new Error(`no "Insert dynamic data" on the Text field of ${id}`);
      await b.click(at.x, at.y);
      const n0 = await shows(); await menuItem("latest note's title"); await rebuilt(n0);
    }
    const wires = onDisk(SIGN + 'connections.json').connections;
    ok(texts.every((id) => wires.some((c) => c.fromId === rec?.id && c.fromProperty === 'prop-title' && c.toId === id && c.toProperty === 'text')) && rec && signNodes().find((n) => n.id === rec.id).parameters?.properties === 'title', 'both texts are wired from the record\'s title, which the record node now lists', wires.filter((c) => c.fromId === rec?.id));
    const shown = `(() => ${JSON.stringify(texts)}.map((id) => __ob.preview.elementsOf(id)[0]?.innerText.trim()))()`;
    await b.until(`${shown}.every((t) => t === 'Buy milk')`, 15000);
    ok((await b.evaluate(shown)).every((t) => t === 'Buy milk'), 'the item shows on screen through two text elements: "Buy milk", the first by title of the notes with a title', await b.evaluate(shown));
    await b.until('document.getElementById("querycount").textContent === "1 query on open"', 10000);
    ok((await qc()) === '1 query on open', 'the page header reads "1 query on open": one item, two readers, one request', await qc());
    const row = await b.evaluate(`document.querySelector('#pagedata .row[data-item]')?.innerText`);
    ok(/2 readers/.test(row) && /1 row · \d+ ms/.test(row), 'its row in Page data says 2 readers and its last run in the app (1 row, how long)', row);
    await shot('page-data');
  }
  console.log('check: one question, one query (STU-012)');
  {
    const queries = () => onDisk(SIGN + 'nodes.json').nodes.filter((n) => n.type === 'DbCollection2');
    const byName = (name) => queries().find((n) => n.metadata?.pageData?.name === name);
    const setIn = async (sel, value, event = 'input') => { await b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)})); })()`); await wait(event === 'input' ? 800 : 500); };
    const form = async ({ name = '', type, first = false, where }) => {
      await b.until('document.querySelector(".menu.newitem")', 4000);
      await setIn('.menu.newitem input[aria-label=Name]', name);
      await setIn('.menu.newitem select[aria-label=Type]', type, 'change');
      if (first) { await clickText('.menu.newitem .seg button', 'The first one'); await wait(200); }
      if (where) { await setIn('.menu.newitem input[aria-label="Where field"]', where.field); await setIn('.menu.newitem select[aria-label="Where operator"]', where.op, 'change'); }
      const said = await b.evaluate(`({ note: document.querySelector('.menu.newitem .note').textContent, button: document.querySelector('.menu.newitem .foot .primary').textContent })`);
      await clickText('.menu.newitem .foot button', said.button); await wait(800);
      return said;
    };
    await b.clickSel('#newpagedata'); await form({ name: 'notes', type: 'Note' });
    const notes = byName('notes');
    ok(notes && queries().length === 2, 'a second, different question ("every Note") is a second item', queries().map((n) => n.metadata?.pageData?.name));
    // the same question from a field's "Insert dynamic data → New page data…" (Bubble's "Do a search for")
    const btn = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.type === 'net.noodl.controls.button' && n.parameters?.label === 'Button')?.id;
    await select(btn);
    const at = await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Label'); const btn = f?.querySelector('.from button'); if (!btn) return null; btn.scrollIntoView({ block: 'nearest' }); const r = btn.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!at) throw new Error('no "Insert dynamic data" on the button\'s Label');
    await b.click(at.x, at.y); await menuItem('New page data…');
    const said = await form({ name: 'all the notes', type: 'Note' });
    ok(/^notes already asks this/.test(said.note) && said.button === 'Use notes', 'asking it again, the form says which item already asks it and offers to use it', said);
    ok(queries().length === 2 && onDisk(SIGN + 'connections.json').connections.some((c) => c.fromId === notes.id && c.fromProperty === 'items' && c.toId === btn && c.toProperty === 'label'), '"Use notes" writes no query: the field reads the item that asks it', { queries: queries().length });
    await b.clickSel('#newpagedata'); await form({ name: 'titled', type: 'Note', where: { field: 'title', op: 'exists' } });
    const titled = byName('titled');
    ok(titled && queries().length === 3, 'one with a condition is a different question, so a third item', titled?.parameters?.visualFilter);
    // the only other way to a twin: editing one into another's question
    await b.evaluate(`document.querySelector('#right .pageitem .cond button.danger').click()`); await wait(800);
    const toastText = await b.evaluate('document.getElementById("toast").textContent');
    ok(/exactly what notes asks/.test(toastText) && byName('titled')?.parameters?.visualFilter?.conditions?.length === 1 && queries().length === 3, 'removing its condition would make it ask what notes asks: refused, and the file keeps the condition', toastText);
    // Workflow: a step refreshes an item; it never writes a query of its own
    await b.clickSel('[data-tab=workflow]'); await wait(300);
    await b.evaluate(`[...document.querySelectorAll("#events .row")].find(r => r.firstChild.textContent.startsWith("When Sign in: Click")).click()`); await wait(300);
    const addRows = await b.evaluate(`document.querySelectorAll('#steps .addrow').length`);
    await clickText('#steps .addrow button', 'Add an action');
    await b.until(`document.querySelectorAll('.menu .item').length > 0`, 4000);
    const offeredAll = await b.evaluate(`[...document.querySelectorAll('.menu .item')].map((i) => i.textContent)`);
    ok(offeredAll.some((t) => t.startsWith('Refresh page data')) && !offeredAll.some((t) => /Fetch records|Query Records/.test(t)), 'the action list offers "Refresh page data" and no way to write a query', offeredAll.filter((t) => /Refresh|Fetch|Quer/.test(t)));
    await menuItem('Refresh page data'); await menuItem('notes');
    const refreshes = onDisk(SIGN + 'connections.json').connections.filter((c) => c.toId === notes.id && c.toProperty === 'storageFetch');
    ok(refreshes.length === 1 && queries().length === 3, 'Refresh → notes is one wire into the item\'s Do, and no new query node', refreshes);
    const stepsText = await b.evaluate(`document.getElementById('steps').innerText`);
    ok(/Refresh page data/.test(stepsText) && /A refresh ends the workflow/.test(stepsText) && (await b.evaluate(`document.querySelectorAll('#steps .addrow').length`)) === addRows - 1, 'the chain shows it as a Refresh step and ends there (no step can hang on the item\'s every run)', stepsText.slice(-200));
    await b.clickSel('[data-tab=design]'); await wait(400);
  }
  console.log('check: a reusable\'s data asks while that copy is shown (STU-014, R8)');
  {
    // four copies on Sign in, written as another program would: 1 and 2 shown, 3 hidden itself, 4 inside a hidden group
    const f = join(project, SIGN + 'nodes.json'); const j = JSON.parse(readFileSync(f, 'utf8'));
    const copy = (id, n, extra = {}, parent = card) => ({ id, type: '/Reusable/Probe panel', label: `Probe ${n}`, parent, parameters: { n, ...extra } });
    j.nodes.push(copy('pr1', 1), copy('pr2', 2), copy('pr3', 3, { mounted: false }), { id: 'prHide', type: 'Group', label: 'Hidden group', parent: card, parameters: { mounted: false }, children: ['pr4'] }, copy('pr4', 4, {}, 'prHide'));
    j.nodes.find((n) => n.id === card).children.push('pr1', 'pr2', 'pr3', 'prHide');
    const n0 = await shows();
    writeFileSync(f + '.tmp-check', JSON.stringify(j, null, 2)); renameSync(f + '.tmp-check', f);
    await rebuilt(n0); await wait(1500);
    // which copies asked: the n in "position > n" of each Task query the app made since this frame opened
    const asked = async () => JSON.parse(await b.evaluate(`JSON.stringify((__ob.preview.frame.contentWindow.__studioLog || []).filter(e => e.kind === 'request' && /\\/classes\\/Task$/.test(e.path || '') && e.body?._method === 'GET').map(e => e.body.where?.position?.$gt))`));
    const drawn = async () => ((await appText()).match(/probe panel/g) || []).length;
    const setIn = (id, port, v) => b.evaluate(`__ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context.rootComponent.nodeScope.getNodesWithIdRecursive(${JSON.stringify(id)})[0].setInputValue(${JSON.stringify(port)}, ${JSON.stringify(v)})`);
    const open = await asked();
    ok(open.slice().sort().join() === '1,2' && (await drawn()) === 2, 'the page opens: the two shown copies ask once each, the hidden copy and the copy in a hidden group do not ask', { asked: open, drawn: await drawn() });
    await setIn('pr1', 'n', 5); await wait(1200);
    await setIn('pr4', 'n', 7); await wait(1200);
    const changed = await asked();
    ok(changed.slice(open.length).join() === '5', 'a value changes on a shown copy: it asks again; on the copy in the hidden group: it waits', changed);
    await setIn('pr3', 'mounted', true); await wait(1200);
    await setIn('prHide', 'mounted', true); await wait(1200);
    const shown = await asked();
    ok(shown.slice(changed.length).join() === '3,7' && (await drawn()) === 4, 'shown, each hidden copy asks once, with the value it has now (3, then 7)', { asked: shown, drawn: await drawn() });
  }
  ok((await status()).startsWith('App on screen'), 'after every edit the app still validates and draws', await status());
  const problems = b.problems.filter((p) => !/Invalid connection|doesn't have a port|Failed to load resource|fonts\.g|^\[noodl\]/.test(p)); // `[noodl]` lines are the app's own runtime (a Navigate with no target yet), not the editor
  ok(problems.length === 0, 'no exceptions in the editor page', problems.slice(0, 3));
} catch (err) {
  ok(false, `the gate itself: ${err.message.split('\n')[0]}`);
  console.log(err.stack?.split('\n').slice(0, 4).join('\n'));
} finally {
  try { await b?.close(); } catch { /* gone */ }
  for (const c of children) c.kill();
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter((r) => r.cond).length;
console.log(`check: ${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
