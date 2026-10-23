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
 * For the gate (app/check.mjs): NODEGX_STUDIO_USER_DATA puts the recent list somewhere else, `--hidden` keeps the
 * window off screen, and NODEGX_STUDIO_TEST_PICKS (a JSON array of paths) answers the open / save dialogs in order.
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
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
const testPicks = process.env.NODEGX_STUDIO_TEST_PICKS ? JSON.parse(process.env.NODEGX_STUDIO_TEST_PICKS) : null;

let win = null;
let server = null;
let openDir = null; // the project the window shows, or null on the welcome screen
let actions = null; // app/actions.mjs, an ES module

/** Starts serve.mjs on a free loopback port under Electron's own Node, and resolves with its URL. */
async function startServer(projectDir) {
  await stopServer();
  return new Promise((ok, no) => {
    const child = spawn(process.execPath, [serveJs, projectDir], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server = child;
    let out = '';
    const on = (d) => {
      out += d;
      const m = out.match(/nodegx-studio: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (m) ok(m[1]);
    };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    child.on('exit', (code) => {
      if (server === child) server = null;
      no(new Error(out.trim() || `the editor server stopped (exit ${code})`));
    });
  });
}

/** app.exit skips before-quit, so every exit goes through here and takes the server with it. */
function quit(code) {
  stopServer().then(() => app.exit(code));
}

/**
 * Stops the editor server and resolves once it has gone. It stops the project's backend on its way out (STU-004),
 * which takes up to a few seconds; opening the project again before that finished would adopt a backend that is
 * about to stop, so nothing opens, and the app does not quit, until it has.
 */
function stopServer() {
  const child = server;
  server = null;
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

/** The one window. Its page reports readiness in document.title ("ready …"), which the window does not show. */
function windowFor() {
  if (win) return win;
  win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 760,
    minHeight: 520,
    show: !hidden,
    backgroundColor: '#eef0f3',
    title: 'NodeGX Studio',
    icon: path.join(__dirname, 'icon.png'), // Windows and Linux; macOS takes the Dock's (below) until STU-007 packages one
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: !hidden }
  });
  win.on('closed', () => (win = null));
  // links the app opens go to the person's browser, not into the editor window
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  win.on('page-title-updated', (event, title) => {
    event.preventDefault();
    if (smoke && title.startsWith('ready')) {
      console.log(`smoke: ${title}`);
      quit(0);
    }
  });
  if (smoke) setTimeout(() => (console.log('smoke: the window did not report ready in 90 s'), quit(1)), 90000);
  return win;
}

/** Opens a project in the window. `report`: an import just made it, so its report opens beside it (STU-040). */
async function open(projectDir, { report = false } = {}) {
  let url;
  try {
    url = await startServer(projectDir);
  } catch (err) {
    busy('');
    dialog.showErrorBox('NodeGX Studio could not open the project', err.message);
    if (smoke) quit(1);
    return;
  }
  openDir = projectDir;
  actions.rememberRecent(recentFile(), projectDir);
  app.addRecentDocument(projectDir);
  menu();
  const w = windowFor();
  w.setTitle(`${path.basename(projectDir)} — NodeGX Studio`);
  await w.loadURL(report ? `${url}?report=import` : url).catch(loadCut);
}

/** A load that the next one replaces, or that quitting cuts off (the smoke run quits as soon as the page has drawn,
    while its web fonts may still be loading), rejects; the page reports its own readiness, so this is only logged. */
function loadCut(err) {
  if (!/ERR_ABORTED|ERR_FAILED \(-2\)/.test(err.message)) console.warn(`nodegx-studio: ${err.message}`);
}

/** STU-003: the welcome screen. Showing it closes the open project (every edit is already saved). */
async function welcome() {
  await stopServer();
  openDir = null;
  menu();
  const w = windowFor();
  w.setTitle('NodeGX Studio');
  await w.loadFile(path.join(__dirname, 'welcome.html')).catch(loadCut);
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

/** Each handler answers `{ error }` when nothing happened; a project opens after the answer, because opening it replaces the page that asked. */
const busy = (text) => win?.webContents.send('studio:busy', text);
const later = (fn) => setImmediate(() => fn().catch((err) => dialog.showErrorBox('NodeGX Studio', err.message)));
const asking = (fn) => async (_event, ...rest) => {
  try {
    return (await fn(...rest)) ?? { ok: true };
  } catch (err) {
    return { error: err.message };
  }
};
function handlers() {
  ipcMain.handle('studio:welcome', asking(() => ({ recent: actions.readRecent(recentFile()), templates: actions.templates(), version: app.getVersion(), home: app.getPath('home') })));
  ipcMain.handle(
    'studio:open',
    asking((dir) => {
      if (!actions.isProject(dir)) return { error: `${dir} is no longer a NodeGX project folder — it was moved or deleted.` };
      busy('Opening…');
      later(() => open(dir));
    })
  );
  ipcMain.handle(
    'studio:open-folder',
    asking(async () => {
      const dir = await chooseProject();
      if (!dir) return { cancelled: true };
      busy('Opening…');
      later(() => open(dir));
    })
  );
  ipcMain.handle(
    'studio:new',
    asking(async (slug) => {
      const t = actions.templates().find((x) => x.slug === slug);
      if (!t) return { error: `There is no template called ${slug}.` };
      const dest = await chooseDestination(`New project from ${t.title}`, t.title, 'Create');
      if (!dest) return { cancelled: true };
      busy(`Copying ${t.title}…`);
      const { dir } = await actions.createFromTemplate(slug, dest);
      later(() => open(dir));
    })
  );
  ipcMain.handle('studio:import', asking(importFlow));
  ipcMain.handle('studio:publish', asking(publishFlow));
  ipcMain.handle(
    'studio:forget',
    asking((dir) => {
      actions.forgetRecent(recentFile(), dir);
      menu();
    })
  );
  ipcMain.handle('studio:reveal', asking((dir) => shell.showItemInFolder(dir)));
}

/** Import an App…: the source, the new folder, the importer, then the project with its report (`docs/IMPORT-REPORT.md`) open beside it. */
async function importFlow(kind = 'file') {
  const source = await chooseImportSource(kind);
  if (!source) return { cancelled: true };
  const dest = await chooseDestination('Import into a new NodeGX project', path.basename(source).replace(/\.(json|bubble)$/i, '').replace(/\.export$/i, '') || 'Imported app', 'Import');
  if (!dest) return { cancelled: true };
  busy('Importing — a large app takes a minute…');
  const { dir } = await actions.importApp(source, dest);
  later(() => open(dir, { report: true }));
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
async function publishFlow() {
  const dir = openDir;
  if (!dir) return { error: 'Open a project first: Publish writes the open app as a site.' };
  const pub = await import(publishUrl);
  const asked = [];
  const target = pub.backendTargetOf(dir);
  if (target.local) {
    const answer = await ask(asked, {
      type: 'info',
      message: target.live ? 'This app’s live database runs on this computer' : 'This app’s backend runs on this computer',
      detail: `The site will talk to ${target.live ? 'the live database at ' : ''}${target.endpoint}, which only this computer can reach, and only while Studio (or the NodeGX editor) runs that backend. Publish it to try it in a browser here; putting the app and its backend somewhere others can reach is not built yet.`,
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
  const { response } = await dialog.showMessageBox(win, { type: fns.status === 'failed' ? 'warning' : 'info', message: result.replaced ? 'The site was published again' : 'The app is published', detail: lines.join('\n\n'), buttons: ['Show the Site’s Folder', 'Done'], defaultId: 1, cancelId: 1 });
  if (response === 0) shell.showItemInFolder(result.index);
  return summary;
}

function menu() {
  const recent = actions.readRecent(recentFile()).filter((p) => p.exists);
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
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
        { label: 'Import an App…', click: () => welcome().then(() => win?.webContents.executeJavaScript('window.openImportGuide?.()')) },
        { type: 'separator' },
        { label: 'Show Project Folder', enabled: !!server, click: () => server && shell.openPath(server.spawnargs[2]) },
        { label: 'Publish…', enabled: !!server, click: () => win?.webContents.executeJavaScript('window.__ob?.publish?.()') },
        { label: 'Connect Claude Code…', enabled: !!server, click: () => win?.webContents.executeJavaScript('window.__ob?.openAgent?.()') },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && !hidden) app.dock?.setIcon(path.join(__dirname, 'icon.png'));
  actions = await import(actionsUrl);
  handlers();
  menu();
  if (projectArg) {
    if (actions.isProject(projectArg)) return open(path.resolve(projectArg));
    if (smoke) {
      console.log(`smoke: ${projectArg} is not a NodeGX project`);
      return quit(1);
    }
    await dialog.showMessageBox({ type: 'warning', message: 'That folder is not a NodeGX project', detail: `${path.resolve(projectArg)} has no nodegx.project.json.` });
  }
  welcome();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (!server) return;
  event.preventDefault();
  stopServer().then(() => app.quit());
});
// Ctrl-C in the terminal that started it, or a gate stopping it: the editor server goes too, never left running alone
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => quit(0));
