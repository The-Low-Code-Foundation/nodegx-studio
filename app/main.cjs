/**
 * NodeGX Studio as a desktop app. The editor is `editor/studio.html` served by `editor/serve.mjs`; this file starts
 * that server for a project folder on this machine and shows it in a window. Nothing leaves the machine: the project
 * is a folder of files, the server listens on 127.0.0.1 only, and the backend it talks to is the one the project
 * names (a local `nodegx-backend` unless the person bound another).
 *
 *   npm start                       the welcome screen: recent projects, a new one from a template, an import (STU-003)
 *   npm start -- <project-dir>      opens that folder
 *   npm start -- [<project-dir>] --smoke   opens it (or the welcome screen), waits for it to draw, prints the result
 *                                          and quits (exit 0/1)
 *
 * STU-009: one window, a tab per project. The window's own page is the tab strip (tabs.html); each tab is a
 * WebContentsView with its own editor server, showing that project's Studio or, with none, the welcome screen. A
 * project opened from a welcome tab takes that tab; opened from anywhere else it gets a tab of its own, or the tab that
 * already shows it.
 *
 * For the gate (app/check.mjs): NODEGX_STUDIO_USER_DATA puts the recent list somewhere else, `--hidden` keeps the
 * window off screen, and NODEGX_STUDIO_TEST_PICKS (a JSON array of paths) answers the open / save dialogs in order;
 * an object in it answers Publish's server form (STU-071), and chooses the server path.
 */
const { app, BrowserWindow, WebContentsView, Menu, dialog, ipcMain, nativeTheme, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

if (process.env.NODEGX_STUDIO_USER_DATA) app.setPath('userData', path.resolve(process.env.NODEGX_STUDIO_USER_DATA));

const args = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => a !== '.');
const smoke = args.includes('--smoke');
const hidden = smoke || args.includes('--hidden');
const projectArg = args.find((a) => !a.startsWith('--'));
const serveJs = path.join(__dirname, '..', 'editor', 'serve.mjs');
const actionsUrl = require('node:url').pathToFileURL(path.join(__dirname, 'actions.mjs')).href;
const publishUrl = require('node:url').pathToFileURL(path.join(__dirname, '..', 'lib', 'publish.mjs')).href;
const recentFile = () => path.join(app.getPath('userData'), 'recent-projects.json');
const sitesFile = () => path.join(app.getPath('userData'), 'published-sites.json');
const serversFile = () => path.join(app.getPath('userData'), 'published-servers.json');
const testPicks = process.env.NODEGX_STUDIO_TEST_PICKS ? JSON.parse(process.env.NODEGX_STUDIO_TEST_PICKS) : null;

// STU-009: one Studio at a time. A second launch (Window ↗ in a conversation, which NodeGX runs as `open -n -a` on macOS
// and the executable elsewhere; a double-click) hands its project to the Studio already running, which opens it in a
// tab, and quits. The gates run --hidden, each apart, unless one asks for the lock to test it.
if ((!hidden || process.env.NODEGX_STUDIO_SINGLE_INSTANCE) && !app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', (_event, argv) => {
  if (win && !hidden) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  const dir = actions && argv.slice(1).find((a) => !a.startsWith('--') && actions.isProject(a));
  if (dir) open(path.resolve(dir));
});

const TAB_H = 38; // the strip's height (tabs.html)
let win = null;
let tabs = []; // { id, view, dir: the project it shows or null (welcome), server: its editor server, busy }
let activeId = null;
let nextId = 1;
const closing = new Map(); // project folder → its server stopping, which the next open of it waits for
let actions = null; // app/actions.mjs, an ES module

const activeTab = () => tabs.find((t) => t.id === activeId) ?? null;
const tabOf = (contents) => tabs.find((t) => t.view.webContents === contents) ?? null;
const tabTitle = (t) => (t.dir ? path.basename(t.dir) : 'Welcome');

/** Starts serve.mjs for a tab on a free loopback port under Electron's own Node, and resolves with its URL. */
async function startServer(tab, projectDir) {
  await stopServer(tab);
  await closing.get(projectDir);
  return new Promise((ok, no) => {
    const child = spawn(process.execPath, [serveJs, projectDir], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    tab.server = child;
    let out = '';
    const on = (d) => {
      out += d;
      const m = out.match(/nodegx-studio: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (m) ok(m[1]);
    };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    child.on('exit', (code) => {
      if (tab.server === child) tab.server = null;
      no(new Error(out.trim() || `the editor server stopped (exit ${code})`));
    });
  });
}

/** app.exit skips before-quit, so every exit goes through here and takes every tab's server with it. */
function quit(code) {
  stopAll().then(() => app.exit(code));
}
const stopAll = () => Promise.all(tabs.map((t) => stopServer(t)));

/**
 * Stops the editor server and resolves once it has gone. It stops the project's backend on its way out (STU-004),
 * which takes up to a few seconds; opening the project again before that finished would adopt a backend that is
 * about to stop, so nothing opens, and the app does not quit, until it has.
 */
function stopServer(tab) {
  const child = tab?.server;
  if (tab) tab.server = null;
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((ok) => {
    const late = setTimeout(() => {
      child.kill('SIGKILL');
      ok();
    }, 10000);
    child.once('exit', () => {
      clearTimeout(late);
      ok();
    });
    child.kill();
  });
}

/** The one window. Its own page is the tab strip; the tabs' pages report readiness in document.title ("ready …"). */
function windowFor() {
  if (win) return win;
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 760,
    minHeight: 520,
    show: !hidden,
    // --hidden (the gates, the smoke run): a view in a hidden window is a hidden page, and a hidden page takes no
    // input, so the window is shown, but transparent, without the focus and out of the taskbar
    ...(hidden ? { opacity: 0, skipTaskbar: true } : {}),
    backgroundColor: '#0b0e12',
    title: 'NodeGX Studio',
    icon: path.join(__dirname, 'icon.png'), // Windows and Linux; macOS takes the Dock's (below) until STU-007 packages one
    webPreferences: { preload: path.join(__dirname, 'tabs-preload.cjs') }
  });
  win.on('closed', () => (win = null));
  win.on('resize', layout);
  win.on('page-title-updated', (event) => event.preventDefault());
  win.loadFile(path.join(__dirname, 'tabs.html')).catch(loadCut);
  if (hidden) win.showInactive();
  if (smoke) setTimeout(() => (console.log('smoke: the window did not report ready in 90 s'), quit(1)), 90000);
  return win;
}

/** What the strip draws, and the window's title: the active tab's project. */
function sendState() {
  if (!win) return;
  win.webContents.send('tabs:state', tabs.map((t) => ({ id: t.id, title: tabTitle(t), dir: t.dir, active: t.id === activeId, busy: !!t.busy })));
  const a = activeTab();
  win.setTitle(a?.dir ? `${tabTitle(a)} — NodeGX Studio` : 'NodeGX Studio');
}
/** Every tab's page fills the window under the strip; only the active one is shown. */
function layout() {
  if (!win) return;
  const [width, height] = win.getContentSize();
  for (const t of tabs) {
    t.view.setBounds({ x: 0, y: TAB_H, width, height: Math.max(0, height - TAB_H) });
    t.view.setVisible(t.id === activeId);
  }
}
function select(id) {
  if (!tabs.some((t) => t.id === id)) return;
  activeId = id;
  layout();
  sendState();
  menu();
  activeTab()?.view.webContents.focus();
}
/** A new tab, active, empty until it shows the welcome screen or a project. */
function newTab() {
  const w = windowFor();
  const view = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: !hidden } });
  view.setBackgroundColor('#eef0f3');
  const tab = { id: nextId++, view, dir: null, server: null, busy: false };
  // links the app opens go to the person's browser, not into the editor
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  view.webContents.on('page-title-updated', (_event, title) => {
    if (smoke && title.startsWith('ready')) {
      console.log(`smoke: ${title}`);
      quit(0);
    }
  });
  w.contentView.addChildView(view);
  tabs.push(tab);
  select(tab.id);
  return tab;
}
/** Closes a tab and stops its server (its edits are already saved); the last one closed leaves a welcome tab. */
function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const i = tabs.indexOf(tab);
  tabs.splice(i, 1);
  win?.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (tab.dir) {
    const stopping = stopServer(tab).then(() => closing.delete(tab.dir));
    closing.set(tab.dir, stopping);
  }
  if (!tabs.length) return showWelcome(newTab());
  if (activeId === id) activeId = (tabs[i] ?? tabs[i - 1]).id;
  select(activeId);
}
function moveTab(id, to) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  tabs.splice(tabs.indexOf(tab), 1);
  tabs.splice(Math.max(0, Math.min(tabs.length, to)), 0, tab);
  sendState();
  menu();
}
const cycle = (by) => tabs.length && select(tabs[(tabs.indexOf(activeTab()) + by + tabs.length) % tabs.length].id);

/** Shows a project in a tab. `report`: an import just made it, so its report opens beside it (STU-040). */
async function openIn(tab, projectDir, { report = false } = {}) {
  let url;
  tab.busy = true;
  sendState();
  try {
    url = await startServer(tab, projectDir);
  } catch (err) {
    tab.busy = false;
    sendState();
    busy('', tab);
    dialog.showErrorBox('NodeGX Studio could not open the project', err.message);
    if (smoke) quit(1);
    return;
  }
  tab.dir = projectDir;
  tab.busy = false;
  actions.rememberRecent(recentFile(), projectDir);
  app.addRecentDocument(projectDir);
  sendState();
  menu();
  await tab.view.webContents.loadURL(report ? `${url}?report=import` : url).catch(loadCut);
}
/** Opens a project: the tab already showing it; else the welcome tab that asked, or the active tab when it is a
    welcome tab; else a new tab. */
async function open(projectDir, options = {}, from = null) {
  const dir = path.resolve(projectDir);
  const there = tabs.find((t) => t.dir === dir);
  if (there) return select(there.id);
  const a = activeTab();
  const tab = (from && !from.dir ? from : null) ?? (a && !a.dir ? a : null) ?? newTab();
  select(tab.id);
  return openIn(tab, dir, options);
}

/** A load that the next one replaces, or that quitting cuts off (the smoke run quits as soon as the page has drawn,
    while its web fonts may still be loading), rejects; the page reports its own readiness, so this is only logged. */
function loadCut(err) {
  if (!/ERR_ABORTED|ERR_FAILED \(-2\)/.test(err.message)) console.warn(`nodegx-studio: ${err.message}`);
}

/** STU-003: the welcome screen in a tab. Showing it there closes the project that tab had (every edit is already saved). */
async function showWelcome(tab) {
  await stopServer(tab);
  tab.dir = null;
  sendState();
  menu();
  await tab.view.webContents.loadFile(path.join(__dirname, 'welcome.html')).catch(loadCut);
}
/** File → Welcome and the strip's +: the welcome tab there is, or a new one. */
function welcome() {
  const there = tabs.find((t) => !t.dir && !t.busy);
  if (there) {
    select(there.id);
    return Promise.resolve();
  }
  return showWelcome(newTab());
}

/** A dialog, or the gate's next answer. Resolves with a path or null. */
async function pick(kind, options) {
  if (testPicks) return testPicks.shift() ?? null;
  if (kind === 'save') {
    const { canceled, filePath } = await dialog.showSaveDialog(win, { properties: ['createDirectory', 'showOverwriteConfirmation'], ...options });
    return canceled ? null : filePath;
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, options);
  return canceled ? null : filePaths[0] ?? null;
}

async function chooseProject() {
  const dir = await pick('open', { title: 'Open a NodeGX project', message: 'Choose the folder that holds nodegx.project.json', properties: ['openDirectory'] });
  if (!dir) return null;
  if (!actions.isProject(dir)) {
    await dialog.showMessageBox(win, { type: 'warning', message: 'That folder is not a NodeGX project', detail: `${dir} has no nodegx.project.json.` });
    return testPicks ? null : chooseProject();
  }
  return dir;
}

/** Where a new project goes: the person names a new folder (the save dialog), by default in Documents. */
const chooseDestination = (title, name, buttonLabel) =>
  pick('save', { title, message: 'Name the new project. Its folder is made for it.', defaultPath: path.join(app.getPath('documents'), name), buttonLabel, nameFieldLabel: 'Project:' });

/** The importer's source, as the welcome screen's guide asked for it (STU-040): an export file, or a folder of the app's page files. */
function chooseImportSource(kind) {
  if (kind === 'folder') return pick('open', { title: 'Import an app from a folder', message: 'The folder holding the dynamic.js file of each page', properties: ['openDirectory'] });
  return pick('open', { title: 'Import an app from an export file', properties: ['openFile'], filters: [{ name: 'App export', extensions: ['json', 'bubble'] }] });
}

/** Each handler answers `{ error }` when nothing happened; a project opens after the answer, because opening it may
    replace the page that asked. Each is handed the tab that asked, so what it opens or says goes there. */
const busy = (text, tab = activeTab()) => tab?.view.webContents.send('studio:busy', text);
const later = (fn) => setImmediate(() => Promise.resolve(fn()).catch((err) => dialog.showErrorBox('NodeGX Studio', err.message)));
const asking = (fn) => async (event, ...rest) => {
  try {
    return (await fn(tabOf(event.sender), ...rest)) ?? { ok: true };
  } catch (err) {
    return { error: err.message };
  }
};
function handlers() {
  ipcMain.handle('studio:welcome', asking(() => ({ recent: actions.readRecent(recentFile()), templates: actions.templates(), version: app.getVersion(), home: app.getPath('home') })));
  ipcMain.handle(
    'studio:open',
    asking((tab, dir) => {
      if (!actions.isProject(dir)) return { error: `${dir} is no longer a NodeGX project folder — it was moved or deleted.` };
      busy('Opening…', tab);
      later(() => open(dir, {}, tab));
    })
  );
  ipcMain.handle(
    'studio:open-folder',
    asking(async (tab) => {
      const dir = await chooseProject();
      if (!dir) return { cancelled: true };
      busy('Opening…', tab);
      later(() => open(dir, {}, tab));
    })
  );
  ipcMain.handle(
    'studio:new',
    asking(async (tab, slug) => {
      const t = actions.templates().find((x) => x.slug === slug);
      if (!t) return { error: `There is no template called ${slug}.` };
      const dest = await chooseDestination(`New project from ${t.title}`, t.title, 'Create');
      if (!dest) return { cancelled: true };
      busy(`Copying ${t.title}…`, tab);
      const { dir } = await actions.createFromTemplate(slug, dest);
      later(() => open(dir, {}, tab));
    })
  );
  ipcMain.handle('studio:import', asking(importFlow));
  ipcMain.handle('studio:publish', asking(publishFlow));
  ipcMain.handle(
    'studio:forget',
    asking((_tab, dir) => {
      actions.forgetRecent(recentFile(), dir);
      menu();
    })
  );
  ipcMain.handle('studio:reveal', asking((_tab, dir) => shell.showItemInFolder(dir)));
  // the strip (tabs.html)
  ipcMain.on('tabs:ready', () => sendState());
  ipcMain.on('tabs:select', (_event, id) => select(id));
  ipcMain.on('tabs:close', (_event, id) => closeTab(id));
  ipcMain.on('tabs:add', () => welcome());
  ipcMain.on('tabs:move', (_event, id, to) => moveTab(id, to));
}

/** Import an App…: the source, the new folder, the importer, then the project with its report (`docs/IMPORT-REPORT.md`) open beside it. */
async function importFlow(tab, kind = 'file') {
  const source = await chooseImportSource(kind);
  if (!source) return { cancelled: true };
  const dest = await chooseDestination('Import into a new NodeGX project', path.basename(source).replace(/\.(json|bubble)$/i, '').replace(/\.export$/i, '') || 'Imported app', 'Import');
  if (!dest) return { cancelled: true };
  busy('Importing — a large app takes a minute…', tab);
  const { dir } = await actions.importApp(source, dest);
  later(() => open(dir, { report: true }, tab));
}

/* ---------------------------------------------------------------- STU-008: Publish */

/** The folder each project was last published to, so the next Publish offers it again (`{ [projectDir]: siteDir }`). */
const readSites = () => {
  try {
    return JSON.parse(require('node:fs').readFileSync(sitesFile(), 'utf8'));
  } catch {
    return {};
  }
};
const rememberSite = (dir, site) => {
  const fs = require('node:fs');
  fs.mkdirSync(path.dirname(sitesFile()), { recursive: true });
  fs.writeFileSync(sitesFile(), JSON.stringify({ ...readSites(), [dir]: site }, null, 2) + '\n');
};

/** A question with buttons; under the gate the first button is the answer, and the question is kept for it to read. */
async function ask(asked, options) {
  asked.push(options.message);
  if (testPicks) return 0;
  return (await dialog.showMessageBox(win, options)).response;
}

const home = (p) => p.replace(app.getPath('home'), '~');

/**
 * File → Publish… (and the header's Publish): where the site goes, then NodeGX's deploy (lib/publish.mjs). An app
 * whose backend is on this computer is said to work here only before anything is written; R10 rules where else it can go.
 * Answers with what was published, and what the window said, so the page and the gate can read it.
 */
async function publishFlow(tab) {
  const dir = tab?.dir ?? activeTab()?.dir;
  if (!dir) return { error: 'Open a project first: Publish writes the open app as a site.' };
  const pub = await import(publishUrl);
  const asked = [];
  // STU-071: a folder on this computer, or a server of the person's own (R10). Under the gate a pick that is an object
  // is the server form's answers, so the server path is chosen; a path (or nothing) keeps the folder, as before.
  const lastServer = readServers()[dir];
  const where = testPicks
    ? testPicks[0] && typeof testPicks[0] === 'object' ? 1 : 0
    : await ask(asked, {
        type: 'question',
        message: 'Where should the app go?',
        detail:
          'A folder holds the site, to put on any web host; its backend stays where it is now.\n\n' +
          `A server of your own (Linux, over ssh) gets the app, its backend, its data and its cloud functions, so anyone who can reach it can use the app.${lastServer ? `\n\nLast time: ${lastServer.host}.` : ''}`,
        buttons: ['A Folder on This Computer…', 'A Server of Your Own…', 'Cancel'],
        defaultId: lastServer ? 1 : 0,
        cancelId: 2
      });
  if (where === 2) return { cancelled: true, asked };
  // P26-SKELSHIP (NodeGX, ruled 2026-10-26): never refused; asked, on both routes, before anything is written.
  const unbuilt = pub.unbuiltPagesOf(dir);
  if (unbuilt.length) {
    const answer = await ask(asked, {
      type: 'warning',
      message: 'Nothing is built in this app yet',
      detail: pub.unbuiltQuestion(unbuilt),
      buttons: ['Publish Anyway', 'Cancel'],
      cancelId: 1
    });
    if (answer !== 0) return { cancelled: true, asked };
  }
  if (where === 1) return publishToServerFlow(dir, pub, asked);
  const target = pub.backendTargetOf(dir);
  if (target.local) {
    const answer = await ask(asked, {
      type: 'info',
      message: target.live ? 'This app’s live database runs on this computer' : 'This app’s backend runs on this computer',
      detail: `The site will talk to ${target.live ? 'the live database at ' : ''}${target.endpoint}, which only this computer can reach, and only while Studio (or the NodeGX editor) runs that backend. Publish it to try it in a browser here; to put the app and its backend where others can reach them, publish to a server of your own instead.`,
      buttons: ['Continue', 'Cancel'],
      cancelId: 1
    });
    if (answer !== 0) return { cancelled: true, asked };
  }
  const last = readSites()[dir];
  let out = null;
  if (last && require('node:fs').existsSync(path.join(last, pub.MARKER)) && !testPicks) {
    const { response } = await dialog.showMessageBox(win, { type: 'question', message: 'Publish again?', detail: `This app was last published to ${home(last)}. Publishing again replaces that site.`, buttons: [`Publish to ${path.basename(last)}`, 'Choose Another Folder…', 'Cancel'], cancelId: 2 });
    if (response === 2) return { cancelled: true, asked };
    if (response === 0) out = last;
  }
  out ??= await pick('save', {
    title: 'Publish the app as a site',
    message: 'Name the folder the site goes in. It is made for it.',
    defaultPath: last ?? path.join(app.getPath('documents'), pub.defaultSiteName(dir)),
    buttonLabel: 'Publish',
    nameFieldLabel: 'Site:'
  });
  if (!out) return { cancelled: true, asked };
  let result;
  try {
    result = await pub.publish(dir, out);
  } catch (err) {
    if (!testPicks) dialog.showErrorBox('The app was not published', err.message);
    throw err;
  }
  rememberSite(dir, result.site);
  const lines = [`${result.files} files in ${home(result.site)}. Serve that folder with any web server and open it in a browser.`];
  // What NodeGX's deploy warned about (a page nobody built, a wire that goes nowhere): said, not only returned.
  for (const warning of result.warnings ?? []) lines.push(`⚠️ ${warning}`);
  if (result.routing.type === 'path') lines.push(`Its pages have addresses of their own${result.routing.example ? ` (such as ${result.routing.example})` : ''}. Opening the site’s first address works on any web server; for a link to a page, or a reload on one, the server must answer every address it has no file for with index.html. Most hosts have a setting for that (often called a single-page app’s fallback or rewrite).`);
  if (result.backend.endpoint) lines.push(`It talks to the ${result.backend.live ? 'live database' : 'backend'} at ${result.backend.endpoint}${result.backend.local ? ', on this computer only' : ''}.`);
  else lines.push('It has no backend: it keeps no rows.');
  const schema = result.schema;
  if (schema?.status === 'deployed') lines.push(`Live’s schema was brought up to development’s: ${schema.done.join('; ')}.`);
  else if (schema?.status === 'behind') lines.push(`Live still has what development dropped (${schema.lost.join('; ')}). Data → Deploy to live removes it, after asking.`);
  else if (schema?.status === 'skipped') lines.push(schema.reason);
  const fns = result.functions;
  if (fns.status === 'deployed') lines.push(`Cloud functions: ${fns.result.functions.length} on the backend (${fns.result.changed ? 'updated' : 'already up to date'}).`);
  else if (fns.status !== 'none') lines.push(`Cloud functions: ${fns.reason ?? 'not deployed'}.`);
  if (result.exposed.length) lines.push(`Also published, and readable by anyone who can open the site: ${result.exposed.join(', ')}. The app does not need them; a .noodlignore in the project with those names keeps them out.`);
  const summary = { ...result, asked, said: lines };
  if (testPicks) return summary;
  const { response } = await dialog.showMessageBox(win, { type: fns.status === 'failed' || result.warnings?.length ? 'warning' : 'info', message: result.replaced ? 'The site was published again' : 'The app is published', detail: lines.join('\n\n'), buttons: ['Show the Site’s Folder', 'Done'], defaultId: 1, cancelId: 1 });
  if (response === 0) shell.showItemInFolder(result.index);
  return summary;
}

/* ---------------------------------------------------------------- STU-071: Publish to a server (R10) */

/** The server each project was last published to, with the answers the person typed (`{ [projectDir]: answers }`). */
const readServers = () => {
  try {
    return JSON.parse(require('node:fs').readFileSync(serversFile(), 'utf8'));
  } catch {
    return {};
  }
};
const rememberServer = (dir, answers) => {
  const fs = require('node:fs');
  fs.mkdirSync(path.dirname(serversFile()), { recursive: true });
  fs.writeFileSync(serversFile(), JSON.stringify({ ...readServers(), [dir]: answers }, null, 2) + '\n');
};

/** The opening deploy_to_vm gives `next` when it has warnings (NodeGX P26-SKELSHIP), addressed to an agent. */
const AGENT_SAY_WARNINGS = /^Before anything else, tell the person what each line of `warnings` says\. /;

/** "Which server?" (app/server.html), a sheet on the Studio window. Resolves with the answers, or null on Cancel. */
function askServer(fill) {
  if (testPicks) return Promise.resolve(testPicks.shift() ?? null);
  return new Promise((resolve) => {
    const sheet = new BrowserWindow({
      parent: win,
      modal: true,
      width: 480,
      height: 560,
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      title: 'Publish to a server',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#14171c' : '#eef0f3', // server.html's --bg, no flash before it paints
      webPreferences: { preload: path.join(__dirname, 'server-preload.cjs') }
    });
    let settled = false;
    const done = (answers) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('server:ready', onReady);
      ipcMain.removeListener('server:answer', onAnswer);
      if (!sheet.isDestroyed()) sheet.close();
      resolve(answers);
    };
    const mine = (event) => event.sender === sheet.webContents;
    const onReady = (event) => {
      if (!mine(event)) return;
      sheet.webContents.send('server:fill', fill);
      sheet.show();
    };
    const onAnswer = (event, answers) => mine(event) && done(answers);
    ipcMain.on('server:ready', onReady);
    ipcMain.on('server:answer', onAnswer);
    sheet.on('closed', () => done(null));
    sheet.setMenu?.(null);
    sheet.loadFile(path.join(__dirname, 'server.html'));
  });
}

/**
 * The app onto a server by NodeGX's deploy_to_vm (lib/publish.mjs `publishToServer`). Asks again, with the reason, until
 * the answers are ones NodeGX would take; remembers them before the ship so a failed one keeps what was typed.
 */
async function publishToServerFlow(dir, pub, asked) {
  let answers = readServers()[dir] ?? { app: pub.serverAppName(dir), port: String(pub.DEFAULT_SERVER_PORT) };
  let problem = null;
  for (;;) {
    asked.push('Publish to a server of your own');
    answers = await askServer({ answers, problem });
    if (!answers) return { cancelled: true, asked };
    ({ problem } = pub.serverRequest(answers));
    if (!problem) break;
    if (testPicks) return { error: problem, asked };
  }
  rememberServer(dir, answers);
  let result;
  try {
    result = await pub.publishToServer(dir, answers);
  } catch (err) {
    if (!testPicks) dialog.showErrorBox('The app was not published', err.message);
    throw err;
  }
  const lines = [result.url ? `It is at ${result.url}` : `It runs on ${result.host} without a public address. To see it from here: ${result.see}`];
  for (const warning of result.warnings ?? []) lines.push(`⚠️ ${warning}`);
  lines.push(`${result.build.files} files, ${result.build.functions.length ? `${result.build.functions.length} cloud function${result.build.functions.length === 1 ? '' : 's'} (${result.build.functions.join(', ')})` : 'no cloud functions'}, ${result.build.rules === 'project' ? 'the project’s access rules' : 'the access rules already on the server'}.`);
  if (result.secrets.length) lines.push(`Function secrets sent: ${result.secrets.join(', ')} (their values never leave this computer any other way).`);
  // deploy_to_vm's `next` is for an agent: with warnings it opens by telling the agent to say them, which this window
  // has just done.
  if (result.next) lines.push(result.next.replace(AGENT_SAY_WARNINGS, ''));
  const summary = { ...result, target: 'server', asked, said: lines };
  if (testPicks) return summary;
  const buttons = result.url ? ['Open It', 'Done'] : ['Done'];
  const { response } = await dialog.showMessageBox(win, { type: result.warnings?.length ? 'warning' : 'info', message: `The app is on ${result.host}`, detail: lines.join('\n\n'), buttons, defaultId: 0, cancelId: buttons.length - 1 });
  if (result.url && response === 0) shell.openExternal(result.url);
  return summary;
}

function menu() {
  const recent = actions.readRecent(recentFile()).filter((p) => p.exists);
  const a = activeTab();
  const page = () => activeTab()?.view.webContents;
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => welcome() },
        { label: 'Welcome', accelerator: 'CmdOrCtrl+Shift+H', click: () => welcome() },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const dir = await chooseProject();
            if (dir) open(dir);
          }
        },
        {
          label: 'Open Recent',
          submenu: recent.length ? recent.map((p) => ({ label: `${p.name} — ${p.dir.replace(app.getPath('home'), '~')}`, click: () => open(p.dir) })) : [{ label: 'No recent projects', enabled: false }]
        },
        { label: 'New from a Template…', click: () => welcome() },
        // the welcome screen's guide says what to bring before any dialog opens
        { label: 'Import an App…', click: () => welcome().then(() => page()?.executeJavaScript('window.openImportGuide?.()')) },
        { type: 'separator' },
        { label: 'Show Project Folder', enabled: !!a?.dir, click: () => a?.dir && shell.openPath(a.dir) },
        { label: 'Publish…', enabled: !!a?.dir, click: () => page()?.executeJavaScript('window.__ob?.publish?.()') },
        { label: 'Connect Claude Code…', enabled: !!a?.dir, click: () => page()?.executeJavaScript('window.__ob?.openAgent?.()') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => activeId !== null && closeTab(activeId) },
        process.platform === 'darwin' ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        // the tab's page, not the strip's
        { label: 'Reload Tab', accelerator: 'CmdOrCtrl+R', click: () => page()?.reload() },
        { label: 'Toggle Developer Tools', accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => page()?.toggleDevTools() },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => page()?.setZoomLevel(0) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => page() && page().setZoomLevel(page().getZoomLevel() + 0.5) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => page() && page().setZoomLevel(page().getZoomLevel() - 0.5) },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(process.platform === 'darwin' ? [{ role: 'zoom' }] : []),
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => cycle(1) },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => cycle(-1) },
        { type: 'separator' },
        ...tabs.map((t, i) => ({ label: tabTitle(t), type: 'radio', checked: t.id === activeId, accelerator: i < 9 ? `CmdOrCtrl+${i + 1}` : undefined, click: () => select(t.id) })),
        ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [])
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && !hidden) app.dock?.setIcon(path.join(__dirname, 'icon.png'));
  actions = await import(actionsUrl);
  handlers();
  menu();
  const first = newTab();
  if (projectArg) {
    if (actions.isProject(projectArg)) return openIn(first, path.resolve(projectArg));
    if (smoke) {
      console.log(`smoke: ${projectArg} is not a NodeGX project`);
      return quit(1);
    }
    await dialog.showMessageBox({ type: 'warning', message: 'That folder is not a NodeGX project', detail: `${path.resolve(projectArg)} has no nodegx.project.json.` });
  }
  showWelcome(first);
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (!tabs.some((t) => t.server) && !closing.size) return;
  event.preventDefault();
  Promise.all([stopAll(), ...closing.values()]).then(() => {
    tabs = [];
    closing.clear();
    app.quit();
  });
});
// Ctrl-C in the terminal that started it, or a gate stopping it: the editor server goes too, never left running alone
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => quit(0));
