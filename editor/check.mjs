/**
 * NodeGX Studio — the editor's gate. Copies NodeGX's todo-list template, starts an ephemeral backend for the copy, serves
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
import { createEdits, readItems } from './pagedata.mjs';
import { kit } from '../lib/nodegx.mjs';
import { createRequire } from 'node:module';
import { TYPES, phrasesFor } from './phrases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
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
cpSync(join(kit.templates, 'todo-list'), project, { recursive: true });
{
  // written as the importer writes a reusable (no visualRoots: STU-015's picker once missed every imported one)
  // STU-014 (R8): a reusable with its own item, placed nowhere yet (its copies arrive at the end, as an outside edit). Its
  // copies say which one asked by the value they pass: "Task where position > n". mounted comes from the copy, as the importer writes it.
  const rel = 'Reusable/Probe panel', dir = join(project, 'components', rel), cid = '11111111-2222-5333-8444-555555555555';
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'component.json'), JSON.stringify({ $schema: 'https://opennoodl.dev/schemas/component-v2.json', id: cid, name: 'Probe panel', path: '/' + rel, type: 'visual', created: '2026-10-19T00:00:00.000Z', modified: '2026-10-19T00:00:00.000Z', modifiedBy: 'check' }, null, 2));
  let files = {
    nodes: { $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: cid, version: 1, nodes: [
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
{
  // STU-051's Conditional tab: a rule written as the importer writes one (Top right's top margin, 24 on a screen narrower
  // than 100000 px — every screen here — else 8), and a hover look on Create account
  const dir = join(project, 'components/Pages/Sign in'), nf = join(dir, 'nodes.json'), cf = join(dir, 'connections.json');
  const nj = JSON.parse(readFileSync(nf, 'utf8')), cj = JSON.parse(readFileSync(cf, 'utf8'));
  nj.nodes.push({ id: 'ruleScreen', type: 'Screen Resolution', label: 'Screen', x: 1000, y: 40 },
    { id: 'ruleTop', type: 'Expression', label: 'Top right: marginTop when the screen is narrow', parameters: { expression: '((w < 100000)) ? 24 : 8', evaluateAtLoad: true }, metadata: { bubble: "Current Page Width's less_than 100000" }, x: 1000, y: 120 });
  nj.nodes.find((n) => n.id === 'siCreate').stateParameters = { hover: { backgroundColor: '#ff0000' } };
  cj.connections.push({ fromId: 'ruleScreen', fromProperty: 'width', toId: 'ruleTop', toProperty: 'w' }, { fromId: 'ruleTop', fromProperty: 'result', toId: 'siTop', toProperty: 'marginTop' });
  writeFileSync(nf, JSON.stringify(nj, null, 2)); writeFileSync(cf, JSON.stringify(cj, null, 2));
}
const children = [];
const results = [];
const ok = (cond, what, detail) => { results.push({ cond: !!cond, what, detail }); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
let b;
try {
  const backendPort = await freePort();
  const backend = spawn(process.execPath, [kit.backendCli, 'serve', '--data-dir', join(tmp, 'backend'), '--port', String(backendPort), '--token', 'nodegx-studio-check', '--backend-id', 'nodegx_studio_check', '--backend-name', 'NodeGX Studio check', '--ephemeral'], { stdio: ['ignore', 'pipe', 'pipe'] });
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
    // custom states are on the element's Interaction tab, as Bubble keeps what an element does (STU-051)
    await clickText('#right .ptabs button', 'Interaction'); await wait(250);
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
    await clickText('#right .ptabs button', 'Visual'); await wait(250);
  }
  {
    // the composer: the title's Text = the card's state + " world", as a chip in the mixed view, then JavaScript typed beside it
    await select(title1);
    const fields = await b.evaluate(`[...document.querySelectorAll('#right .field')].map(f => f.querySelector('label').textContent)`);
    const idx = fields.indexOf('Text');
    await b.evaluate(`[...document.querySelectorAll('#right .field')][${idx}].querySelector('.bolt').click()`); await wait(250);
    const sources = await b.evaluate(`[...document.querySelectorAll('.menu .item')].map(e => e.textContent)`);
    ok(sources.some((s) => s.includes("Sign-in card's state")) && sources.some((s) => s.startsWith('Compose an expression')), 'the ⚡ lists the custom state and the composer', sources.slice(0, 4));
    await menuItem('Compose an expression');
    ok(await b.evaluate(`!!document.querySelector('.composer')`), 'the composer opens');
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'mixed').click()`); await wait(100);
    await clickText('.composer .tools button', 'Insert a value'); await wait(250);
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
  console.log("check: the composer's follow-ups (STU-052)");
  {
    // the title's Text is now [the card's state] + " world": open it again, click the chip, and ask what can follow it
    const { rows } = createRequire(import.meta.url)(kit.phrasebook);
    const openOnTitle = async () => {
      await select(title1);
      const fields = await b.evaluate(`[...document.querySelectorAll('#right .field')].map(f => f.querySelector('label')?.textContent)`);
      await b.evaluate(`[...document.querySelectorAll('#right .field')][${fields.indexOf('Text')}].querySelector('.chip.expr').click()`); await wait(300);
      await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'chips').click()`); await wait(100);
      await b.evaluate(`document.querySelector('.composer .chips .chip').click()`); await wait(150);
    };
    const asType = async (t) => { await b.evaluate(`(() => { const s = document.querySelector('.composer .then select'); s.value = ${JSON.stringify(t)}; s.dispatchEvent(new Event('change')); })()`); await wait(100); };
    const offered = async () => { await clickText('.composer .then button', 'more…'); await wait(200); const l = await b.evaluate(`[...document.querySelectorAll('.menu.phrases .item')].map(e => e.firstChild.textContent)`); return l; };
    await openOnTitle();
    ok(await b.evaluate(`!!document.querySelector('.composer .then') && document.querySelector('.composer .chips .chip').classList.contains('on')`), 'clicking the chip marks it and offers what can follow it');
    ok(await b.evaluate(`document.querySelector('.composer .then select').value`) === 'Any', 'a custom state (a value of any type) is read as Any until the person says');
    const per = {};
    for (const t of TYPES) {
      await asType(t); const got = await offered();
      per[t] = got.length;
      const want = phrasesFor(rows, t).map((p) => p.bubble);
      ok(JSON.stringify(got) === JSON.stringify(want), `as ${t}: exactly that type's ${want.length} rows (with the Any ones)`, { got: got.slice(0, 6), want: want.slice(0, 6) });
      await b.evaluate(`document.querySelector('.menu.phrases')?.remove()`);
    }
    await asType('String'); await offered();
    await shot('composer-then-menu');
    await clickText('.menu.phrases .item', ':uppercase'); await wait(150);
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'js').click()`); await wait(100);
    const upper = await b.evaluate(`document.querySelector('.composer textarea').value`);
    ok(/^(\w+)\.toUpperCase\(\) \+ " world"\s*$/.test(upper), 'a text\'s :uppercase wraps the chip where it stands: [state].toUpperCase() + " world"', upper);
    let n0 = await shows();
    await clickText('.composer .foot button', 'Save'); await rebuilt(n0); await wait(600);
    ok((await appText()).includes('HELLO world'), 'saved, the app shows "HELLO world"', { text: (await appText()).slice(0, 80) });
    // a phrase with a second value leaves a slot; filled from the ⚡ list, it is a chip like any other
    await openOnTitle(); await asType('String'); await offered();
    await clickText('.menu.phrases .item', '... is ...'); await wait(150);
    const slot = await b.evaluate(`(() => { const s = document.querySelector('.composer .chips .chip.slot'); return s && { text: s.textContent, note: document.querySelector('.composer .foot .note').textContent }; })()`);
    ok(slot?.text === '▢ text' && /^Fill the empty slot \(text\)/.test(slot.note), ':is leaves an empty text slot, and the note asks for it', slot);
    await shot('composer-slot');
    await b.evaluate(`document.querySelector('.composer .chips .chip.slot').click()`); await wait(250);
    await menuItem("Sign-in card's state");
    await b.evaluate(`[...document.querySelectorAll('.composer .seg button')].find(b => b.dataset.m === 'js').click()`); await wait(100);
    const filled = await b.evaluate(`document.querySelector('.composer textarea').value`);
    ok(/^\((\w+)\.toUpperCase\(\) === (\w+)\) \+ " world"\s*$/.test(filled) && !/\btext\b/.test(filled), 'the slot is filled with the state, a second chip: ([state].toUpperCase() === [state]) + " world"', filled);
    n0 = await shows();
    await clickText('.composer .foot button', 'Save'); await rebuilt(n0); await wait(600);
    ok((await appText()).includes('false world'), 'saved, the app shows "false world" ("HELLO" is not "Hello")', { text: (await appText()).slice(0, 80) });
  }
  console.log('check: Workflow');
  await b.clickSel('[data-tab=workflow]'); await wait(300);
  const evRow = (id, port = 'Click') => `[...document.querySelectorAll('#events .row[data-node=${JSON.stringify(id)}]')].find(r => r.querySelector('small').textContent.startsWith(${JSON.stringify('When ' + port)}))`;
  const events = JSON.parse(await b.evaluate('JSON.stringify([...document.querySelectorAll("#events .row")].map(r => r.dataset.node))'));
  ok(events.includes(signInBtn) && events.includes(createBtn), 'the sign-in page lists its button events', events);
  await b.evaluate(`${evRow(signInBtn)}.click()`); await wait(300);
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
    const cardHead = async () => JSON.parse(await b.evaluate(`JSON.stringify({ name: document.querySelector('#steps .event-card h2')?.textContent, trigger: document.querySelector('#steps .event-card small')?.textContent, row: document.querySelector('#events .row[aria-selected=true] span')?.textContent })`));
    const draft = await cardHead();
    ok(draft.name === 'No steps yet' && /^When Sign-in card: /.test(draft.trigger), 'STU-023: a new workflow with no steps and no name says so; the event is the line under it', draft);
    await b.clickSel('#steps .event-card .rename'); await wait(200);
    await b.evaluate(`document.querySelector('#steps .event-card input.cardname').value = ''`);
    await b.type('Check the card'); await b.key('Enter', 'Enter', 13); await wait(400);
    const named = await cardHead();
    const namesOnDisk = () => onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === card)?.metadata?.cardNames || {};
    ok(named.name === 'Check the card' && named.row === 'Check the card' && Object.values(namesOnDisk()).includes('Check the card'), 'STU-023: Rename names the card, in its head and in the list, and the name is kept on the element on disk (metadata.cardNames)', { named, onDisk: namesOnDisk() });
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
    await menuItem("Sign-in card's state");
    // the same wait for the file as the branch above (read 500 ms in, it missed the save 1 run of several)
    let setV;
    for (const t0 = Date.now(); Date.now() - t0 < 5000; await wait(150)) {
      wires = onDisk(SIGN + 'connections.json').connections; nodes = onDisk(SIGN + 'nodes.json').nodes;
      setV = nodes.find((n) => n.type === 'Set Variable' && wires.some((w) => w.fromId === cond.id && w.fromProperty === 'ontrue' && w.toId === n.id && w.toProperty === 'do'));
      if (setV) break;
    }
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
    // a named card keeps its name through the steps added since; emptied, it reads its steps again (the branch, by its test)
    const kept = await cardHead();
    ok(kept.name === 'Check the card' && Object.values(namesOnDisk()).includes('Check the card'), 'STU-023: a renamed card keeps its name after a branch and two steps are added to it', kept);
    await b.clickSel('#steps .event-card .rename'); await wait(200);
    await b.evaluate(`document.querySelector('#steps .event-card input.cardname').value = ''`);
    await b.key('Enter', 'Enter', 13); await wait(400);
    const unnamed = await cardHead();
    ok(/^(If |Branch)/.test(unnamed.name || '') && !Object.values(namesOnDisk()).includes('Check the card'), 'STU-023: an emptied name gives the card back to its steps, and the name leaves the file', { unnamed, onDisk: namesOnDisk() });
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
  console.log('check: the panel as Bubble draws it, the page as its parts (STU-051, STU-050)');
  {
    await b.clickSel('[data-tab=design]'); await wait(300);
    const bySign = (label) => sign.nodes.nodes.find((n) => n.label === label).id;
    const buttons = bySign('Buttons'), email = bySign('Email');
    const inFrame = (id, prop) => b.evaluate(`__ob.preview.frame.contentWindow.getComputedStyle(__ob.preview.elementsOf(${JSON.stringify(id)})[0])[${JSON.stringify(prop)}]`);
    const sec = (title) => `[...document.querySelectorAll('#right .sec2')].find(d => d.querySelector('summary').textContent.startsWith(${JSON.stringify(title)}))`;
    const rowIn = (label) => `[...document.querySelectorAll('#right .sec2 .field')].find(f => f.querySelector('label')?.textContent === ${JSON.stringify(label)})`;
    // the shape: Bubble's sections in Bubble's order, and outside Content, Configure and More not one bare text field
    const shape = async () => JSON.parse(await b.evaluate(`JSON.stringify({ more: [...([...document.querySelectorAll('#right .sec2')].find(d => d.querySelector('summary').firstChild.textContent === 'More')?.querySelectorAll('.field > label') ?? [])].map(l => l.textContent), secs: [...document.querySelectorAll('#right .sec2 > summary')].map(s => s.firstChild.textContent), bare: [...document.querySelectorAll('#right .sec2 input[type=text], #right .sec2 textarea')].filter(i => !i.closest('.len') && !['Content', 'Configure', 'More'].includes(i.closest('.sec2').querySelector('summary').firstChild.textContent)).map(i => i.closest('.field')?.querySelector('label')?.textContent || i.placeholder) })`));
    const order = ['Content', 'Configure', 'Size', 'Layout', 'Style', 'Text', 'Label text', 'Appearance', 'Border', 'Background', 'Shadow', 'More'];
    for (const [id, what] of [[card, 'a Group'], [title1, 'a Text'], [signInBtn, 'a Button'], [email, 'a Text Input']]) {
      if (id === card) await clickText('#tree .row', 'Sign-in card'); else await select(id);
      await wait(400);
      const sh = await shape();
      ok(sh.secs.length >= 5 && sh.secs.every((t, i, a) => i === 0 || order.indexOf(a[i - 1]) < order.indexOf(t)) && sh.bare.length === 0, `${what}: Bubble's sections in Bubble's order, every value outside Content and More edited through a typed control`, sh);
      ok(!sh.secs.includes('More'), `${what}: nothing is left in More`, sh.more);
    }
    // a token-valued colour reads as the token's name, and its swatch is the colour the app draws
    await clickText('#tree .row', 'Sign-in card'); await wait(400);
    const bg = JSON.parse(await b.evaluate(`JSON.stringify({ name: ${sec('Background')}.querySelector('.cname').textContent, swatch: getComputedStyle(${sec('Background')}.querySelector('.swatch')).backgroundColor })`));
    ok(bg.name === 'Surface' && bg.swatch === await inFrame(card, 'backgroundColor'), 'the card\'s background var(--surface) reads "Surface", its swatch the colour the app draws', { ...bg, drawn: await inFrame(card, 'backgroundColor') });
    const padTxt = await b.evaluate(`${rowIn('Padding')}.querySelector('input').value`);
    ok(padTxt === 'space-6', 'a spacing token reads as its name', padTxt);
    await shot('panel-group');
    // the padding pair ↔ writes left and right
    let n0 = await shows();
    await b.evaluate(`(() => { const i = ${rowIn('Padding')}.querySelectorAll('.two input')[1]; i.value = '24'; i.dispatchEvent(new Event('change')); })()`); await rebuilt(n0);
    let cp = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === card).parameters;
    ok(cp.paddingLeft?.value === 24 && cp.paddingRight?.value === 24 && cp.paddingTop === 'var(--space-6)' && (await inFrame(card, 'paddingLeft')) === '24px', 'Padding ↔ 24 writes left and right, keeps top, and the app draws it', { l: cp.paddingLeft, t: cp.paddingTop });
    n0 = await shows();
    await b.evaluate(`(() => { const i = ${rowIn('Padding')}.querySelectorAll('.two input')[1]; i.value = 'space-6'; i.dispatchEvent(new Event('change')); })()`); await rebuilt(n0);
    cp = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === card).parameters;
    ok(cp.paddingLeft === 'var(--space-6)' && cp.paddingRight === 'var(--space-6)', 'a token typed by its name is written as the token', cp.paddingLeft);
    // Border, added and removed whole, on the button row
    await b.evaluate(`(() => { const r = [...document.querySelectorAll('#tree .row')].find(e => e.textContent.startsWith('Sign-in card')); const c = r.querySelector('.chev'); if (!c.classList.contains('open')) c.click(); })()`); await wait(300);
    await clickText('#tree .row', 'Buttons'); await wait(400);
    n0 = await shows();
    await b.evaluate(`${sec('Border')}.querySelector('summary .acts button').click()`); await rebuilt(n0);
    let bp = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === buttons).parameters;
    ok(bp.borderStyle === 'solid' && bp.borderWidth?.value === 1 && (await inFrame(buttons, 'borderTopWidth')) === '1px', '+ on Border adds a solid 1 px border the app draws', { style: bp.borderStyle, drawn: await inFrame(buttons, 'borderTopWidth') });

    n0 = await shows();
    await b.evaluate(`${sec('Border')}.querySelector('summary .acts button').click()`); await rebuilt(n0);
    bp = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === buttons).parameters;
    ok(bp.borderStyle === undefined && bp.borderWidth === undefined && (await inFrame(buttons, 'borderTopWidth')) === '0px', '− takes it off the file and the app', { style: bp.borderStyle });
    // the container layout, Row → Column → Row
    for (const want of ['column', 'row']) {
      n0 = await shows();
      await b.evaluate(`[...${sec('Layout')}.querySelectorAll('.segctl button')].find(x => x.textContent.includes(${JSON.stringify(want === 'row' ? 'Row' : 'Column')})).click()`); await rebuilt(n0);
      ok(onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === buttons).parameters.flexDirection === want && (await inFrame(buttons, 'flexDirection')) === want, `Container layout → ${want} is written and drawn`);
    }
    // Width → Fill on a button: 100 %, and the app draws it wider
    await select(createBtn);
    const w0 = await centreOf(createBtn);
    n0 = await shows();
    await b.evaluate(`(() => { const s = ${rowIn('Width')}.querySelector('select'); s.value = 'fill'; s.dispatchEvent(new Event('change')); })()`); await rebuilt(n0);
    const w1 = await centreOf(createBtn), cw = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === createBtn).parameters.width;
    ok(cw?.value === 100 && cw?.unit === '%' && w1.w > w0.w, 'Width → Fill writes 100 % and the app draws the button wider', { width: cw, before: w0.w, after: w1.w });
    // a colour from the app's tokens: written as the token, drawn as it
    await select(title1);
    await b.evaluate(`${sec('Text')}.querySelector('.cbtn').scrollIntoView({ block: 'center' })`); await wait(150);
    await b.clickSel('#right .sec2 .cbtn'); await wait(300);
    const tokenCells = await b.evaluate(`[...[...document.querySelectorAll('.menu.colours .cgrid')].find(g => g.previousElementSibling?.textContent === 'Tokens')?.querySelectorAll('.cell') ?? []].map(c => c.title)`);
    n0 = await shows();
    await b.evaluate(`[...document.querySelectorAll('.menu.colours .cgrid .cell')].find(c => c.title === 'Primary').click()`); await rebuilt(n0);
    const tColour = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === title1).parameters.color;
    const primary = await b.evaluate(`getComputedStyle(__ob.preview.frame.contentDocument.documentElement).getPropertyValue('--primary').trim()`);
    const drawnTitle = await inFrame(title1, 'color');
    ok(tokenCells.includes('Primary') && tokenCells.includes('Surface') && tColour === 'var(--primary)' && (await b.evaluate(`${sec('Text')}.querySelector('.cname').textContent`)) === 'Primary', 'the picker lists the app\'s tokens by name (its own and NodeGX\'s); picking Primary writes var(--primary) and the chip reads Primary', { cells: tokenCells.length, written: tColour, primary, drawn: drawnTitle });
    n0 = await shows(); await b.evaluate(`(() => { const s = ${sec('Text')}.querySelector('.cbtn'); s.click(); })()`); await wait(250);
    await b.evaluate(`[...document.querySelectorAll('.menu.colours .cgrid .cell')].find(c => c.title === 'Foreground').click()`); await rebuilt(n0);
    // an Image: the panel's shape, and its picture through the image popover — uploaded into assets/, picked, cleared
    {
      n0 = await shows();
      await clickText('#palette button', 'Image');
      const at = await centreOf(title1); await b.click(at.x, at.y); await rebuilt(n0);
      const imgNode = () => onDisk(SIGN + 'nodes.json').nodes.find((n) => n.type === 'Image' && n.parent === card);
      const imgId = imgNode()?.id;
      await select(imgId); await wait(300);
      const sh = await shape();
      ok(imgId && sh.secs.every((t, i, a) => i === 0 || order.indexOf(a[i - 1]) < order.indexOf(t)) && sh.bare.length === 0 && (await b.evaluate(`!!document.querySelector('#right [data-image=src]')`)), 'an Image: Bubble\'s sections in order, every value a typed control, its source an image chip', sh);
      ok(!sh.secs.includes('More'), 'an Image: nothing is left in More', sh.more);
      const upload = (name) => b.evaluate(`(() => { const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], ${JSON.stringify(name)}, { type: 'image/png' })); const i = document.querySelector('.menu.images input[type=file]'); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);
      const openPicker = async () => { await b.evaluate(`document.querySelector('#right [data-image=src]').click()`); await b.until('document.querySelector(".menu.images")', 4000); };
      await openPicker();
      n0 = await shows(); await upload('dot.png'); await rebuilt(n0); await wait(300);
      const drawn = () => b.evaluate(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(imgId)})[0]; const im = el?.tagName === 'IMG' ? el : el?.querySelector('img'); return im ? { src: im.getAttribute('src'), w: im.naturalWidth, done: im.complete } : null; })()`);
      let d = await drawn();
      for (const t0 = Date.now(); Date.now() - t0 < 3000 && !(d?.w > 0); await wait(150)) d = await drawn();
      ok(imgNode()?.parameters.src === 'assets/dot.png' && existsSync(join(project, 'assets/dot.png')) && d?.w === 1, 'Upload an image… copies it into the project\'s assets/, the Image\'s source says so, and the app loads it', { src: imgNode()?.parameters.src, drawn: d });
      await openPicker();
      await b.until(`document.querySelector('.menu.images .igrid .cell[data-path="assets/dot.png"]')`, 4000);
      n0 = await shows(); await upload('dot.png'); await rebuilt(n0);
      ok(imgNode()?.parameters.src === 'assets/dot-1.png' && existsSync(join(project, 'assets/dot.png')), 'the same name again is made unique before the extension (dot-1.png), the first kept', imgNode()?.parameters.src);
      await openPicker();
      await b.until(`document.querySelector('.menu.images .igrid .cell[data-path="assets/dot.png"]')`, 4000);
      n0 = await shows(); await b.evaluate(`document.querySelector('.menu.images .igrid .cell[data-path="assets/dot.png"]').click()`); await rebuilt(n0);
      ok(imgNode()?.parameters.src === 'assets/dot.png' && (await b.evaluate(`document.querySelector('#right [data-image=src] .cname').textContent`)) === 'dot.png', 'the project\'s images are listed; picking one writes it, and the chip names it', imgNode()?.parameters.src);
      await openPicker();
      n0 = await shows(); await clickText('.menu.images .iacts button', 'No image'); await rebuilt(n0);
      ok(imgNode() && imgNode().parameters.src === undefined && (await b.evaluate(`document.querySelector('#right [data-image=src] .cname').textContent`)) === 'No image', 'No image clears the source', imgNode()?.parameters);
      n0 = await shows(); await b.evaluate('document.activeElement && document.activeElement.blur()'); await b.key('Delete', 'Delete', 46); await rebuilt(n0);
      ok(!imgNode(), 'and the Image is deleted again');
    }
    // Offset (NodeGX's Pos X), from More into Appearance: written as a length, drawn as the element moved
    await select(title1);
    await b.evaluate(`(() => { const d = ${sec('Appearance')}; d.open = true; })()`); await wait(200);
    n0 = await shows();
    await b.evaluate(`(() => { const i = ${rowIn('Offset')}.querySelectorAll('input')[0]; i.value = '12'; i.dispatchEvent(new Event('change')); })()`); await rebuilt(n0);
    const tx = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === title1).parameters.transformX, drawnTx = await inFrame(title1, 'transform');
    ok(tx?.value === 12 && tx?.unit === 'px' && /matrix\(1, 0, 0, 1, 12, 0\)/.test(drawnTx), 'Offset X 12 on the title: the file says 12 px, the app draws it moved 12 px', { tx, drawnTx });
    n0 = await shows();
    await b.evaluate(`(() => { const i = ${rowIn('Offset')}.querySelectorAll('input')[0]; i.value = ''; i.dispatchEvent(new Event('change')); })()`); await rebuilt(n0);
    // the Interaction tab: the Sign in button's workflow is listed there, and opens in Workflow
    await select(signInBtn);
    await clickText('#right .ptabs button', 'Interaction'); await wait(250);
    const wfs = await b.evaluate(`[...document.querySelectorAll('#right .row.wf')].map(r => r.textContent)`);
    ok(wfs.length >= 1 && wfs.every((t) => /When /.test(t)), 'the Interaction tab lists the workflows that start at the element', wfs);
    {
      // STU-020: the elements that should wear a ⚡, read off the file and the runtime's own node library (not Studio's
      // reading of events): a drawn element with a wire into another node's signal input. Email's Text Changed goes only
      // into values (Log In's username), so Email wears none.
      const expected = JSON.parse(await b.evaluate(`JSON.stringify((() => {
        const lib = new Map(__ob.preview.nodeLibrary.nodetypes.map(t => [t.name, t]));
        const nodes = new Map(${JSON.stringify(onDisk(SIGN + 'nodes.json').nodes)}.map(n => [n.id, n]));
        const signalIn = (type, port) => { const t = lib.get(type); return !!t && [...(t.ports || []), ...(t.dynamicports || []).flatMap(d => d.ports || [])].some(p => p.name === port && p.plug !== 'output' && (p.type === 'signal' || p.type?.name === 'signal')); };
        const out = new Set();
        for (const w of ${JSON.stringify(onDisk(SIGN + 'connections.json').connections)}) {
          const el = __ob.preview.elementsOf(w.fromId)[0]; const to = nodes.get(w.toId);
          if (el && el.getBoundingClientRect().width && to && signalIn(to.type, w.toProperty)) out.add(w.fromId);
        }
        return [...out].sort();
      })())`));
      const onCanvas = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('#overlay .bolt.oncanvas')].map(e => e.dataset.node).sort())`));
      const email = sign.nodes.nodes.find((n) => n.label === 'Email')?.id;
      ok(expected.includes(signInBtn) && expected.includes(createBtn) && expected.includes(card) && JSON.stringify(onCanvas) === JSON.stringify(expected) && !onCanvas.includes(email) && !onCanvas.includes(title1),
        'STU-020: every drawn element with a workflow wears a ⚡ on the canvas, and no other does (Email\'s value-only wire, the title: none)', { expected: expected.length, onCanvas: onCanvas.length, missing: expected.filter((x) => !onCanvas.includes(x)), extra: onCanvas.filter((x) => !expected.includes(x)) });
      // by the element the badge belongs to: the page itself is also called "Sign in", and wears one for its Did Mount
      const rowBolt = (id) => `document.querySelector('#tree .row .bolt[data-node=${JSON.stringify(id)}]')`;
      const inList = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('#tree .row .bolt')].map(e => e.dataset.node))`));
      ok(inList.includes(signInBtn) && inList.includes(createBtn) && !inList.includes(title1) && !inList.includes(email) && inList.every((x) => expected.includes(x)), 'STU-020: the element list wears the same ⚡ on the Sign in and Create account rows, none on App name or Email', inList);
      // the hover: the Sign in click's steps in order (the card below reads the same order)
      await b.evaluate(`document.querySelector('#overlay .bolt.oncanvas[data-node=${JSON.stringify(signInBtn)}]').dispatchEvent(new MouseEvent('mouseenter'))`);
      const tip = await b.evaluate(`document.getElementById('bolttip')?.textContent || ''`);
      // STU-021: a click on the badge opens the card alone, full screen; Back returns to the element, selected
      const at = await b.evaluate(`(() => { const r = document.querySelector('#overlay .bolt.oncanvas[data-node=${JSON.stringify(signInBtn)}]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      await b.click(at.x, at.y); await wait(400);
      const card1 = JSON.parse(await b.evaluate(`JSON.stringify({ shown: !document.getElementById('workflow').hidden, full: document.getElementById('workflow').classList.contains('card'), list: document.querySelector('#workflow > aside').offsetWidth, title: document.querySelector('#steps .event-card h2')?.textContent, trigger: document.querySelector('#steps .event-card small')?.textContent, steps: [...(document.querySelector('#steps .lanes .lane') || document).querySelectorAll('#steps .step h3 span')].map(s => s.textContent), lanes: [...document.querySelectorAll('#steps .lanes > .lane')].map(l => [...l.querySelectorAll('.step h3 span')].map(s => s.textContent)), branchLane: [...document.querySelectorAll('#steps .lanes > .lane')].map(l => !!l.querySelector(':scope > .chain > .step.cond')), back: document.querySelector('#steps .cardnav .back')?.textContent })`));
      ok(card1.steps.length >= 2 && tip.includes(`Click${card1.steps.slice(0, 1)} (+1 more) → ${card1.steps.slice(1).join(' → ')}`), 'STU-020: hovering the Sign in ⚡ names its steps in the order its card draws them', { tip, steps: card1.steps });
      ok(card1.shown && card1.full && card1.list === 0 && /^When Sign in: Click/.test(card1.trigger || '') && /Sign in/.test(card1.back || ''), 'STU-021: clicking the ⚡ on the canvas opens that event\'s card full screen (no list beside it), with the way back', card1);
      // STU-023: a card nobody named reads its steps (up to three; past that the first two, "…", the last)
      const fromSteps = (card1.steps.length > 3 ? [card1.steps[0], card1.steps[1], '…', card1.steps.at(-1)] : card1.steps).join(' → ');
      ok(card1.steps.length >= 2 && card1.title === fromSteps, 'STU-023: the Sign in click\'s card, never named, is named by its steps', { title: card1.title, steps: card1.steps });
      // STU-024: the Sign in click is wired to two first steps (Log In, and the branch that puts the old error away): two lanes,
      // side by side, read off the file (wires from the button's Click into a signal input), not off Studio
      const firstSteps = onDisk(SIGN + 'connections.json').connections.filter((w) => w.fromId === signInBtn && w.fromProperty === 'onClick' && /^(login|eval|do|signup|navigate|run)$/.test(w.toProperty)); // the runtime's signal inputs these node types take
      ok(firstSteps.length === 2 && card1.lanes.length === 2 && card1.lanes[0][0] === card1.steps[0] && JSON.stringify(card1.branchLane) === '[false,true]', 'STU-024: an event wired to two first steps (Log In, and the branch that puts the old error away) shows two lanes side by side, each its own chain', { wires: firstSteps.map((w) => w.toProperty), lanes: card1.lanes, branchLane: card1.branchLane });
      await shot('workflow-card');
      await b.clickSel('#steps .cardnav .back'); await wait(400);
      const back1 = JSON.parse(await b.evaluate(`JSON.stringify({ design: !document.getElementById('design').hidden, name: document.querySelector('#right .head input')?.value, box: !!document.querySelector('#overlay .box.sel') })`));
      ok(back1.design && back1.name === 'Sign in' && back1.box, 'STU-021: Back returns to Design with the Sign in button selected', back1);
      // from the list: the Create account row's ⚡, and Esc as the way back
      await b.evaluate(`${rowBolt(createBtn)}.scrollIntoView({ block: 'nearest' })`);
      const at2 = await b.evaluate(`(() => { const r = ${rowBolt(createBtn)}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      await b.click(at2.x, at2.y); await wait(400);
      const title2 = await b.evaluate(`!document.getElementById('workflow').hidden && document.getElementById('workflow').classList.contains('card') ? document.querySelector('#steps .event-card small')?.textContent : null`);
      await b.key('Escape', 'Escape', 27); await wait(400);
      const back2 = JSON.parse(await b.evaluate(`JSON.stringify({ design: !document.getElementById('design').hidden, name: document.querySelector('#right .head input')?.value })`));
      ok(/^When Create account: Click/.test(title2 || '') && back2.design && back2.name === 'Create account', 'STU-021: the ⚡ on a row of the element list opens its card; Esc returns to the element', { title2, back2 });
      await select(signInBtn);
    }
    await clickText('#right .ptabs button', 'Visual'); await wait(250);
    // STU-050: the page as its parts; a part opened lists only what it holds
    const rest = await b.evaluate(`document.querySelectorAll('#tree .row').length`);
    await b.evaluate(`(() => { const r = [...document.querySelectorAll('#tree .row')].find(e => e.textContent.startsWith('Sign-in card')); r.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`); await wait(300);
    const inside = JSON.parse(await b.evaluate(`JSON.stringify({ crumbs: !!document.querySelector('#tree .crumbs'), rows: [...document.querySelectorAll('#tree .row')].map(r => r.querySelector('.seg')?.textContent) })`));
    ok(inside.crumbs && inside.rows[0] === 'Sign-in card' && !inside.rows.includes('Top right'), 'double-clicking a part lists only what it holds, with the way back', inside);
    await b.evaluate(`document.querySelector('#tree .crumbs button').click()`); await wait(300);
    ok((await b.evaluate(`!document.querySelector('#tree .crumbs')`)), '← goes back to the whole page', rest);
    ok((b.problems || []).filter((p) => !/Invalid connection|doesn't have a port|Failed to load resource|fonts\.g|^\[noodl\]/.test(p)).length === 0, 'no exceptions while the panel was used', b.problems.slice(-3));
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
    const bundle = kit.mcpServer;
    ok(reg?.type === 'stdio' && reg.args?.[0] === bundle && reg.args?.[1] === project && reg.args?.[2] === '--allow-writes' && Object.keys(mcp.mcpServers).length === 1, 'the button writes .mcp.json registering Studio\'s NodeGX MCP server for this folder as nodegx-<folder>', reg);
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
      const at = await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Text'); const btn = f?.querySelector('.bolt'); if (!btn) return null; btn.scrollIntoView({ block: 'nearest' }); const r = btn.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
      if (!at) throw new Error(`no ⚡ on the Text field of ${id}`);
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
    // the same question from a field's "⚡ → New page data…" (Bubble's "Do a search for")
    const btn = onDisk(SIGN + 'nodes.json').nodes.find((n) => n.type === 'net.noodl.controls.button' && n.parameters?.label === 'Button')?.id;
    // the item just made rebuilds the app: a click before it is back can land on the old frame (no ⚡ found, 1 run)
    await b.until(`!document.getElementById("status").textContent.startsWith("Rebuilding")`, 30000); await wait(400);
    await select(btn);
    const at = await b.evaluate(`(() => { const f = [...document.querySelectorAll('#right .field')].find((f) => f.querySelector('label')?.textContent === 'Label'); const btn = f?.querySelector('.bolt'); if (!btn) return null; btn.scrollIntoView({ block: 'nearest' }); const r = btn.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!at) throw new Error('no ⚡ on the button\'s Label');
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
    await b.evaluate(`${evRow(signInBtn)}.click()`); await wait(300);
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
  console.log('check: a reusable opened on its own (STU-015)');
  {
    const PANEL = 'components/Reusable/Probe panel/';
    const offered = await b.evaluate(`[...document.querySelectorAll('#pagepick optgroup option')].map(o => o.value)`);
    ok(offered.includes('Reusable/Probe panel') && !offered.some((k) => k.startsWith('Pages/')), 'the page picker lists the reusables after the pages', offered);
    // the template's Commands and Logic say "visual" in the registry and draw nothing; a Command holds a Write history copy
    const palette = await b.evaluate(`[...document.querySelectorAll('#components button')].map(b => b.title)`);
    const logicOnes = ['Commands/Add task', 'Commands/Close task', 'Logic/Write history', 'Logic/Todo data'];
    ok(palette.includes('Todo/Task row') && offered.includes('Todo/Task row') && !logicOnes.some((k) => palette.includes(k) || offered.includes(k)), 'components that draw nothing (Commands, Logic) are not offered as reusable elements', { palette, offered });
    let n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Reusable/Probe panel'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0); await wait(600);
    const on = JSON.parse(await b.evaluate(`JSON.stringify({ page: __ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context.rootComponent.nodeScope.getNodesWithTypeRecursive('Router')[0]._internal.currentPage?.component, queries: document.getElementById('querycount').textContent, title: document.getElementById('elements-title').textContent, rows: [...document.querySelectorAll('#tree .row')].map(r => r.querySelector('.seg')?.textContent), drawn: __ob.preview.elementsOf('ppText').length, copies: (__ob.preview.frame.contentDocument.body.innerText.match(/probe panel/g) || []).length })`));
    ok(on.page === '/__studio/Reusable canvas' && /when shown/.test(on.queries) && on.title === 'Elements in this reusable' && on.rows.join() === 'Panel,Probe text' && on.drawn === 1 && on.copies === 1, 'opened, Design lists the reusable\'s own elements and the app shows one copy of it alone, on Studio\'s canvas page (its queries counted "when shown")', on);
    // the canvas's copy is given what the first copy on a page is (pr1, n = 1): its Task query asks "position > 1"
    const canvasAsked = JSON.parse(await b.evaluate(`JSON.stringify((__ob.preview.frame.contentWindow.__studioLog || []).filter(e => e.kind === 'request' && /\\/classes\\/Task$/.test(e.path || '') && e.body?._method === 'GET').map(e => e.body.where?.position?.$gt))`));
    ok(canvasAsked.join() === '1', 'the canvas\'s copy shows the first copy\'s values (its query asks with n = 1, as Probe 1 does)', canvasAsked);
    ok(!existsSync(join(project, 'components/__studio')) && !readFileSync(join(project, 'components/App/nodes.json'), 'utf8').includes('__studio'), 'the canvas page is Studio\'s: not in the project folder, not in its router');
    await select('ppText');
    ok((await b.evaluate('document.querySelector("#right .head input")?.value')) === 'Probe text', 'clicking its text in the canvas selects it');
    // data made here is the reusable's, in STU-014's form
    const formIn = async (sel, value, ev = 'input') => b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); })()`);
    await b.clickSel('#newpagedata');
    await b.until('document.querySelector(".menu.newitem")', 4000);
    await formIn('.menu.newitem input[aria-label=Name]', 'panel notes');
    await formIn('.menu.newitem select[aria-label=Type]', 'Note', 'change');
    await formIn('.menu.newitem input[aria-label="Where field"]', 'body');
    await formIn('.menu.newitem select[aria-label="Where operator"]', 'exists', 'change');
    await clickText('.menu.newitem .foot button', 'Create'); await wait(800);
    let item;
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && !item; await wait(150)) {
      const pn = onDisk(PANEL + 'nodes.json').nodes, pc = onDisk(PANEL + 'connections.json').connections;
      item = readItems(pn, pc).find((i) => i.name === 'panel notes');
    }
    const signHas = onDisk(SIGN + 'nodes.json').nodes.some((n) => n.metadata?.pageData?.name === 'panel notes');
    ok(item?.whenShown && item.shownId && item.askId && !signHas, 'New data on the reusable is written into the reusable, asking while a copy is shown (STU-014\'s form), not into a page', { whenShown: item?.whenShown, shownId: item?.shownId, askId: item?.askId, signHas });
    // back on Sign in: the copies there that are shown each ask it once (1 and 2; 3 is hidden, 4 is in a hidden group).
    // Counted from here: the canvas's own copy has asked it too, in the same frame
    await b.until(`document.getElementById("status").textContent.startsWith("App on screen")`, 30000); await wait(1500);
    const noteAsks = `(__ob.preview.frame.contentWindow.__studioLog || []).filter(e => e.kind === 'request' && /\\/classes\\/Note$/.test(e.path || '') && e.body?._method === 'GET' && e.body.where?.body).length`;
    const onCanvas = await b.evaluate(noteAsks);
    const nBack = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sign in'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(nBack); await wait(1500);
    const frame = await b.evaluate(`__ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context.rootComponent.nodeScope.getNodesWithTypeRecursive('Router')[0]._internal.currentPage?.component`);
    const panelAsks = await b.evaluate(noteAsks); // a fresh frame: going back is a rebuild that starts on Sign in
    ok(onCanvas === 1 && frame === '/Pages/Sign in' && panelAsks === 2, 'the canvas\'s copy asks it once; on the page, the two shown copies ask it once each and the hidden two not at all', { onCanvas, frame, panelAsks });
  }
  console.log('check: the Conditional tab (STU-051)');
  {
    const ruleText = () => onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === 'ruleTop')?.parameters.expression;
    const topMargin = () => b.evaluate(`getComputedStyle(__ob.preview.elementsOf('siTop')[0]).marginTop`);
    const tab = (name) => clickText('.ptabs button', name).then(() => wait(300));
    await clickText('#tree .row', 'Top right'); await wait(300);
    ok(await b.evaluate(`!!document.querySelector('#right .rulechip')`), 'in Visual, the margin a rule sets reads as a rule and not as the Expression\'s name');
    await tab('Conditional');
    const card = JSON.parse(await b.evaluate(`JSON.stringify({ count: document.querySelector('.ptabs button[aria-pressed=true] .count')?.textContent, head: document.querySelector('#right details.rule summary')?.textContent, rows: [...document.querySelectorAll('#right details.rule .field')].map(f => [f.querySelector('label').textContent, f.querySelector('input, select')?.value]) })`));
    ok(card.count === '1' && /When.*Screen's Width.*<.*100000/.test(card.head) && JSON.stringify(card.rows) === JSON.stringify([['Margin Top', '24'], ['otherwise', '8']]), 'the tab lists the rule by its condition, the property, its value and the otherwise', card);
    ok((await topMargin()) === '24px', 'the app draws the rule\'s value (24 px: the screen is narrower than 100000)', await topMargin());
    let n0 = await shows();
    await b.evaluate(`(() => { const i = document.querySelector('#right details.rule .field input'); i.value = '40'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await rebuilt(n0); await wait(600);
    ok(ruleText() === '(w < 100000) ? 40 : 8' && (await topMargin()) === '40px', 'the value changed in the tab: the Expression says 40, and the app draws 40 px', { text: ruleText(), drawn: await topMargin() });
    // a new rule on the same property: its condition composed, the property picked; it chains, the newest first
    await b.clickSel('#newrule'); await b.until('document.querySelector(".menu.composer")', 4000);
    await b.clickSel('.menu.composer [data-m=js]'); await wait(200);
    await b.evaluate(`(() => { const t = document.querySelector('.menu.composer textarea'); t.value = '1 > 2'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText('.menu.composer .foot button', 'Save'); await b.until('document.querySelector(".menu.ruleprops")', 4000);
    n0 = await shows();
    await b.clickSel('.menu.ruleprops .item[data-port=marginTop]');
    await rebuilt(n0); await wait(600);
    const wires = onDisk(SIGN + 'connections.json').connections.filter((c) => c.toId === 'siTop' && c.toProperty === 'marginTop').length;
    const cards = await b.evaluate(`document.querySelectorAll('#right details.rule').length`);
    ok(/^\(1 > 2\) \? [^:]+ : \(w < 100000\) \? 40 : 8$/.test(ruleText()) && wires === 1 && cards === 2 && (await topMargin()) === '40px', 'a second rule on the margin is the first arm of the same Expression (one wire), a second card; it does not hold, so 40 px still', { text: ruleText(), wires, cards, drawn: await topMargin() });
    n0 = await shows();
    await b.clickSel('#right button[aria-label="Remove rule 1"]');
    await rebuilt(n0); await wait(600);
    ok(ruleText() === '(w < 100000) ? 40 : 8' && (await b.evaluate(`document.querySelectorAll('#right details.rule').length`)) === 1, 'the new rule removed: the Expression is the first rule again', ruleText());
    // the hover look on Create account: listed, and removed from the tab
    await select('siCreate');
    if (!(await b.evaluate(`document.querySelector('.ptabs button[aria-pressed=true]')?.textContent.startsWith('Conditional')`))) await tab('Conditional');
    const hover = await b.evaluate(`[...document.querySelectorAll('#right details')].map(d => d.querySelector('summary').textContent).join(' | ')`);
    ok(/When hovered/.test(hover), 'its hover look is listed as "When hovered"', hover);
    n0 = await shows();
    await b.evaluate(`[...document.querySelectorAll('#right details')].find(d => /When hovered/.test(d.querySelector('summary').textContent)).querySelector('.field > button').click()`);
    await rebuilt(n0); await wait(400);
    ok(!onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === 'siCreate').stateParameters, 'taking its one hover value out removes the hover look from the file', onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === 'siCreate').stateParameters);
    // a new look, from the tab: the states its type has, then the properties its type lets a state change
    const look = () => onDisk(SIGN + 'nodes.json').nodes.find((n) => n.id === 'siCreate').stateParameters;
    const drawnBg = () => b.evaluate(`getComputedStyle(__ob.preview.elementsOf('siCreate')[0]).backgroundColor`);
    const inState = (states) => b.evaluate(`(() => { const r = __ob.preview.frame.contentWindow.Noodl.Navigation._noodlRuntime.context.rootComponent.nodeScope.getNodesWithIdRecursive('siCreate'); r.forEach(n => n.setVisualStates(${JSON.stringify(states)})); return r.length; })()`);
    await b.clickSel('#newlook'); await b.until('document.querySelector(".menu.lookstates")', 4000);
    const offered = JSON.parse(await b.evaluate(`JSON.stringify({ menu: [...document.querySelectorAll('.menu.lookstates .item')].map(i => i.dataset.state) })`));
    const typeStates = JSON.parse(await b.evaluate(`JSON.stringify((__ob.preview.nodeLibrary.nodetypes.find(t => t.name === ${JSON.stringify(sign.nodes.nodes.find((n) => n.id === 'siCreate').type)})?.visualStates || []).map(s => s.name).filter(s => s !== 'neutral'))`));
    ok(offered?.menu?.join() === typeStates.join() && typeStates.includes('hover') && typeStates.includes('pressed'), 'A look when hovered, pressed…: the menu offers exactly the states the node library gives a Button', { menu: offered?.menu, typeStates });
    await b.clickSel('.menu.lookstates .item[data-state=hover]'); await b.until('document.querySelector(".menu.ruleprops")', 4000);
    // graded against the node library, not Studio's own port list: the kit's spec ports carry no allowVisualStates, and
    // taking theirs first once hid Background Color from this menu
    const props = JSON.parse(await b.evaluate(`JSON.stringify((() => { const lib = __ob.preview.nodeLibrary.nodetypes.find(t => t.name === 'net.noodl.controls.button'); const may = new Set(lib.ports.filter(p => p.allowVisualStates).map(p => p.name)); const mine = __ob.ports('siCreate').map(p => p.name); return { menu: [...document.querySelectorAll('.menu.ruleprops .item')].map(i => i.dataset.port).sort(), allowed: mine.filter(n => may.has(n)).sort(), all: mine.length }; })())`));
    ok(props.menu.join() === props.allowed.join() && props.allowed.includes('backgroundColor') && props.all > props.allowed.length, 'then exactly the properties the node library lets a state change (allowVisualStates), not all of them', { menu: props.menu.length, allowed: props.allowed.length, all: props.all, missing: props.allowed.filter((n) => !props.menu.includes(n)).slice(0, 8) });
    const raw = await b.evaluate(`[...document.querySelectorAll('.menu.ruleprops .item')].map(i => i.textContent).filter(t => /^[a-z]+[A-Z]/.test(t))`);
    const layer = await b.evaluate(`document.querySelector('.menu.ruleprops .item[data-port=zIndex]')?.textContent`);
    ok(!raw.length && layer === 'Layer (z-index)', 'a property with no name in the node library is said in words ("zIndex" read raw)', { raw, layer });
    const bg0 = await drawnBg();
    n0 = await shows();
    await b.evaluate(`document.querySelector('.menu.ruleprops .item[data-port=backgroundColor]')?.scrollIntoView({ block: 'nearest' })`);
    await b.clickSel('.menu.ruleprops .item[data-port=backgroundColor]');
    await rebuilt(n0); await wait(400);
    ok(look()?.hover?.backgroundColor !== undefined && (await drawnBg()) === bg0, 'the new hover look starts as what it shows now: written to the file, and the button looks the same', { look: look(), bg0, now: await drawnBg() });
    await b.evaluate(`[...document.querySelectorAll('#right details')].find(d => /When hovered/.test(d.querySelector('summary').textContent)).querySelector('.field .cbtn').click()`);
    await b.until('document.querySelector(".menu.colours")', 4000);
    n0 = await shows();
    await b.evaluate(`(() => { const i = document.querySelector('.menu.colours .cpick input[type=text]'); i.value = '#00FF00'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await rebuilt(n0); await wait(400);
    const found = await inState(['neutral', 'hover']); await wait(300);
    const hovered = await drawnBg();
    await inState(['neutral']); await wait(300);
    const after = await drawnBg();
    ok(look()?.hover?.backgroundColor === '#00FF00' && found > 0 && hovered === 'rgb(0, 255, 0)' && after === bg0, 'set in the tab: the file says #00FF00, the button draws it while hovered and its own colour after', { look: look(), found, hovered, after, bg0 });
    await b.evaluate(`document.querySelectorAll('.menu').forEach(m => m.remove())`);
    const another = await b.evaluate(`!!document.querySelector('#right button[data-look=hover]')`);
    ok(another, 'the hover look has "Another property" for the next one');
    n0 = await shows();
    await b.evaluate(`[...document.querySelectorAll('#right details')].find(d => /When hovered/.test(d.querySelector('summary').textContent)).querySelector('.field > button').click()`);
    await rebuilt(n0); await wait(400);
    ok(!look(), 'and taken out again: the file is as it was', look());
    await tab('Visual');
  }
  console.log('check: a group made reusable (STU-050)');
  {
    const emailId = sign.nodes.nodes.find((n) => n.label === 'Email').id, whyId = sign.nodes.nodes.find((n) => n.label === 'Why it did not work').id;
    await clickText('#tree .row', 'Sign-in card'); await wait(400);
    let n0 = await shows();
    await clickText('#right .opencopy button', 'Make it reusable');
    await rebuilt(n0); await wait(800);
    const RC = 'components/Reusable/Sign-in card/';
    const made = existsSync(join(project, RC + 'nodes.json')) ? onDisk(RC + 'nodes.json').nodes : [];
    const page = onDisk(SIGN + 'nodes.json').nodes, copyNode = page.find((n) => n.type === '/Reusable/Sign-in card');
    const reg = onDisk('components/_registry.json').components['Reusable/Sign-in card'];
    ok(made.some((n) => n.id === emailId) && made.some((n) => n.id === card && n.parent === undefined) && !page.some((n) => n.id === emailId || n.id === card) && copyNode && reg,
      'Make it reusable moves the card and what it holds into Reusable/Sign-in card, and one copy takes its place on Sign in',
      { moved: made.length, copy: copyNode?.id, registered: !!reg });
    const inputs = made.find((n) => n.type === 'Component Inputs')?.ports.map((p) => p.name) ?? [];
    const outputs = made.find((n) => n.type === 'Component Outputs')?.ports.map((p) => `${p.name}:${p.type}`) ?? [];
    ok(inputs.includes('Why it did not work text') && outputs.includes('Sign in onClick:signal'),
      'the wires across the card\'s edge are its inputs and outputs, named after the element inside, a click typed as a signal', { inputs, outputs });
    const shownNow = { head: await b.evaluate('document.querySelector("#right .head input")?.value'), text: (await appText()).includes('Create account'), email: await b.evaluate(`__ob.preview.elementsOf(${JSON.stringify(emailId)}).length`) };
    ok(shownNow.head === 'Sign-in card' && shownNow.text && shownNow.email === 1, 'the copy is selected, and the app draws the card as before (its buttons, its Email box)', shownNow);
    // the page's sign-in logic still works through the copy: type into its boxes, press its Sign in, and the error it shows is the page's
    const errShown = () => b.evaluate(`(() => { const el = __ob.preview.elementsOf(${JSON.stringify(whyId)})[0]; return el ? el.textContent : null; })()`);
    const before = await errShown();
    const useApp = (on) => b.evaluate(`(() => { const c = document.getElementById('previewmode'); c.checked = ${on}; c.dispatchEvent(new Event('change')); })()`);
    await useApp(true); await wait(200);
    const at = await centreOf(emailId); await b.click(at.x, at.y); await b.type('nobody@example.com');
    const pw = await centreOf(sign.nodes.nodes.find((n) => n.label === 'Password').id); await b.click(pw.x, pw.y); await b.type('not the password');
    const go = await centreOf(signInBtn); await b.click(go.x, go.y);
    let after = null;
    for (const t0 = Date.now(); Date.now() - t0 < 6000 && !after; await wait(200)) after = await errShown();
    await useApp(false);
    ok(!before && after && after.length > 0, 'through the copy, a wrong sign-in still shows why it did not work (typed values out, the error and its showing in)', { before, after });
  }
  console.log('check: a reusable renamed');
  {
    // a For Each on Sign in whose template is the reusable, written from outside Studio: a setting that names it
    const out0 = await b.evaluate('__ob.outside || 0');
    { const f = join(project, SIGN + 'nodes.json'); const j = JSON.parse(readFileSync(f, 'utf8')); j.nodes.push({ id: 'feProbe', type: 'For Each', label: 'Cards', parent: 'siRoot', parameters: { template: '/Reusable/Sign-in card', templateType: 'explicit' } }); j.nodes.find((n) => n.id === 'siRoot').children.push('feProbe'); writeFileSync(f + '.tmp-check', JSON.stringify(j, null, 2)); renameSync(f + '.tmp-check', f); }
    await b.until(`(__ob.outside || 0) > ${out0}`, 8000); await wait(600);
    let n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Reusable/Sign-in card'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0); await wait(600);
    ok(await b.evaluate(`!document.getElementById('renamereusable').hidden`), 'a reusable open on its own has ✎ beside its name to rename it');
    await b.clickSel('#renamereusable'); await b.until('document.querySelector(".menu.renamereusable")', 4000);
    n0 = await shows();
    await b.evaluate(`(() => { const i = document.querySelector('.menu.renamereusable input'); i.value = 'Login card'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    await rebuilt(n0); await wait(900);
    const named = () => { const reg = onDisk('components/_registry.json').components, page = onDisk(SIGN + 'nodes.json').nodes; return { newReg: !!reg['Reusable/Login card'], oldReg: !!reg['Reusable/Sign-in card'], oldFiles: existsSync(join(project, 'components/Reusable/Sign-in card/nodes.json')), comp: existsSync(join(project, 'components/Reusable/Login card/component.json')) ? onDisk('components/Reusable/Login card/component.json') : null, copies: page.filter((n) => n.type.startsWith('/Reusable/')).map((n) => n.type), template: page.find((n) => n.id === 'feProbe')?.parameters.template }; };
    let r = named();
    const picked = await b.evaluate(`document.getElementById('pagepick').value`);
    ok(r.newReg && !r.oldReg && !r.oldFiles && r.comp?.name === 'Login card' && r.comp?.path === '/Reusable/Login card' && JSON.stringify(r.copies) === JSON.stringify(['/Reusable/Login card']) && r.template === '/Reusable/Login card' && picked === 'Reusable/Login card',
      'renamed to Login card: its files and registry entry move, the copy on Sign in and the For Each\'s template follow, and it stays open under the new name', { ...r, comp: r.comp && { name: r.comp.name, path: r.comp.path }, picked });
    n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sign in'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0); await wait(800);
    ok((await appText()).includes('Create account') && (await status()).startsWith('App on screen'), 'Sign in still draws the card through its renamed copy', await status());
    // the same name as another reusable in the folder is refused, and nothing is written
    n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Reusable/Login card'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0); await wait(400);
    const other = await b.evaluate(`[...document.querySelectorAll('#pagepick optgroup option')].map(o => o.value).find(v => v !== 'Reusable/Login card' && v.startsWith('Reusable/'))`);
    if (other) {
      const reg0 = readFileSync(join(project, 'components/_registry.json'), 'utf8');
      await b.clickSel('#renamereusable'); await b.until('document.querySelector(".menu.renamereusable")', 4000);
      await b.evaluate(`(() => { const i = document.querySelector('.menu.renamereusable input'); i.value = ${JSON.stringify(other.split('/').pop())}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
      await wait(800);
      ok(readFileSync(join(project, 'components/_registry.json'), 'utf8') === reg0 && /already/.test(await b.evaluate(`document.getElementById('toast').textContent`)), `a name another reusable in the folder has (${other}) is refused, nothing written`, { other, toast: await b.evaluate(`document.getElementById('toast').textContent`) });
    } else ok(false, 'another reusable in Reusable/ to clash with', await b.evaluate(`[...document.querySelectorAll('#pagepick option')].map(o => o.value)`));
    // one undo takes the whole rename back
    n0 = await shows();
    await b.clickSel('#undo'); await rebuilt(n0); await wait(900);
    r = named();
    ok(!r.newReg && r.oldReg && r.oldFiles && JSON.stringify(r.copies) === JSON.stringify(['/Reusable/Sign-in card']) && r.template === '/Reusable/Sign-in card', 'one undo takes the whole rename back: the old name, its files, the copy and the template', r);
    n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sign in'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0); await wait(600);
  }
  console.log('check: the workflows index (STU-022)');
  {
    // the Todo page: 18 Set Variable steps over 5 names, and Command copies whose record writes are inside their component
    const TODO = 'Pages/Todo';
    // Todo sends a signed-out visitor to Sign in and Design follows the app there (s3); this copy's "Signed in?" No wire is cut
    // from outside Studio for the section, and put back after ("Go to sign in" is still reached from Sign out)
    const todoWires = join(project, 'components', TODO, 'connections.json'), keptWires = readFileSync(todoWires, 'utf8');
    const outsideWrite = (text) => { writeFileSync(todoWires + '.tmp-check', text); renameSync(todoWires + '.tmp-check', todoWires); };
    {
      const tn = onDisk(`components/${TODO}/nodes.json`).nodes, nav = tn.find((n) => n.label === 'Go to sign in')?.id, gate = tn.find((n) => n.label === 'Signed in?')?.id;
      const cj = JSON.parse(keptWires); cj.connections = cj.connections.filter((w) => !(w.fromId === gate && w.fromProperty === 'onfalse' && w.toId === nav));
      outsideWrite(JSON.stringify(cj, null, 2));
      await b.until(`__ob.store.readComponent(${JSON.stringify(TODO)}).files.connections.connections.length === ${cj.connections.length}`, 5000).catch(() => {}); await wait(300);
    }
    let n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = ${JSON.stringify(TODO)}; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0).catch(() => {}); await wait(600);
    await b.clickSel('[data-tab=workflow]'); await wait(500);
    const onPage = await page();
    // the truth, off the files and the runtime's own node library (not Studio's reading): every node a listed card's signal
    // reaches through signal inputs; a copy of a component writes what any node inside it writes
    const lib = JSON.parse(await b.evaluate(`JSON.stringify(Object.fromEntries(__ob.preview.nodeLibrary.nodetypes.map(t => [t.name, [...(t.ports || []), ...(t.dynamicports || []).flatMap(d => d.ports || [])].filter(p => p.plug !== 'output' && (p.type === 'signal' || p.type?.name === 'signal')).map(p => p.name)])))`));
    const files = (key) => ({ nodes: onDisk(`components/${key}/nodes.json`).nodes, connections: onDisk(`components/${key}/connections.json`).connections });
    const signalIn = (type, port) => (type.startsWith('/') ? files(type.slice(1)).nodes.some((n) => n.type === 'Component Inputs' && (n.ports || []).some((p) => p.name === port && p.type === 'signal')) : (lib[type] || []).includes(port));
    const todo = files(TODO), nodeOf = new Map(todo.nodes.map((n) => [n.id, n]));
    const reach = (node, port) => { const seen = new Set([node]), out = [], q = [[node, port]]; while (q.length) { const [f, fp] = q.shift(); for (const w of todo.connections) { if (w.fromId !== f || (fp && w.fromProperty !== fp)) continue; const t = nodeOf.get(w.toId); if (!t || seen.has(t.id) || !signalIn(t.type, w.toProperty)) continue; seen.add(t.id); out.push(t); q.push([t.id, null]); } } return out; };
    const writes = (n, coll, seen = new Set()) => { if (/^(New|Set|Delete)DbModelProperties$/.test(n.type)) return n.parameters?.collectionName === coll; if (!n.type.startsWith('/') || seen.has(n.type)) return false; seen.add(n.type); return files(n.type.slice(1)).nodes.some((x) => writes(x, coll, seen)); };
    const listed = async () => JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('#events .row')].map(r => r.dataset.node + '|' + r.dataset.port).sort())`));
    const rows = await listed();
    const truth = (pred) => rows.filter((k) => { const [id, port] = k.split('|'); return reach(id, port).some(pred); }).sort();
    const pick = async (id, value) => { await b.evaluate(`(() => { const s = document.getElementById(${JSON.stringify(id)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')); })()`); await wait(300); };
    const diff = (want, got) => ({ want: want.length, got: got.length, missing: want.filter((x) => !got.includes(x)).slice(0, 4), extra: got.filter((x) => !want.includes(x)).slice(0, 4) });
    const task = truth((n) => writes(n, 'Task'));
    await pick('wfeffect', 'data:Task');
    const gotTask = await listed();
    ok(onPage === TODO && task.length > 0 && task.length < rows.length && JSON.stringify(gotTask) === JSON.stringify(task), 'STU-022: "Changes Task" lists exactly the cards with a step that writes Task, a Command copy counting what is inside it', { page: onPage, rows: rows.length, ...diff(task, gotTask) });
    const chosen = truth((n) => n.type === 'Set Variable' && n.parameters?.name === 'todoSelected');
    await pick('wfeffect', 'state:todoSelected');
    const gotChosen = await listed();
    ok(chosen.length > 0 && chosen.length < rows.length && JSON.stringify(gotChosen) === JSON.stringify(chosen), 'STU-022: "Changes todoSelected" lists exactly the cards with a step setting it', diff(chosen, gotChosen));
    const counted = await b.evaluate(`document.getElementById('wfcount').textContent`);
    ok(counted === `${chosen.length} of ${rows.length} workflows`, 'STU-022: the list says how many of the page\'s workflows the filter leaves', counted);
    await pick('wfeffect', '');
    await b.evaluate(`(() => { const i = document.getElementById('wfsearch'); i.value = 'Go to sign in'; i.dispatchEvent(new Event('input')); })()`); await wait(300);
    const out = truth((n) => n.label === 'Go to sign in');
    const gotOut = await listed();
    ok(out.length > 0 && JSON.stringify(gotOut) === JSON.stringify(out), 'STU-022: a search for a step\'s name ("Go to sign in") lists the cards that reach that step', diff(out, gotOut));
    await b.evaluate(`(() => { const i = document.getElementById('wfsearch'); i.value = ''; i.dispatchEvent(new Event('input')); })()`); await wait(200);
    // grouped by element, in the order the element list draws them: the headers' order is the page's visual order
    const heads = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('#events .evhead')].map(e => e.dataset.node))`));
    const visual = JSON.parse(await b.evaluate(`JSON.stringify(__ob.visualIds ?? null)`));
    const inOrder = visual ? heads.filter((id) => visual.includes(id)).every((id, i, a) => i === 0 || visual.indexOf(a[i - 1]) < visual.indexOf(id)) : null;
    ok(heads.length > 1 && new Set(heads).size === heads.length && inOrder !== false, 'STU-022: the cards sit under their element, each element once, in the page\'s order', { heads: heads.length, inOrder });
    await shot('workflow-index');
    outsideWrite(keptWires);
    await b.until(`__ob.store.readComponent(${JSON.stringify(TODO)}).files.connections.connections.length === ${JSON.parse(keptWires).connections.length}`, 5000).catch(() => {}); await wait(600);
    n0 = await shows();
    await b.evaluate(`(() => { const s = document.getElementById('pagepick'); s.value = 'Pages/Sign in'; s.dispatchEvent(new Event('change')); })()`);
    await rebuilt(n0).catch(() => {}); await wait(600);
  }
  ok((await status()).startsWith('App on screen'), 'after every edit the app still validates and draws', await status());
  const problems = b.problems.filter((p) => !/Invalid connection|doesn't have a port|Failed to load resource|fonts\.g|^\[noodl\]/.test(p)); // `[noodl]` lines are the app's own runtime (a Navigate with no target yet), not the editor
  ok(problems.length === 0, 'no exceptions in the editor page', problems.slice(0, 3));
} catch (err) {
  ok(false, `the gate itself: ${err.message.split('\n')[0]}`);
  console.log(err.stack?.split('\n').slice(0, 4).join('\n'));
  // what the editor was showing when the gate stopped
  try { console.log('state:', await b.evaluate(`JSON.stringify({ page: document.getElementById('pagepick').value, right: document.getElementById('right').innerText.slice(0, 160), toast: document.getElementById('toast').textContent, status: document.getElementById('status').textContent, frame: __ob.preview.frame?.contentWindow?.location.pathname, shows: __ob.shows })`)); } catch { /* the page is gone */ }
} finally {
  try { await b?.close(); } catch { /* gone */ }
  for (const c of children) c.kill();
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter((r) => r.cond).length;
console.log(`check: ${passed === results.length ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
