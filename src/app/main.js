'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, BrowserView, Menu, dialog, clipboard, ipcMain } = require('electron');

const FLASH_VERSION = '29.0.0.140';
const PRODUCT_NAME = 'DK Flash Browser';

function getRootDir() {
  if (process.defaultApp) {
    return path.resolve(__dirname, '..', '..');
  }

  return path.dirname(process.execPath);
}

function readBrowserConfig(configPath) {
  const config = { startUrl: 'about:blank' };

  if (!fs.existsSync(configPath)) {
    return config;
  }

  const lines = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let section = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    if (section !== 'browser') continue;

    const separator = line.indexOf('=');
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'starturl' && value) config.startUrl = value;
  }

  return config;
}

function normalizeBounds(bounds) {
  return {
    x: Math.max(0, Math.round(Number(bounds.x) || 0)),
    y: Math.max(0, Math.round(Number(bounds.y) || 0)),
    width: Math.max(1, Math.round(Number(bounds.width) || 1)),
    height: Math.max(1, Math.round(Number(bounds.height) || 1))
  };
}

function suggestedFilename(url, fallback) {
  if (fallback) return fallback;
  try {
    const name = path.basename(new URL(url).pathname);
    if (name) return name;
  } catch (_error) {}
  return 'download';
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
app.setName(PRODUCT_NAME);

let mainWindow = null;
let browserView = null;
let browserConfig = null;

function sendBrowserState() {
  if (!mainWindow || mainWindow.isDestroyed() || !browserView) return;
  const wc = browserView.webContents;
  mainWindow.webContents.send('browser:state', {
    url: wc.getURL() || '',
    title: wc.getTitle() || '',
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    isLoading: wc.isLoading()
  });
}

function downloadWithPrompt(contents, url, filename) {
  if (!url) return;
  const savePath = dialog.showSaveDialogSync(mainWindow || undefined, {
    title: '다른 이름으로 저장',
    defaultPath: path.join(app.getPath('downloads'), suggestedFilename(url, filename))
  });
  if (!savePath) return;

  contents.session.once('will-download', (_event, item) => item.setSavePath(savePath));
  contents.downloadURL(url);
}

function installBrowserHandlers(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat || input.isComposing) return;
    const key = String(input.key || '').toLowerCase();

    if (input.control && !input.shift && key === 'l') {
      event.preventDefault();
      mainWindow.webContents.send('browser:focus-address');
      return;
    }
    if (input.control && !input.shift && key === 'd') {
      event.preventDefault();
      mainWindow.webContents.send('browser:toggle-bookmark');
      return;
    }
    if ((input.control && input.shift && key === 'r') || (input.control && key === 'f5')) {
      event.preventDefault();
      contents.reloadIgnoringCache();
      return;
    }
    if ((input.control && !input.shift && key === 'r') || key === 'f5') {
      event.preventDefault();
      contents.reload();
      return;
    }
    if (input.alt && key === 'home') {
      event.preventDefault();
      contents.loadURL(browserConfig.startUrl);
    }
  });

  contents.on('context-menu', (_event, params) => {
    const template = [];

    if (params.linkURL) {
      template.push({ label: '링크 다운로드...', click: () => downloadWithPrompt(contents, params.linkURL, params.suggestedFilename) });
      template.push({ label: '링크 주소 복사', click: () => clipboard.writeText(params.linkURL) });
    }

    if (params.srcURL && params.srcURL !== params.linkURL) {
      const label = params.mediaType === 'image' ? '이미지 다운로드...' : '미디어 다운로드...';
      template.push({ label, click: () => downloadWithPrompt(contents, params.srcURL, params.suggestedFilename) });
    }

    if (template.length) template.push({ type: 'separator' });

    if (params.isEditable) {
      template.push({ role: 'cut', label: '잘라내기' });
      template.push({ role: 'copy', label: '복사' });
      template.push({ role: 'paste', label: '붙여넣기' });
      template.push({ role: 'selectall', label: '모두 선택' });
    } else if (params.selectionText) {
      template.push({ role: 'copy', label: '복사' });
    }

    if (template.length) Menu.buildFromTemplate(template).popup({ window: mainWindow || undefined });
  });

  ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'page-title-updated', 'did-fail-load'].forEach((name) => {
    contents.on(name, sendBrowserState);
  });
}

function createBrowserView() {
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      plugins: true
    }
  });
  mainWindow.setBrowserView(browserView);
  installBrowserHandlers(browserView.webContents);
  browserView.webContents.loadURL(browserConfig.startUrl);
}

function createWindow() {
  browserConfig = readBrowserConfig(configPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: PRODUCT_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'browser.html'), {
    query: { startUrl: browserConfig.startUrl }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    createBrowserView();
    sendBrowserState();
  });

  mainWindow.on('closed', () => {
    browserView = null;
    mainWindow = null;
  });
}

ipcMain.on('browser:bounds', (_event, bounds) => {
  if (browserView) browserView.setBounds(normalizeBounds(bounds));
});

ipcMain.on('browser:navigate', (_event, url) => {
  if (browserView && url) browserView.webContents.loadURL(url);
});
ipcMain.on('browser:back', () => {
  if (browserView && browserView.webContents.canGoBack()) browserView.webContents.goBack();
});
ipcMain.on('browser:forward', () => {
  if (browserView && browserView.webContents.canGoForward()) browserView.webContents.goForward();
});
ipcMain.on('browser:reload', () => {
  if (browserView) browserView.webContents.reload();
});
ipcMain.on('browser:hard-reload', () => {
  if (browserView) browserView.webContents.reloadIgnoringCache();
});
ipcMain.on('browser:home', () => {
  if (browserView) browserView.webContents.loadURL(browserConfig.startUrl);
});
ipcMain.on('browser:focus-page', () => {
  if (browserView) browserView.webContents.focus();
});

app.on('ready', createWindow);
app.on('window-all-closed', () => app.quit());
