/**
 * STU-003 — the welcome screen's way to the main process. Every call answers `{ error }` when it did not happen, so
 * the page can say why; the ones that open a project answer before the window moves to it.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  welcome: () => ipcRenderer.invoke('studio:welcome'),
  open: (dir) => ipcRenderer.invoke('studio:open', dir),
  openFolder: () => ipcRenderer.invoke('studio:open-folder'),
  newFromTemplate: (slug) => ipcRenderer.invoke('studio:new', slug),
  importApp: () => ipcRenderer.invoke('studio:import'),
  forget: (dir) => ipcRenderer.invoke('studio:forget', dir),
  reveal: (dir) => ipcRenderer.invoke('studio:reveal', dir),
  /** STU-008: publishes the open app as a site; the main process asks where and says what it did. */
  publish: () => ipcRenderer.invoke('studio:publish'),
  /** The main process says what it is doing once the dialogs are answered ("Copying Todo list…"). */
  onBusy: (fn) => ipcRenderer.on('studio:busy', (_event, text) => fn(text))
});
