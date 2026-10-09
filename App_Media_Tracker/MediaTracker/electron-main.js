const { app, BrowserWindow, ipcMain, nativeTheme, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createFileStorage } = require('./electron-storage');

nativeTheme.themeSource = 'system';

// The app is served from a custom scheme instead of a local HTTP server: no fixed port that
// can be taken by another process, and a stable origin for the renderer.
const SCHEME = 'app';
const HOST = 'media-tracker';
const DIST_DIR = path.join(__dirname, 'dist');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;

function registerAppProtocol() {
  protocol.handle(SCHEME, (request) => {
    const { host, pathname } = new URL(request.url);
    if (host !== HOST) return new Response('Not found', { status: 404 });

    const requested = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)));
    // Refuse anything that escapes dist/ (e.g. "/../").
    const insideDist = requested === DIST_DIR || requested.startsWith(DIST_DIR + path.sep);
    const isFile = insideDist && fs.existsSync(requested) && fs.statSync(requested).isFile();

    // Unknown paths fall back to index.html so Expo Router can handle the route.
    return net.fetch(pathToFileURL(isFile ? requested : path.join(DIST_DIR, 'index.html')).toString());
  });
}

function registerStorageHandlers() {
  const storage = createFileStorage(path.join(app.getPath('userData'), 'data'));
  ipcMain.handle('storage:get', (_event, key) => storage.getItem(key));
  ipcMain.handle('storage:set', (_event, key, value) => storage.setItem(key, value));
  ipcMain.handle('storage:remove', (_event, key) => storage.removeItem(key));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Links to other sites open in the default browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`${SCHEME}://${HOST}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  registerStorageHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
