/**
 * STU-009 — the tab strip's way to the main process. The strip only draws what the main process says the tabs are and
 * asks it to select, close or add one; each tab's page (the welcome screen or a project's Studio) has its own preload.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabs', {
  /** `fn([{ id, title, dir, active, busy }])`, on every change. */
  onState: (fn) => ipcRenderer.on('tabs:state', (_event, list) => fn(list)),
  ready: () => ipcRenderer.send('tabs:ready'),
  select: (id) => ipcRenderer.send('tabs:select', id),
  close: (id) => ipcRenderer.send('tabs:close', id),
  add: () => ipcRenderer.send('tabs:add'),
  move: (id, to) => ipcRenderer.send('tabs:move', id, to)
});
