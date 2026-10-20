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
const electron = createRequire(import.meta.url)('electron');
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
/** Data → the type → the rows' note ("n row(s) on …"). */
async function openRows(b, type) {
  await b.clickSel('#backendpill');
  await b.until(`[...document.querySelectorAll('#types .row')].some((r) => r.textContent.startsWith(${JSON.stringify(type)}))`, 10000);
  await b.evaluate(`[...document.querySelectorAll('#types .row')].find((r) => r.textContent.startsWith(${JSON.stringify(type)})).click()`);
  return b.until(`[...document.querySelectorAll('#datamain .note')].map((n) => n.textContent).find((t) => t.includes('row(s) on'))`, 10000);
}
const recentDirs = () => (existsSync(recentFile) ? readJson(recentFile).projects.map((p) => p.dir) : []);
const serversOf = () => { try { return execFileSync('pgrep', ['-f', `serve.mjs ${tmp}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { return []; } };

let running = null;
/** Starts the app with these dialog answers and attaches to its window. */
async function start(picks = [], extra = []) {
  const port = await freePort();
  const env = { ...process.env, NODEGX_STUDIO_USER_DATA: userData, NODEGX_STUDIO_TEST_PICKS: JSON.stringify(picks) };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(electron, [studioRoot, '--hidden', `--remote-debugging-port=${port}`, ...extra], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  const exited = new Promise((r) => proc.on('exit', r));
  const b = await attach({ port });
  running = { proc, b, exited, log: () => log };
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
    ok(/^0 row\(s\)/.test(note || ''), 'Data lists Task, which the app uses but does not declare, and shows its rows: none yet', note);
    await b.evaluate(`[...document.querySelectorAll('#datamain button')].find((x) => /New entry/.test(x.textContent)).click()`);
    const after = await b.until(`[...document.querySelectorAll('#datamain .note')].map((n) => n.textContent).find((t) => t.startsWith('1 row(s)'))`, 10000);
    const rows = await backendRows(todos, 'Task');
    ok(after && rows.length === 1, 'New entry adds a row, and the backend holds it', { after, rows: rows.length });
    await shot(b, 'backend-row');
    await stop();
    ok(serversOf().length === 0, 'stopping the app stops its editor server', serversOf());
    ok(!(await backendAnswers(todos)) && !existsSync(join(backendsDir, bound.instanceId, 'runtime.json')), 'and the backend it started, leaving no runtime record');
  }

  console.log('3. the next start offers the last project');
  {
    const b = await start();
    const t = await welcomeTitle(b);
    ok(t.startsWith('ready welcome · 1 recent'), 'the welcome screen counts one recent project', t);
    ok((await b.evaluate(`document.querySelector('#reopen')?.textContent`)) === 'Reopen My todos', 'its first button reopens My todos');
    await shot(b, 'welcome-reopen');
    await b.clickSel('#reopen');
    ok(/^ready My todos /.test(await editorReady(b)), 'Reopen opens it in the editor');
    ok((await backendUp(b))?.phase === 'running', 'its backend is started again');
    const note = await openRows(b, 'Task');
    ok(/^1 row\(s\)/.test(note || '') && (await backendRows(todos, 'Task')).length === 1, 'the row added before the quit is there', note);
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
    const t = await editorReady(b);
    ok(/^ready Imported /.test(t), 'Import an app… ends with the new project open in the editor', t);
    const pj = existsSync(join(imported, 'nodegx.project.json')) ? readJson(join(imported, 'nodegx.project.json')) : {};
    ok(pj.metadata?.imported?.by === 'nodegx-studio' && pj.name === 'Imported' && pj.metadata.imported.appId === 'backend-only' && existsSync(join(imported, 'docs/IMPORT-REPORT.md')), 'the folder holds the importer\'s project, named as the person named it, and its report', { name: pj.name, appId: pj.metadata?.imported?.appId });
    ok(JSON.stringify(recentDirs()) === JSON.stringify([imported, todos]), 'the recent list is newest first', recentDirs());
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
    ok(JSON.stringify(recentDirs()) === JSON.stringify([imported, todos]), 'its ✕ takes it off the list on disk, and only it', recentDirs());
    await stop();
  }

  console.log('7. the smoke run with no project');
  {
    const env = { ...process.env, NODEGX_STUDIO_USER_DATA: userData };
    delete env.ELECTRON_RUN_AS_NODE;
    let out = '';
    const code = await new Promise((r) => { const p = spawn(electron, [studioRoot, '--smoke'], { env }); p.stdout.on('data', (d) => (out += d)); p.on('exit', r); });
    ok(code === 0 && /smoke: ready welcome · 2 recent/.test(out), 'npm run smoke with no project draws the welcome screen and exits 0', { code, out: out.trim().split('\n')[0] });
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
