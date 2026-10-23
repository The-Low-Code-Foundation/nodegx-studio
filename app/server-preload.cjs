/**
 * STU-071 — the "Which server?" window's way to the main process. The main process fills the form (`server:fill`: the
 * last answers for this app, or its defaults) and gets back the answers, or null when the person cancels.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serverForm', {
  /** `fn({ appName, answers, problem })`: what to show. */
  onFill: (fn) => ipcRenderer.on('server:fill', (_event, fill) => fn(fill)),
  ready: () => ipcRenderer.send('server:ready'),
  submit: (answers) => ipcRenderer.send('server:answer', answers),
  cancel: () => ipcRenderer.send('server:answer', null)
});
