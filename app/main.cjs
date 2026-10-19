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
const recentFile = () => path.join(app.getPath('userData'), 'recent-projects.json');
const testPicks = process.env.NODEGX_STUDIO_TEST_PICKS ? JSON.parse(process.env.NODEGX_STUDIO_TEST_PICKS) : null;

let win = null;
let server = null;
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

async function open(projectDir) {
  let url;
  try {
    url = await startServer(projectDir);
  } catch (err) {
    busy('');
    dialog.showErrorBox('NodeGX Studio could not open the project', err.message);
    if (smoke) quit(1);
    return;
  }
  actions.rememberRecent(recentFile(), projectDir);
  app.addRecentDocument(projectDir);
  menu();
  const w = windowFor();
  w.setTitle(`${path.basename(projectDir)} — NodeGX Studio`);
  await w.loadURL(url).catch(loadCut);
}

/** A load that the next one replaces, or that quitting cuts off (the smoke run quits as soon as the page has drawn,
    while its web fonts may still be loading), rejects; the page reports its own readiness, so this is only logged. */
function loadCut(err) {
  if (!/ERR_ABORTED|ERR_FAILED \(-2\)/.test(err.message)) console.warn(`nodegx-studio: ${err.message}`);
}

/** STU-003: the welcome screen. Showing it closes the open project (every edit is already saved). */
async function welcome() {
  await stopServer();
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

/** The importer's source: an export file, or a folder of the app's run-mode bundles. One dialog takes either on macOS only. */
async function chooseImportSource() {
  const file = { name: 'App export', extensions: ['json', 'bubble'] };
  const message = 'An app export (.json), or a folder holding your app’s run-mode bundles and editor requests';
  if (testPicks || process.platform === 'darwin') return pick('open', { title: 'Import an app', message, properties: ['openFile', 'openDirectory'], filters: [file] });
  const { response } = await dialog.showMessageBox(win, { type: 'question', message: 'What are you importing from?', buttons: ['An export file', 'A folder of bundles', 'Cancel'], cancelId: 2 });
  if (response === 2) return null;
  return pick('open', response === 0 ? { title: 'Import an app', properties: ['openFile'], filters: [file] } : { title: 'Import an app', properties: ['openDirectory'] });
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
  ipcMain.handle(
    'studio:forget',
    asking((dir) => {
      actions.forgetRecent(recentFile(), dir);
      menu();
    })
  );
  ipcMain.handle('studio:reveal', asking((dir) => shell.showItemInFolder(dir)));
}

/** Import an App…: the source, the new folder, the importer, then the project. Its report is `docs/IMPORT-REPORT.md` inside it. */
async function importFlow() {
  const source = await chooseImportSource();
  if (!source) return { cancelled: true };
  const dest = await chooseDestination('Import into a new NodeGX project', path.basename(source).replace(/\.(json|bubble)$/i, '').replace(/\.export$/i, '') || 'Imported app', 'Import');
  if (!dest) return { cancelled: true };
  busy('Importing — a large app takes a minute…');
  const { dir } = await actions.importApp(source, dest);
  later(() => open(dir));
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
        {
          label: 'Import an App…',
          click: () => importFlow().catch((err) => dialog.showErrorBox('The import did not finish', err.message))
        },
        { type: 'separator' },
        { label: 'Show Project Folder', enabled: !!server, click: () => server && shell.openPath(server.spawnargs[2]) },
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
