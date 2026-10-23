const { contextBridge, ipcRenderer } = require('electron');

// Same shape as AsyncStorage so the store can use it directly.
contextBridge.exposeInMainWorld('mediaTrackerStorage', {
  getItem: (key) => ipcRenderer.invoke('storage:get', key),
  setItem: (key, value) => ipcRenderer.invoke('storage:set', key, value),
  removeItem: (key) => ipcRenderer.invoke('storage:remove', key),
});

// Menu items (File > New item, View > Go to...) are handled by the app; this forwards them.
contextBridge.exposeInMainWorld('mediaTrackerMenu', {
  onAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
});

// Sync through a shared folder. The folder is chosen in the main process; the page only exchanges
// the sync content and hears when another device changed its file.
contextBridge.exposeInMainWorld('mediaTrackerSync', {
  getConfig: () => ipcRenderer.invoke('sync:getConfig'),
  chooseFolder: () => ipcRenderer.invoke('sync:chooseFolder'),
  disable: () => ipcRenderer.invoke('sync:disable'),
  write: (text) => ipcRenderer.invoke('sync:write', text),
  readOthers: () => ipcRenderer.invoke('sync:readOthers'),
  onChange: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('sync:changed', listener);
    return () => ipcRenderer.removeListener('sync:changed', listener);
  },
});
