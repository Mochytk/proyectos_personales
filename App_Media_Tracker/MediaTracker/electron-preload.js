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
