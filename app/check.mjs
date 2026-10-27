/**
 * NodeGX Studio — the desktop app's gate (STU-003). Starts the real Electron app hidden, on a recent list of its own
 * (NODEGX_STUDIO_USER_DATA) with its dialogs answered in order (NODEGX_STUDIO_TEST_PICKS), and drives the window over
 * CDP: the first run shows the welcome screen; a template click makes a project and opens it; the next start offers
 * that project again; a destination that holds files is refused and left as it was; an import from the committed
 * fixtures ends with the project open; a project gone from disk is shown as gone and can be taken off the list; and
 * stopping the app takes its editor server with it. STU-004: the todo template's copy gets a backend of its own
 * (under a backends folder of the gate's own, NODEGX_BACKENDS_DIR), started on open, a row added in Data is still
 * there after a quit and a reopen, and quitting stops the backend. Every assertion reads the files written, the
 * recent list on disk, the backend over HTTP or the window's page — never the app's own claim.
 *
 *   node app/check.mjs            PASS n/n and exit 0, or the failing lines and exit 1
 *   node app/check.mjs --shots    also writes docs/look/stu-003-*.png
 *   NODEGX_STUDIO_BINARY="dist/mac-arm64/NodeGX Studio.app/Contents/MacOS/NodeGX Studio" node app/check.mjs
 *                                 the same gate on the packaged app (STU-007)
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attach } from '../editor/cdp.mjs';
import { kit, studioRoot } from '../lib/nodegx.mjs';
import { importApp } from './actions.mjs';

const shots = process.argv.includes('--shots');
// NODEGX_STUDIO_BINARY runs the gate on a packaged app (STU-007: npm run package) instead of the development one
const packaged = process.env.NODEGX_STUDIO_BINARY || null;
const electron = packaged ?? createRequire(import.meta.url)('electron');
const appArgs = packaged ? [] : [studioRoot];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
const countFiles = (dir) => readdirSync(dir, { recursive: true }).filter((f) => !f.endsWith('.DS_Store') && statSync(join(dir, f)).isFile()).length;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-app-check-'));
const userData = join(tmp, 'user-data');
const projects = join(tmp, 'projects');
mkdirSync(projects);
const recentFile = join(userData, 'recent-projects.json');
const backendsDir = join(tmp, 'backends');
process.env.NODEGX_BACKENDS_DIR = backendsDir; // the app and its servers inherit it: nothing is written to ~/.noodl
const bindingOf = (dir) => readJson(join(dir, 'nodegx.project.json')).metadata?.cloudservices ?? {};
/** What the backend itself says, asked as its admin (its own secrets.json). */
async function backendRows(dir, collection) {
  const { instanceId, endpoint } = bindingOf(dir);
  const token = readJson(join(backendsDir, instanceId, 'secrets.json')).adminToken;
  const r = await fetch(`${endpoint}/classes/${collection}`, { headers: { 'X-Parse-Application-Id': instanceId, 'X-Parse-Master-Key': token } });
  return (await r.json()).results;
}
const backendAnswers = async (dir) => { try { return (await fetch(`${bindingOf(dir).endpoint}/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const backendUp = (b) => b.until(`['running', 'adopted'].includes(window.__ob?.backend?.phase) && window.__ob.backend`, 30000);
/** Data → App data → the type → its rows' count ("No rows", "1–1 of 1"). */
async function openRows(b, type) {
  await b.clickSel('#backendpill');
  await b.evaluate(`document.querySelector('#data .subtabs [data-sub=app]').click()`);
  await b.until(`!!document.querySelector('#apptypes .row[data-type=${JSON.stringify(type)}]')`, 10000);
  await b.evaluate(`document.querySelector('#apptypes .row[data-type=${JSON.stringify(type)}]').click()`);
  return b.until(`document.querySelector('#appmain h2')?.textContent.startsWith(${JSON.stringify(type)}) && document.querySelector('#appmain [data-pages]')?.textContent`, 10000);
}
const recentDirs = () => (existsSync(recentFile) ? readJson(recentFile).projects.map((p) => p.dir) : []);
const serversOf = () => { try { return execFileSync('pgrep', ['-f', `serve.mjs ${tmp}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { return []; } };

let running = null;
/** Starts the app with these dialog answers and attaches to its window. */
async function start(picks = [], extra = []) {
  const port = await freePort();
  const env = { ...process.env, NODEGX_STUDIO_USER_DATA: userData, NODEGX_STUDIO_TEST_PICKS: JSON.stringify(picks), NODEGX_STUDIO_SINGLE_INSTANCE: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(electron, [...appArgs, '--hidden', `--remote-debugging-port=${port}`, ...extra], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  const exited = new Promise((r) => proc.on('exit', r));
  const b = await attach({ port, match: (t) => !t.url.endsWith('/tabs.html') }); // a tab's page, not the strip (STU-009)
  running = { proc, b, exited, log: () => log, port };
  return b;
}
/** Stops it the way a terminal's Ctrl-C would; resolves once the process is gone. */
async function stop() {
  if (!running) return;
  const { proc, b, exited } = running;
  running = null;
  await b.close();
  proc.kill('SIGTERM');
  await Promise.race([exited, wait(8000)]);
  if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
}
const title = (b, prefix, ms = 90000) => b.waitTitle((t) => t.startsWith(prefix), ms);
const welcomeTitle = (b) => title(b, 'ready welcome');
const editorReady = (b) => b.waitTitle((t) => t.startsWith('ready') && !t.startsWith('ready welcome'), 90000);
const shot = async (b, name) => shots && b.screenshot(join(studioRoot, 'docs/look', `stu-003-${name}.png`));

const todos = join(projects, 'My todos');
const imported = join(projects, 'Imported');
try {
  console.log('1. the first run, no project named');
  {
    const b = await start([todos]);
    const t = await welcomeTitle(b);
    ok(t === 'ready welcome · 0 recent · 5 templates', 'the window shows the welcome screen, nothing recent, five templates', t);
    ok((await b.evaluate(`[...document.querySelectorAll('.tpl:not(:disabled)')].map((x) => x.dataset.slug).join()`)) === 'todo-list,planning,rocket-school,pixel-dungeon,story-engine', 'the five templates are the shelf\'s, each clickable');
    ok(await b.evaluate(`!document.querySelector('#reopen') && /appear here/.test(document.querySelector('#recent').textContent)`), 'no Reopen on a first run, and the empty list says what will appear');
    await shot(b, 'welcome-first-run');

    console.log('2. a project from a template');
    await b.clickSel('.tpl[data-slug=todo-list]');
    const t2 = await editorReady(b);
    ok(/^ready My todos /.test(t2), 'clicking Todo list opens the new project in the editor', t2);
    ok(existsSync(join(todos, 'nodegx.project.json')) && readJson(join(todos, 'nodegx.project.json')).name === 'My todos', 'the project is in the folder named, and carries its name');
    const tplDir = join(kit.templates, 'todo-list');
    const expected = countFiles(tplDir) - ['.mcp.json', 'CLAUDE.md'].filter((n) => existsSync(join(tplDir, n))).length;
    ok(countFiles(todos) === expected, 'every file of the template came across', { copied: countFiles(todos), expected });
    ok(!existsSync(join(todos, '.mcp.json')) && !existsSync(join(todos, 'CLAUDE.md')), 'no editor-written agent files with another machine\'s paths');
    ok(JSON.stringify(recentDirs()) === JSON.stringify([todos]), 'the recent list on disk names it', recentDirs());
    ok(serversOf().length === 1, 'one editor server runs for it', serversOf());
    if (packaged) {
      const cmd = serversOf().map((pid) => execFileSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).trim())[0] ?? '';
      ok(cmd.includes('.app/Contents/Resources/app/editor/serve.mjs') && !cmd.includes(`${studioRoot}/editor`), 'the editor server is the packaged app\'s own, not the source tree\'s', cmd.slice(-160));
    }

    console.log('2b. its backend (STU-004)');
    const bound = bindingOf(todos);
    const config = bound.instanceId && existsSync(join(backendsDir, bound.instanceId, 'config.json')) ? readJson(join(backendsDir, bound.instanceId, 'config.json')) : {};
    ok(bound.type === 'nodegx' && config.name === 'My todos backend' && config.projectIds?.includes(readJson(join(todos, 'nodegx.project.json')).id), 'the copy is bound to a backend of its own, owned by its id, where NodeGX keeps backends', { bound, config });
    const up = await backendUp(b);
    ok(up && up.phase === 'running' && up.endpoint === bound.endpoint && (await backendAnswers(todos)), 'opening it started that backend, and it answers', up);
    ok(/^Backend · 127\.0\.0\.1:\d+$/.test(await b.evaluate(`document.querySelector('#backendpill').textContent`)), 'the status bar says where it is', await b.evaluate(`document.querySelector('#backendpill').textContent`));
    ok(JSON.stringify(readJson(join(backendsDir, bound.instanceId, 'security.json'))) === JSON.stringify(readJson(join(todos, 'nodegx.security.json'))), 'its policy is the template\'s own nodegx.security.json');
    const visitor = await fetch(`${bound.endpoint}/classes/Task`, { headers: { 'X-Parse-Application-Id': bound.instanceId } });
    ok(visitor.status >= 400, 'a visitor with no sign-in is refused the tasks, as the policy says', visitor.status);
    const note = await openRows(b, 'Task');
    ok(note === 'No rows', 'App data lists Task, which the app uses but does not declare, and shows its rows: none yet', note);
    await b.evaluate(`document.querySelector('#appmain [data-act=new]').click()`);
    await b.until(`!!document.querySelector('#drawer [data-act=create]')`, 10000);
    await b.evaluate(`document.querySelector('#drawer [data-act=create]').click()`);
    const after = await b.until(`document.querySelector('#appmain [data-pages]')?.textContent === '1–1 of 1' && '1–1 of 1'`, 10000);
    const rows = await backendRows(todos, 'Task');
    ok(after && rows.length === 1, 'New entry adds a row, and the backend holds it', { after, rows: rows.length });
    await shot(b, 'backend-row');

    // P125-MUDDY-NATIVEDIALOG: Electron implements no prompt(), so New type / option set / attribute / style did
    // nothing in the desktop app. Studio asks in its own field and card; each made here, then deleted, so the sections
    // after this one find the copy as they did
    console.log('2c. names and yeses asked in Studio\'s own controls (P125-MUDDY-NATIVEDIALOG)');
    const answer = async (name) => {
      const asked = await b.until(`!!document.querySelector('.ask [data-input=askname]')`, 5000);
      if (asked) await b.evaluate(`(() => { const i = document.querySelector('.ask [data-input=askname]'); i.focus(); i.value = ${JSON.stringify(name)}; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
      return !!asked;
    };
    const yes = async () => { const asked = await b.until(`!!document.querySelector('.sure [data-act=yes]')`, 5000); if (asked) await b.evaluate(`document.querySelector('.sure [data-act=yes]').click()`); return !!asked; };
    const pressText = (sel, text) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(text)})).click()`);
    const declares = (name) => readJson(join(todos, 'nodegx.project.json')).metadata?.dbCollections?.some((c) => c.name === name);
    const setDir = join(todos, 'components', 'Option sets', 'Priorities');
    const styleNamed = (name) => (existsSync(join(todos, 'nodegx.styles.json')) ? readJson(join(todos, 'nodegx.styles.json')).variants || [] : []).some((v) => v.name === name);
    await b.evaluate(`document.querySelector('[data-sub=types]').click()`); await wait(300);
    await b.evaluate(`document.getElementById('newtype').click()`);
    const typeAsked = await answer('Note');
    ok(typeAsked && (await b.until(`!!document.querySelector('#types .row[data-type="Note"]')`, 10000)) && declares('Note'), 'New type in the desktop app: the name asked in Studio\'s field, the type declared', { asked: typeAsked });
    await pressText('#datamain button', 'Delete type');
    const typeYes = await yes();
    ok(typeYes && (await b.until(`!document.querySelector('#types .row[data-type="Note"]')`, 10000)) && !declares('Note'), 'Delete type: asked in Studio\'s card, and gone', { asked: typeYes });
    await b.evaluate(`document.querySelector('[data-sub=options]').click()`); await wait(300);
    await b.evaluate(`document.getElementById('newoptset').click()`);
    const setAsked = await answer('Priorities');
    const setDrawn = await b.until(`!!document.querySelector('#optmain .bar button')`, 8000);
    for (const t0 = Date.now(); Date.now() - t0 < 5000 && !existsSync(join(setDir, 'nodes.json')); await wait(150)); // the panel draws before the save lands
    ok(setAsked && setDrawn && existsSync(join(setDir, 'nodes.json')), 'New option set: asked, and a component on disk', { asked: setAsked, drawn: !!setDrawn, onDisk: existsSync(join(setDir, 'nodes.json')) });
    await pressText('#optmain .bar button', 'New attribute');
    const attrAsked = await answer('rank'); await wait(700);
    const attrs = existsSync(join(setDir, 'component.json')) ? readJson(join(setDir, 'component.json')).metadata?.optionSet?.attributes?.map((a) => a.name) : null;
    ok(attrAsked && attrs?.includes('rank'), 'New attribute: asked, and written into the set', { asked: attrAsked, attrs });
    await pressText('#optmain .bar button', 'Delete option set');
    const setYes = await yes(); await wait(700);
    ok(setYes && !existsSync(join(setDir, 'nodes.json')), 'Delete option set: asked in Studio\'s card, and gone from disk', { asked: setYes });
    await b.evaluate(`document.querySelector('[data-tab=styles]').click()`); await wait(300);
    await b.evaluate(`document.getElementById('newstyle').click()`);
    await b.until(`!!document.querySelector('.menu .item')`, 5000);
    await b.evaluate(`[...document.querySelectorAll('.menu .item')].find((x) => x.textContent.trim() === 'Button').click()`);
    const styleAsked = await answer('Outline'); await wait(700);
    ok(styleAsked && styleNamed('Outline'), 'New style (a Button\'s): asked, and written into nodegx.styles.json', { asked: styleAsked });
    await pressText('#stylemain .bar button', 'Delete style');
    const styleYes = await yes(); await wait(700);
    ok(styleYes && !styleNamed('Outline'), 'Delete style: asked in Studio\'s card, and gone', { asked: styleYes });
    await b.evaluate(`document.querySelector('[data-tab=data]').click()`); await wait(300);

    await stop();
    ok(serversOf().length === 0, 'stopping the app stops its editor server', serversOf());
    ok(!(await backendAnswers(todos)) && !existsSync(join(backendsDir, bound.instanceId, 'runtime.json')), 'and the backend it started, leaving no runtime record');
  }

  console.log('3. the next start offers the last project');
  {
    const site = join(tmp, 'sites', 'My todos site');
    const b = await start([site]);
    const t = await welcomeTitle(b);
    ok(t.startsWith('ready welcome · 1 recent'), 'the welcome screen counts one recent project', t);
    ok((await b.evaluate(`document.querySelector('#reopen')?.textContent`)) === 'Reopen My todos', 'its first button reopens My todos');
    await shot(b, 'welcome-reopen');
    await b.clickSel('#reopen');
    ok(/^ready My todos /.test(await editorReady(b)), 'Reopen opens it in the editor');
    ok((await backendUp(b))?.phase === 'running', 'its backend is started again');
    ok(await b.evaluate(`document.querySelector('#reportpill').hidden && !document.querySelector('#reportpanel')`), 'a project with no import report shows no report and no button for one');
    const note = await openRows(b, 'Task');
    ok(note === '1–1 of 1' && (await backendRows(todos, 'Task')).length === 1, 'the row added before the quit is there', note);

    console.log('3b. Publish (STU-008; the site itself is graded by check:publish)');
    ok(await b.evaluate(`!document.querySelector('#publishbtn').hidden`), 'the header has Publish in the desktop app');
    await b.clickSel('#publishbtn');
    const busy = await b.until(`document.querySelector('#publishbtn').textContent === 'Publishing…' || window.__ob.published`, 5000);
    const pub = await b.until(`window.__ob.published`, 120000);
    ok(busy && pub?.site === site && existsSync(join(site, 'index.html')) && existsSync(join(site, '.nodegx-publish.json')), 'clicking it publishes the open app to the folder chosen', { site: pub?.site, error: pub?.error });
    ok(pub?.asked?.[0] === 'This app’s backend runs on this computer' && pub.said?.some((l) => l.includes('on this computer only')), 'before writing, it says the backend is this computer\'s; after, where the site is and what it talks to', pub?.said);
    ok(pub?.said?.some((l) => l.includes('(such as /sign-in)') && l.includes('index.html')), 'and that a page\'s own address needs the server to answer it with index.html', pub?.said);
    ok((await b.evaluate(`document.querySelector('#publishbtn').textContent`)) === 'Publish', 'the button is ready again');
    ok(readJson(join(userData, 'published-sites.json'))[todos] === site, 'the folder is remembered for the next Publish of this app');
    await stop();
    ok(!(await backendAnswers(todos)), 'quitting stops it again');
  }

  console.log('4. a destination that already holds files');
  {
    const before = countFiles(todos);
    const b = await start([todos, join(tmp, 'import-in'), imported]);
    await welcomeTitle(b);
    await b.clickSel('.tpl[data-slug=story-engine]');
    const said = await b.until(`document.querySelector('#status.error')?.textContent`, 10000);
    ok(/already holds/.test(said || ''), 'Story engine into My todos is refused, and the screen says why', said);
    // "Copying…" travels apart from the refusal and used to land after it, leaving a spinner that never stopped
    await wait(800);
    ok(await b.evaluate(`!!document.querySelector('#status.error') && !document.querySelector('#status .spin') && !document.querySelector('.tpl:disabled')`), 'the refusal stays on screen and the page is usable again');
    ok(countFiles(todos) === before && readJson(join(todos, 'nodegx.project.json')).name === 'My todos', 'My todos is untouched', { before, after: countFiles(todos) });
    // the importer deletes its destination before writing: Studio must refuse first
    let refused = '';
    try { await importApp(join(studioRoot, 'import/option-sets'), todos); } catch (err) { refused = err.message; }
    ok(/already holds/.test(refused) && countFiles(todos) === before, 'an import into a folder that holds files is refused before the importer runs', refused);

    console.log('5. an app imported from the committed fixtures');
    const inDir = join(tmp, 'import-in');
    mkdirSync(inDir);
    for (const f of ['backend-workflows/example-c5r6j filled.json', 'option-sets/example-dxr78ubfdtfq6tbmec.json', 'database-schema/example-privacy-rule-entpawjzehwq0tbk.json']) cpSync(join(studioRoot, 'import', f), join(inDir, f.split('/').pop()));
    await b.clickSel('#status button'); // dismiss the refusal
    await b.clickSel('#import');
    ok(await b.until(`document.querySelector('#importguide').open && !!document.querySelector('#import-file') && !!document.querySelector('#import-folder')`, 5000), 'Import an app… first says what to bring: an export file, or a folder of page files (STU-040)');
    await shot(b, 'import-guide');
    await b.clickSel('#import-folder');
    const t = await editorReady(b);
    ok(/^ready Imported /.test(t), 'the folder chosen there ends with the new project open in the editor', t);
    const report = await b.until(`document.querySelector('#reportpanel h1')?.textContent`, 10000);
    ok(/import report/i.test(report || '') && (await b.evaluate(`document.querySelectorAll('#reportpanel table').length`)) >= 3, 'with the import report open beside it, its tables drawn as tables', report);
    ok(await b.evaluate(`!document.querySelector('#reportpill').hidden`), 'and an Import report button in the header');
    await shot(b, 'import-report');
    await b.clickSel('#reportclose');
    ok(await b.until(`!document.querySelector('#reportpanel')`, 3000), 'Close puts it away');
    await b.clickSel('#reportpill');
    ok(await b.until(`!!document.querySelector('#reportpanel h1')`, 5000), 'and the header button brings it back');
    const pj = existsSync(join(imported, 'nodegx.project.json')) ? readJson(join(imported, 'nodegx.project.json')) : {};
    ok(pj.metadata?.imported?.by === 'nodegx-studio' && pj.name === 'Imported' && pj.metadata.imported.appId === 'backend-only' && existsSync(join(imported, 'docs/IMPORT-REPORT.md')), 'the folder holds the importer\'s project, named as the person named it, and its report', { name: pj.name, appId: pj.metadata?.imported?.appId });
    ok(JSON.stringify(recentDirs()) === JSON.stringify([imported, todos]), 'the recent list is newest first', recentDirs());

    console.log('5b. projects in tabs (STU-009)');
    // the strip is the window's own page; each tab's page is a target of its own on the debugging port
    const { port } = running;
    const strip = await attach({ port, match: (t) => t.url.endsWith('/tabs.html') });
    const named = `JSON.stringify([...document.querySelectorAll('.tab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? '*' : '')))`;
    const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === 'page' && !t.url.endsWith('/tabs.html')).map((t) => t.title);
    const until = async (fn, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await wait(250)) { const v = await fn(); if (v) return v; } return null; };
    ok((await strip.evaluate(named)) === '["Imported*"]', 'the window has a tab strip with one tab: the project open in it', await strip.evaluate(named));
    await b.evaluate(`window.studio.open(${JSON.stringify(todos)})`);
    const two = await strip.until(`document.querySelectorAll('.tab').length === 2 && !document.querySelector('.tab.busy') && ${named}`, 60000);
    ok(two === '["Imported","My todos*"]', 'opening another project from a project gives it a tab of its own, made active; the first stays', two);
    const drawn = await until(async () => (await pages()).some((t) => /^ready My todos /.test(t)) && pages(), 90000);
    ok(drawn && drawn.some((t) => /^ready Imported /.test(t)) && serversOf().length === 2, 'both projects are drawn, each with an editor server of its own', { pages: drawn, servers: serversOf().length });
    ok(await until(() => backendAnswers(todos), 30000), 'the new tab started its project\'s backend');
    await b.evaluate(`window.studio.open(${JSON.stringify(imported)})`);
    const back = await strip.until(`${named} === '["Imported*","My todos"]' && ${named}`, 10000);
    ok(back && serversOf().length === 2, 'opening a project that is already open selects its tab: no second tab, no second server', { back, servers: serversOf().length });
    await strip.evaluate(`[...document.querySelectorAll('.tab')].find((t) => t.textContent.includes('My todos')).querySelector('button').click()`);
    const one = await strip.until(`document.querySelectorAll('.tab').length === 1 && ${named}`, 10000);
    const stopped = await until(async () => serversOf().length === 1 && !(await backendAnswers(todos)), 20000);
    ok(one === '["Imported*"]' && stopped, 'closing a tab stops its editor server and its backend; the other tab stays', { one, servers: serversOf().length });
    ok(/^ready Imported /.test(await b.evaluate('document.title')) && (await b.evaluate(`!!document.querySelector('#pagepick')`)), 'and the tab left keeps working: its page answers as before');
    // a second launch on a project (what Window ↗ in a conversation does through NodeGX) opens it as a tab here, and quits
    const env2 = { ...process.env, NODEGX_STUDIO_USER_DATA: userData, NODEGX_STUDIO_SINGLE_INSTANCE: '1' };
    delete env2.ELECTRON_RUN_AS_NODE;
    const second = await new Promise((r) => { const p = spawn(electron, [...appArgs, todos, '--hidden'], { env: env2, stdio: 'ignore' }); const t = setTimeout(() => (p.kill(), r('still running')), 30000); p.on('exit', (code) => (clearTimeout(t), r(code))); });
    const handed = await strip.until(`document.querySelectorAll('.tab').length === 2 && !document.querySelector('.tab.busy') && ${named}`, 60000);
    ok(second === 0 && handed === '["Imported","My todos*"]', 'a second launch on My todos hands it to this Studio, which opens it in a tab, and the second launch quits', { second, handed });
    // P125-CCN006-NOSCHEME: a nodegx-studio:// link, as NodeGX's browser window of Studio sends it once its agent has
    // gone (companion.ts: encodeURIComponent). Windows and Linux hand it to a second launch's command line; macOS's
    // open-url needs the packaged app (the session's drive, not this gate).
    await strip.evaluate(`[...document.querySelectorAll('.tab')].find((t) => t.textContent.includes('My todos')).querySelector('button').click()`);
    await strip.until(`document.querySelectorAll('.tab').length === 1`, 10000);
    const link = `nodegx-studio://open?dir=${encodeURIComponent(todos)}`;
    const third = await new Promise((r) => { const p = spawn(electron, [...appArgs, link, '--hidden'], { env: env2, stdio: 'ignore' }); const t = setTimeout(() => (p.kill(), r('still running')), 30000); p.on('exit', (code) => (clearTimeout(t), r(code))); });
    const linked = await strip.until(`document.querySelectorAll('.tab').length === 2 && !document.querySelector('.tab.busy') && ${named}`, 60000);
    ok(third === 0 && linked === '["Imported","My todos*"]', 'a nodegx-studio://open?dir= link to My todos opens it in a tab of this Studio, and the launch that carried it quits', { third, linked });
    await strip.close();
    await stop();
  }

  console.log('6. a recent project gone from disk');
  {
    const gone = join(projects, 'Gone');
    cpSync(todos, gone, { recursive: true });
    const list = readJson(recentFile);
    list.projects.splice(1, 0, { dir: gone, name: 'Gone', openedAt: new Date().toISOString() });
    writeFileSync(recentFile, JSON.stringify(list));
    rmSync(gone, { recursive: true });
    const b = await start();
    await welcomeTitle(b);
    const row = `#recent li[data-dir=${JSON.stringify(gone)}]`;
    ok(await b.evaluate(`document.querySelector(${JSON.stringify(row)})?.classList.contains('missing') && /not found/.test(document.querySelector(${JSON.stringify(row)}).textContent)`), 'it is listed as not found');
    await shot(b, 'welcome-missing');
    await b.clickSel(`${row} .forget`);
    await b.until(`!document.querySelector(${JSON.stringify(row)})`, 5000);
    ok(JSON.stringify(recentDirs()) === JSON.stringify([todos, imported]), 'its ✕ takes it off the list on disk, and only it (My todos first: 5b opened it last)', recentDirs());
    await stop();
  }

  console.log('7. the smoke run with no project');
  {
    const env = { ...process.env, NODEGX_STUDIO_USER_DATA: userData };
    delete env.ELECTRON_RUN_AS_NODE;
    let out = '';
    const code = await new Promise((r) => { const p = spawn(electron, [...appArgs, '--smoke'], { env }); p.stdout.on('data', (d) => (out += d)); p.on('exit', r); });
    ok(code === 0 && /smoke: ready welcome · 2 recent/.test(out), 'npm run smoke with no project draws the welcome screen and exits 0', { code, out: out.trim().split('\n')[0] });
    // P125-CCN006-NOSCHEME: a link that starts the app (Windows, Linux) opens its folder; one naming a relative folder opens nothing
    const smokeOn = (arg) => new Promise((r) => { let o = ''; const p = spawn(electron, [...appArgs, arg, '--smoke'], { env }); p.stdout.on('data', (d) => (o += d)); p.on('exit', (c) => r({ code: c, out: o.trim().split('\n').find((l) => l.startsWith('smoke:')) })); });
    const cold = await smokeOn(`nodegx-studio://open?dir=${encodeURIComponent(todos)}`);
    ok(cold.code === 0 && /^smoke: ready My todos /.test(cold.out || ''), 'a nodegx-studio:// link that starts the app opens its folder', cold);
    const relative = await smokeOn('nodegx-studio://open?dir=My%20todos');
    ok(relative.code === 0 && /^smoke: ready welcome /.test(relative.out || ''), 'a link naming a relative folder opens nothing: the welcome screen', relative);
  }
} catch (err) {
  ok(false, 'the gate ran to the end', err.stack?.split('\n').slice(0, 3).join(' | '));
  if (running) console.log(running.log().slice(-1200));
} finally {
  await stop();
  for (const pid of serversOf()) try { process.kill(Number(pid)); } catch {}
  // a backend left by a failed run: its runtime record names it (each one also stops itself once its server is gone)
  for (const id of existsSync(backendsDir) ? readdirSync(backendsDir) : []) {
    const rec = join(backendsDir, id, 'runtime.json');
    if (existsSync(rec)) try { process.kill(readJson(rec).pid); } catch {}
  }
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
