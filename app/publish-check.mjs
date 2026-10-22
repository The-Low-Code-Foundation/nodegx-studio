/**
 * NodeGX Studio — Publish's gate (STU-008). Plain Node, no window: lib/publish.mjs is what File → Publish… runs, and
 * app/check.mjs drives that menu's flow in the real app. Everything here is read off what was written, served or
 * stored — the site on disk, a page in headless Chrome, the backend over HTTP — never Publish's own report alone.
 *
 *   1. a copy of the todo template, its backend started (under a backends folder of the gate's own)
 *   2. the folders Publish refuses, each left as it was: inside the project, one holding other files, another app's site
 *   3. published: the production engine, the marker, the backend named and said to be this machine's only
 *   4. the done-when: the site served by a plain static server, opened in a browser — an account made, a todo added,
 *      the row on the backend; then signed out, the page reloaded, signed in again, and the todo is there
 *   5. published again into the same folder: the last publish's files are replaced, a file the person put there stays
 *   6. an app with cloud functions (the importer's backend-workflow fixtures): published, its four functions deployed
 *      to its backend by NodeGX's deploy_cloud_functions, a second publish finds them unchanged, and one answers
 *   7. STU-065: the todo app with a live database: published, the site names live; a field development added since is
 *      deployed to live first; a todo added in the published app is on live and not on development
 *
 *   node app/publish-check.mjs     PASS n/n and exit 0, or the failing lines and exit 1
 */
import { cpSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { browser } from '../editor/cdp.mjs';
import { studioRoot } from '../lib/nodegx.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'nodegx-studio-publish-check-'));
process.env.NODEGX_BACKENDS_DIR = join(tmp, 'backends'); // before the kit loads: nothing is written to ~/.noodl
const { createFromTemplate, importApp } = await import('./actions.mjs');
const backend = await import('../lib/backend.mjs');
const { publish, claimSiteFolder, MARKER } = await import('../lib/publish.mjs');
const lives = await import('../lib/live.mjs');

const results = [];
const ok = (cond, what, detail) => { results.push(!!cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`); };
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const freePort = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const listing = (dir) => readdirSync(dir, { recursive: true }).filter((f) => statSync(join(dir, f)).isFile()).sort();
const refusal = (fn) => { try { fn(); return ''; } catch (err) { return err.message; } };
const secretOf = (id) => readJson(join(process.env.NODEGX_BACKENDS_DIR, id, 'secrets.json')).adminToken;
async function rows(up, collection) {
  const r = await fetch(`${up.endpoint}/classes/${collection}`, { headers: { 'X-Parse-Application-Id': up.id, 'X-Parse-Master-Key': secretOf(up.id) } });
  return (await r.json()).results ?? [];
}

/** Any static file server: a file, or index.html for a folder. Nothing about NodeGX in it. */
function serveStatic(root) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    let p = join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root)) p = null;
    else if (!existsSync(p) || statSync(p).isDirectory()) p = existsSync(join(p, 'index.html')) ? join(p, 'index.html') : null;
    if (!p) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => freePort().then((port) => server.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${port}/`, close: () => server.close() }))));
}

const started = [];
let b = null;
let site = null;
try {
  console.log('1. a copy of the todo template, its backend running');
  const todo = join(tmp, 'projects', 'My todos');
  mkdirSync(join(tmp, 'projects'));
  await createFromTemplate('todo-list', todo);
  const up = await backend.startFor(todo, await backend.localBackendOf(todo));
  started.push(up.id);
  ok(up.phase === 'running' && /^http:\/\/127\.0\.0\.1:\d+$/.test(up.endpoint), 'its own backend runs on this machine', up.endpoint);

  console.log('2. the folders Publish refuses');
  const inside = join(todo, 'site');
  ok(/inside the project/.test(refusal(() => claimSiteFolder(todo, inside))) && !existsSync(inside), 'a folder inside the project, which the next publish would copy as the app\'s own files', refusal(() => claimSiteFolder(todo, inside)));
  ok(/holds the project/.test(refusal(() => claimSiteFolder(todo, join(tmp, 'projects')))), 'the folder that holds the project');
  const theirs = join(tmp, 'their-folder');
  mkdirSync(theirs);
  writeFileSync(join(theirs, 'notes.txt'), 'mine');
  let said = '';
  try { await publish(todo, theirs); } catch (err) { said = err.message; }
  ok(/did not publish it/.test(said) && JSON.stringify(listing(theirs)) === '["notes.txt"]', 'a folder that holds other files is refused before anything is written, and keeps only its own file', { said, files: listing(theirs) });

  console.log('3. published');
  site = join(tmp, 'sites', 'My todos site');
  const r = await publish(todo, site);
  const marker = existsSync(join(site, MARKER)) ? readJson(join(site, MARKER)) : {};
  const engine = statSync(join(site, 'noodl.deploy.js')).size;
  ok(existsSync(join(site, 'index.html')) && r.files === marker.written?.length && r.files > 5, 'the site is in the folder, every file the deploy wrote named in its marker', { files: r.files });
  ok(r.engine === 'production' && engine > 1_000_000 && engine < 2_500_000, 'with the production engine npm ships', { kind: r.engine, bytes: engine });
  ok(marker.projectId === readJson(join(todo, 'nodegx.project.json')).id && marker.backend === up.endpoint, 'the marker names this project and the backend the site talks to', marker.projectName);
  ok(r.backend.local === true && r.backend.endpoint === up.endpoint, 'the result says the backend is this machine\'s only', r.backend);
  const index = readdirSync(site).find((f) => /^index-.*\.js$/.test(f));
  ok(index && readFileSync(join(site, index), 'utf8').includes(`"endpoint":"${up.endpoint}"`), 'the site carries the project\'s backend binding');
  ok(!existsSync(join(site, 'components')) && !existsSync(join(site, 'nodegx.project.json')) && !existsSync(join(site, 'docs')), 'and none of the project\'s source');
  ok(JSON.stringify(r.exposed) === '["nodegx.security.json"]' && existsSync(join(site, 'nodegx.security.json')), 'the access policy the engine also copies is named to the person (P123-STU008-BACKENDPUBLIC)', r.exposed);
  ok(r.functions.status === 'none', 'the todo app has no cloud functions to deploy', r.functions);

  console.log('4. the site, served statically and used in a browser');
  const served = await serveStatic(site);
  b = await browser({ port: await freePort(), width: 1200, height: 900 });
  const email = `gate-${Date.now()}@example.com`;
  const signIn = async (button) => {
    await b.until(`!!document.querySelector('input[type=email]')`, 30000);
    await b.clickSel('input[type=email]'); await b.type(email);
    await b.clickSel('input[type=password]'); await b.type('correct horse battery');
    await b.evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(button)}).click()`);
  };
  await b.goto(served.url);
  ok(await b.until(`location.pathname === '/sign-in' && !!document.querySelector('input[type=password]')`, 30000), 'the published app opens on its sign-in page');
  await signIn('Create account');
  const list = await b.until(`location.pathname !== '/sign-in' && document.querySelector('input[placeholder^="Add a task"]') && location.pathname`, 20000);
  ok(list, 'Create account signs in and shows the list', list);
  await b.clickSel('input[placeholder^="Add a task"]'); await b.type('Buy bread');
  await b.evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add').click()`);
  ok(await b.until(`/List \\(1\\)/.test(document.body.innerText)`, 15000), 'adding a todo puts it on the list');
  const stored = await rows(up, 'Task');
  ok(stored.length === 1 && stored[0].title === 'Buy bread', 'the row is on the backend', stored.map((t) => t.title));
  await b.evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Sign out').click()`);
  ok(await b.until(`location.pathname === '/sign-in'`, 15000), 'Sign out goes back to the sign-in page');
  await b.goto(served.url);
  await signIn('Sign in');
  ok(await b.until(`/Buy bread/.test(document.body.innerText)`, 20000), 'after a reload, signing in again shows the todo, read back from the backend');
  ok(b.problems.length === 0, 'the page threw nothing and logged no error', b.problems);
  await b.close(); b = null;
  served.close();

  console.log('5. published again into the same folder');
  writeFileSync(join(site, 'CNAME'), 'todo.example.com\n'); // the person's own file
  mkdirSync(join(site, 'noodl_bundles'), { recursive: true });
  writeFileSync(join(site, 'noodl_bundles', 'b9-old.json'), '{}'); // a bundle an earlier publish wrote
  writeFileSync(join(site, MARKER), JSON.stringify({ ...readJson(join(site, MARKER)), written: [...readJson(join(site, MARKER)).written, 'noodl_bundles/b9-old.json', '../outside.txt'] }));
  writeFileSync(join(tmp, 'sites', 'outside.txt'), 'not the site\'s');
  const again = await publish(todo, site);
  ok(again.replaced && !existsSync(join(site, 'noodl_bundles', 'b9-old.json')), 'the last publish\'s files are deleted before the new ones are written');
  ok(existsSync(join(site, 'CNAME')) && existsSync(join(tmp, 'sites', 'outside.txt')), 'a file the person put there stays, and a marker naming a file outside the site reaches nothing');
  ok(JSON.stringify(listing(site).filter((f) => f !== 'CNAME' && f !== MARKER)) === JSON.stringify([...readJson(join(site, MARKER)).written].sort()), 'the folder holds exactly the new publish, the marker and the person\'s file');
  const other = join(tmp, 'projects', 'Other');
  await createFromTemplate('story-engine', other);
  said = '';
  try { await publish(other, site); } catch (err) { said = err.message; }
  ok(/another app/.test(said) && existsSync(join(site, 'CNAME')), 'another app into that folder is refused: it holds this one\'s site', said);

  console.log('6. an app with cloud functions');
  const inDir = join(tmp, 'import-in');
  mkdirSync(inDir);
  for (const f of ['backend-workflows/example-c5r6j filled.json', 'option-sets/example-dxr78ubfdtfq6tbmec.json', 'database-schema/example-privacy-rule-entpawjzehwq0tbk.json']) cpSync(join(studioRoot, 'import', f), join(inDir, f.split('/').pop()));
  const cloudApp = join(tmp, 'projects', 'Imported');
  await importApp(inDir, cloudApp);
  const cup = await backend.provisionFor(cloudApp);
  started.push(cup.id);
  const c1 = await publish(cloudApp, join(tmp, 'sites', 'Imported site'));
  const fns = c1.functions.result?.functions ?? [];
  ok(c1.functions.status === 'deployed' && fns.length === 4 && fns.every((f) => f.status === 'deployed'), 'its four cloud functions are deployed to its backend by NodeGX\'s deploy_cloud_functions', fns.map((f) => `${f.name} ${f.status}`));
  ok(c1.exposed.includes('backend/triggers.imported.json'), 'the importer\'s proposed triggers, which the engine also copies, are named to the person', c1.exposed);
  const c2 = await publish(cloudApp, join(tmp, 'sites', 'Imported site'));
  ok(c2.functions.status === 'deployed' && c2.functions.result.changed === false && c2.functions.result.functions.every((f) => f.status === 'unchanged'), 'publishing again finds them unchanged on the backend', c2.functions.result?.functions?.map((f) => f.status));
  const callFn = async (name) => { const res = await fetch(`${cup.endpoint}/functions/${name}`, { method: 'POST', headers: { 'X-Parse-Application-Id': cup.id, 'X-Parse-Master-Key': secretOf(cup.id), 'content-type': 'application/json' }, body: '{}' }); return { status: res.status, answer: (await res.text()).slice(0, 160) }; };
  const known = await callFn('someApiWorkflow');
  const control = await callFn('noFunctionByThisName');
  console.log('  …', JSON.stringify({ known, control }));
  ok(JSON.stringify(known) !== JSON.stringify(control), 'and the backend answers a call to one differently from a name it does not serve, so it is served, not only reported', { known, control });

  console.log('7. STU-065: published against the live database');
  const liveUp = await backend.provisionLiveFor(todo); // what Data's Make a live database runs, then its first deploy
  started.push(liveUp.id);
  const asAdmin = (u) => lives.admin({ endpoint: u.endpoint, token: secretOf(u.id), appId: u.id });
  await lives.closeLive(asAdmin(liveUp));
  await lives.promote(asAdmin(up), asAdmin(liveUp));
  await asAdmin(up).post('/admin/schema', { action: 'addColumn', table: 'Task', column: { name: 'note', type: 'String' } }); // development moved on since
  const liveSite = join(tmp, 'sites', 'My todos live');
  const l1 = await publish(todo, liveSite);
  const liveIndex = readdirSync(liveSite).find((f) => /^index-.*\.js$/.test(f));
  const bundle = readFileSync(join(liveSite, liveIndex), 'utf8');
  ok(l1.backend.live === true && l1.backend.endpoint === liveUp.endpoint && bundle.includes(`"endpoint":"${liveUp.endpoint}"`) && !bundle.includes(`"endpoint":"${up.endpoint}"`), 'the site names the live database, not development', l1.backend);
  ok(l1.schema?.status === 'deployed' && l1.schema.done.some((d) => d.includes('note')) && ((await asAdmin(liveUp).get('/admin/schema')).tables.find((t) => t.name === 'Task')?.columns ?? []).some((c) => c.name === 'note'), 'development\'s new field went to live before the site was written', l1.schema);
  ok(readJson(join(todo, 'nodegx.project.json')).metadata.cloudservices.endpoint === up.endpoint && readdirSync(tmpdir()).every((n) => !n.startsWith('nodegx-studio-live-') || !existsSync(join(tmpdir(), n, 'My todos'))), 'the project still names development, and the copy published from is gone');
  const servedLive = await serveStatic(liveSite);
  b = await browser({ port: await freePort(), width: 1200, height: 900 });
  const liveEmail = `live-${Date.now()}@example.com`;
  await b.goto(servedLive.url);
  await b.until(`!!document.querySelector('input[type=email]')`, 30000);
  await b.clickSel('input[type=email]'); await b.type(liveEmail);
  await b.clickSel('input[type=password]'); await b.type('correct horse battery');
  await b.evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Create account').click()`);
  await b.until(`!!document.querySelector('input[placeholder^="Add a task"]')`, 20000);
  await b.clickSel('input[placeholder^="Add a task"]'); await b.type('Ship it');
  await b.evaluate(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add').click()`);
  await b.until(`/List \\(1\\)/.test(document.body.innerText)`, 15000);
  const onLive = await rows(liveUp, 'Task'), onDev = await rows(up, 'Task');
  ok(onLive.map((t) => t.title).join() === 'Ship it' && !onDev.some((t) => t.title === 'Ship it'), 'a todo added in the published app is on live, and development never saw it', { live: onLive.map((t) => t.title), development: onDev.map((t) => t.title) });
  await b.close(); b = null;
  servedLive.close();
} catch (err) {
  ok(false, 'the gate ran to the end', err.stack?.split('\n').slice(0, 3).join(' | '));
} finally {
  if (b) await b.close();
  for (const id of started) try { await backend.stop(id); } catch {}
  rmSync(tmp, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(passed === results.length ? `PASS ${passed}/${results.length}` : `FAIL ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
