'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const FLASH_VERSION = '29.0.0.140';

function getRootDir() {
  if (process.defaultApp) {
    return path.resolve(__dirname, '..', '..');
  }

  return path.dirname(process.execPath);
}

function readStartUrl(configPath) {
  if (!fs.existsSync(configPath)) {
    return 'about:blank';
  }

  const lines = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let section = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    if (section !== 'browser') {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'starturl' && value) {
      return value;
    }
  }

  return 'about:blank';
}

const rootDir = getRootDir();
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
const configPath = path.join(rootDir, 'config.ini');
const userDataPath = path.join(rootDir, 'UserData');

app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
app.commandLine.appendSwitch('allow-outdated-plugins');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.setPath('userData', userDataPath);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      plugins: true
    }
  });

  mainWindow.loadURL(readStartUrl(configPath));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
