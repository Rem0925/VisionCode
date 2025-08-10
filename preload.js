const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onWindowMaximized: (callback) => ipcRenderer.on('window:isMaximized', callback),
  onWindowUnmaximized: (callback) => ipcRenderer.on('window:isUnmaximized', callback),
});