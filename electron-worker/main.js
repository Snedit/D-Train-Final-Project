const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;
let isQuiting = false;

require('./worker'); // load worker core

const autoLauncher = new AutoLaunch({
  name: 'Electron ML Worker'
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', e => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Start Worker',
      click: () => {
        mainWindow.webContents.send('ui-control', { action: 'start-worker' });
      }
    },
    {
      label: 'Stop Worker',
      click: () => {
        mainWindow.webContents.send('ui-control', { action: 'stop-worker' });
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('ML Worker');
  tray.setContextMenu(contextMenu);
}

app.on('ready', async () => {
  await autoLauncher.enable();
  createWindow();
  createTray();
  mainWindow.hide();

  autoUpdater.checkForUpdatesAndNotify(); // auto‑update support
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  mainWindow.show();
});

// receive worker status/logs and forward to renderer
ipcMain.on('worker-event', (_event, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('worker-event', payload);
  }
});
