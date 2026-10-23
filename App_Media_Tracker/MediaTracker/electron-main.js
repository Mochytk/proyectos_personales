const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, net, protocol, screen, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { createFileStorage } = require('./electron-storage');
const { ACTIONS, buildMenuTemplate } = require('./electron-menu');
const { createSyncFolder, loadSyncConfig, saveSyncConfig } = require('./electron-sync');
const { buildTrayTemplate, sanitizeSnapshot, shouldHideOnClose } = require('./electron-tray');
const { MIN_SIZE, loadWindowState, restoreBounds, saveWindowState } = require('./electron-window-state');

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
// Set when the app is really going away (Cmd+Q, Quit in the Dock, system shutdown): closing the
// window hides it on macOS so the menu bar icon keeps working, but not then.
let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

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

function registerSyncHandlers() {
  const configFile = path.join(app.getPath('userData'), 'sync-config.json');
  const config = loadSyncConfig(configFile);
  if (!config.deviceId) {
    config.deviceId = crypto.randomUUID();
    saveSyncConfig(configFile, config);
  }

  let folder = null;
  let stopWatching = null;
  const open = () => {
    if (stopWatching) stopWatching();
    folder = config.folder ? createSyncFolder(config.folder, config.deviceId) : null;
    stopWatching = folder ? folder.watch(() => mainWindow && mainWindow.webContents.send('sync:changed')) : null;
  };
  const requireFolder = () => {
    if (!folder) throw new Error('La sincronización no está activada.');
    return folder;
  };
  open();

  // The renderer never names a path: the folder only comes from the system's folder picker.
  ipcMain.handle('sync:getConfig', () => ({ deviceId: config.deviceId, deviceName: os.hostname(), folder: config.folder || null }));
  ipcMain.handle('sync:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Elige la carpeta de sincronización',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    config.folder = result.filePaths[0];
    saveSyncConfig(configFile, config);
    open();
    return config.folder;
  });
  ipcMain.handle('sync:disable', () => {
    config.folder = undefined;
    saveSyncConfig(configFile, config);
    open();
  });
  ipcMain.handle('sync:write', (_event, text) => requireFolder().writeOwn(text));
  ipcMain.handle('sync:readOthers', async () => (await requireFolder().readOthers()).map((file) => file.text));
}

function registerMenu() {
  const send = (action) => {
    if (ACTIONS.includes(action) && mainWindow) mainWindow.webContents.send('menu:action', action);
  };
  const template = buildMenuTemplate({ isMac: process.platform === 'darwin', appName: app.name, send });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(options = {}) {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const saved = loadWindowState(stateFile);
  const bounds = restoreBounds(saved, screen.getAllDisplays().map((d) => d.workArea));

  rendererReady = false;
  mainWindow = new BrowserWindow({
    ...bounds,
    show: options.show !== false,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (saved?.isMaximized) mainWindow.maximize();

  // Remember size and position (debounced, because resize and move fire continuously).
  const win = mainWindow;
  let timer = null;
  const remember = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    saveWindowState(stateFile, { ...win.getNormalBounds(), isMaximized: win.isMaximized() });
  };
  const rememberSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(remember, 500);
  };
  win.on('resize', rememberSoon);
  win.on('move', rememberSoon);
  win.on('close', (event) => {
    clearTimeout(timer);
    remember();
    if (shouldHideOnClose({ platform: process.platform, quitting })) {
      event.preventDefault();
      win.hide();
    }
  });

  // Links to other sites open in the default browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`${SCHEME}://${HOST}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
}

/** Brings the window back (creating it if it was destroyed). */
function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Menu bar icon (macOS). The page owns the data, so the menu is built from text it sends, and the
// actions chosen in the menu go back to the page. Actions wait until the page is ready to take them.
let tray = null;
let rendererReady = false;
const pendingActions = [];

function sendTrayAction(action, { reveal }) {
  if (reveal) showWindow();
  else if (!mainWindow) createWindow({ show: false });
  if (rendererReady && mainWindow) mainWindow.webContents.send('tray:action', action);
  else pendingActions.push(action);
}

function registerTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'build', 'trayTemplate.png'));
  image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip('Media Tracker');

  let snapshot = sanitizeSnapshot(null);
  const handlers = {
    onAdvance: (id) => sendTrayAction({ kind: 'advance', id }, { reveal: false }),
    onOpen: (id) => sendTrayAction({ kind: 'open', id }, { reveal: true }),
    onOpenEnjoying: () => sendTrayAction({ kind: 'open-enjoying' }, { reveal: true }),
    onShow: () => showWindow(),
    onQuit: () => app.quit(),
  };
  const refresh = () => tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(snapshot, handlers)));

  ipcMain.on('tray:update', (event, raw) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    snapshot = sanitizeSnapshot(raw);
    // The page only sends this once it is listening for actions, so it also means "ready".
    rendererReady = true;
    while (pendingActions.length > 0) mainWindow.webContents.send('tray:action', pendingActions.shift());
    refresh();
  });
  refresh();
}

// A second copy would fight over the data file; focus the open window instead.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

app.whenReady().then(() => {
  if (!gotLock) return;
  // The packaged app gets its icon from the bundle; when running from source, set it by hand.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(path.join(__dirname, 'build', 'icon.png'));
  registerAppProtocol();
  registerStorageHandlers();
  registerSyncHandlers();
  registerMenu();
  if (process.platform === 'darwin') registerTray();
  createWindow();

  // Clicking the Dock icon brings the (possibly hidden) window back.
  app.on('activate', () => showWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
