const { contextBridge, ipcRenderer } = require('electron');

// Same shape as AsyncStorage so the store can use it directly.
contextBridge.exposeInMainWorld('mediaTrackerStorage', {
  getItem: (key) => ipcRenderer.invoke('storage:get', key),
  setItem: (key, value) => ipcRenderer.invoke('storage:set', key, value),
  removeItem: (key) => ipcRenderer.invoke('storage:remove', key),
});
