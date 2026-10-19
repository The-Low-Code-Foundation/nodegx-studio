/**
 * NodeGX Studio as a desktop app. The editor is `editor/studio.html` served by `editor/serve.mjs`; this file starts
 * that server for a project folder on this machine and shows it in a window. Nothing leaves the machine: the project
 * is a folder of files, the server listens on 127.0.0.1 only, and the backend it talks to is the one the project
 * names (a local `nodegx-backend` unless the person bound another).
 *
 *   npm start                       asks for a project folder
 *   npm start -- <project-dir>      opens that folder
 *   npm start -- <project-dir> --smoke   opens it, waits for the app to draw, prints the result and quits (exit 0/1)
 */
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => a !== '.');
const smoke = args.includes('--smoke');
const projectArg = args.find((a) => !a.startsWith('--'));
const serveJs = path.join(__dirname, '..', 'editor', 'serve.mjs');

let win = null;
let server = null;

const isProject = (dir) => !!dir && existsSync(path.join(dir, 'nodegx.project.json'));

/** Starts serve.mjs on a free loopback port under Electron's own Node, and resolves with its URL. */
function startServer(projectDir) {
  stopServer();
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
  stopServer();
  app.exit(code);
}

function stopServer() {
  if (server) {
    server.kill();
    server = null;
  }
}

async function chooseProject() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open a NodeGX project',
    message: 'Choose the folder that holds nodegx.project.json',
    properties: ['openDirectory']
  });
  if (canceled || !filePaths[0]) return null;
  if (!isProject(filePaths[0])) {
    await dialog.showMessageBox({ type: 'warning', message: 'That folder is not a NodeGX project', detail: `${filePaths[0]} has no nodegx.project.json.` });
    return chooseProject();
  }
  return filePaths[0];
}

async function open(projectDir) {
  let url;
  try {
    url = await startServer(projectDir);
  } catch (err) {
    dialog.showErrorBox('NodeGX Studio could not open the project', err.message);
    if (smoke) quit(1);
    return;
  }
  const name = path.basename(projectDir);
  if (!win) {
    win = new BrowserWindow({ width: 1600, height: 1000, show: !smoke, backgroundColor: '#ffffff', title: 'NodeGX Studio' });
    win.on('closed', () => (win = null));
    // links the app opens go to the person's browser, not into the editor window
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      shell.openExternal(target);
      return { action: 'deny' };
    });
  }
  // the page writes its gate's readiness into document.title; the window keeps its own name
  win.removeAllListeners('page-title-updated');
  win.on('page-title-updated', (event, title) => {
    event.preventDefault();
    if (smoke && title.startsWith('ready')) {
      console.log(`smoke: ${title}`);
      quit(0);
    }
  });
  win.setTitle(`${name} — NodeGX Studio`);
  await win.loadURL(url);
  if (smoke) setTimeout(() => (console.log('smoke: the editor did not report ready in 90 s'), quit(1)), 90000);
}

function menu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const dir = await chooseProject();
            if (dir) open(dir);
          }
        },
        { label: 'Show Project Folder', click: () => server && shell.openPath(server.spawnargs[2]) },
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
  menu();
  const dir = isProject(projectArg) ? path.resolve(projectArg) : smoke ? null : await chooseProject();
  if (!dir) {
    if (smoke) console.log(`smoke: ${projectArg} is not a NodeGX project`);
    quit(smoke ? 1 : 0);
    return;
  }
  open(dir);
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', stopServer);
