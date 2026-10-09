const { app, BrowserWindow, nativeTheme } = require('electron');
nativeTheme.themeSource = 'system';

const path = require('path');
const express = require('express');

let mainWindow;
let server;

function startServerAndCreateWindow() {
  const exp = express();
  
  // Serve static files from the dist directory
  exp.use(express.static(path.join(__dirname, 'dist')));
  
  // Fallback for SPA routing (Expo Router)
  exp.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  server = exp.listen(48215, '127.0.0.1', () => {
    const port = server.address().port;
    
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}`);

    mainWindow.on('closed', function () {
      mainWindow = null;
    });
  });
}

app.on('ready', startServerAndCreateWindow);

app.on('window-all-closed', function () {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) startServerAndCreateWindow();
});
