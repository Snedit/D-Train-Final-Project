const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onWorkerEvent: callback => ipcRenderer.on('worker-event', (_e, data) => callback(data)),
  onUiControl: callback => ipcRenderer.on('ui-control', (_e, data) => callback(data)),
  sendUiCommand: data => ipcRenderer.send('ui-command', data)
});
