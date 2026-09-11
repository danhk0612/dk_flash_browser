'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, BrowserView, Menu, dialog, clipboard, ipcMain } = require('electron');

const FLASH_VERSION = '29.0.0.140';
const PRODUCT_NAME = 'DK Flash Browser';
const BROWSER_PARTITION = 'persist:dk-flash-browser';

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

function readBrowserConfig(configPath) {
  const config = { startUrl: 'about:blank' };
  if (!fs.existsSync(configPath)) return config;

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
let browserConfig = null;
let browserBounds = { x: 0, y: 0, width: 1, height: 1 };
let tabs = [];
let activeTabId = null;
let nextTabId = 1;

function getTab(id) {
  return tabs.find((tab) => tab.id === id) || null;
}

function getActiveTab() {
  return getTab(activeTabId);
}

function tabState(tab) {
  const wc = tab.view.webContents;
  return {
    id: tab.id,
    title: wc.getTitle() || '새 탭',
    url: wc.getURL() || '',
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    isLoading: wc.isLoading()
  };
}

function sendTabs() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('browser:tabs', {
    activeTabId,
    tabs: tabs.map(tabState)
  });
}

function sendBrowserState(tab) {
  if (!mainWindow || mainWindow.isDestroyed() || !tab || tab.id !== activeTabId) return;
  mainWindow.webContents.send('browser:state', tabState(tab));
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

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const index = tabs.findIndex((tab) => tab.id === activeTabId);
  const next = (index + direction + tabs.length) % tabs.length;
  activateTab(tabs[next].id, true);
}

function installBrowserHandlers(tab) {
  const contents = tab.view.webContents;

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
    if (input.control && !input.shift && key === 't') {
      event.preventDefault();
      createTab(browserConfig.startUrl, true);
      return;
    }
    if (input.control && !input.shift && key === 'w') {
      event.preventDefault();
      closeTab(tab.id);
      return;
    }
    if (input.control && key === 'tab') {
      event.preventDefault();
      cycleTab(input.shift ? -1 : 1);
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
      contents.loadURL(browserConfig.startUrl).catch(() => {});
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
    contents.on(name, () => {
      sendBrowserState(tab);
      sendTabs();
    });
  });
}

function createTab(url, makeActive) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const tab = {
    id: nextTabId++,
    view: new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        plugins: true,
        partition: BROWSER_PARTITION
      }
    })
  };
  tabs.push(tab);
  installBrowserHandlers(tab);
  tab.view.setBounds(browserBounds);
  tab.view.webContents.loadURL(url || browserConfig.startUrl).catch(() => {});
  if (makeActive || activeTabId === null) activateTab(tab.id, false);
  sendTabs();
  return tab;
}

function activateTab(id, focusPage) {
  const tab = getTab(id);
  if (!tab || !mainWindow || mainWindow.isDestroyed()) return;
  activeTabId = id;
  mainWindow.setBrowserView(tab.view);
  tab.view.setBounds(browserBounds);
  sendTabs();
  sendBrowserState(tab);
  if (focusPage) tab.view.webContents.focus();
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const tab = tabs[index];
  const wasActive = tab.id === activeTabId;
  tabs.splice(index, 1);

  if (!tab.view.webContents.isDestroyed()) tab.view.webContents.destroy();

  if (!tabs.length) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    return;
  }

  if (wasActive) {
    const nextIndex = Math.min(index, tabs.length - 1);
    activateTab(tabs[nextIndex].id, true);
  } else {
    sendTabs();
  }
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
    createTab(browserConfig.startUrl, true);
    mainWindow.webContents.send('browser:request-bounds');
  });

  mainWindow.on('closed', () => {
    tabs.forEach((tab) => {
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.destroy();
    });
    tabs = [];
    activeTabId = null;
    mainWindow = null;
  });
}

ipcMain.on('browser:bounds', (_event, bounds) => {
  browserBounds = normalizeBounds(bounds);
  const tab = getActiveTab();
  if (tab) tab.view.setBounds(browserBounds);
});
ipcMain.on('browser:navigate', (_event, url) => {
  const tab = getActiveTab();
  if (tab && url) tab.view.webContents.loadURL(url).catch(() => {});
});
ipcMain.on('browser:back', () => {
  const tab = getActiveTab();
  if (tab && tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
});
ipcMain.on('browser:forward', () => {
  const tab = getActiveTab();
  if (tab && tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
});
ipcMain.on('browser:reload', () => {
  const tab = getActiveTab();
  if (tab) tab.view.webContents.reload();
});
ipcMain.on('browser:hard-reload', () => {
  const tab = getActiveTab();
  if (tab) tab.view.webContents.reloadIgnoringCache();
});
ipcMain.on('browser:home', () => {
  const tab = getActiveTab();
  if (tab) tab.view.webContents.loadURL(browserConfig.startUrl).catch(() => {});
});
ipcMain.on('browser:focus-page', () => {
  const tab = getActiveTab();
  if (tab) tab.view.webContents.focus();
});
ipcMain.on('browser:new-tab', (_event, url) => createTab(url || browserConfig.startUrl, true));
ipcMain.on('browser:switch-tab', (_event, id) => activateTab(Number(id), true));
ipcMain.on('browser:close-tab', (_event, id) => closeTab(Number(id)));
ipcMain.on('browser:cycle-tab', (_event, direction) => cycleTab(Number(direction) < 0 ? -1 : 1));
ipcMain.on('browser:bookmark-context', (_event, url) => {
  if (!mainWindow || mainWindow.isDestroyed() || !url) return;
  Menu.buildFromTemplate([
    { label: '북마크 삭제', click: () => mainWindow.webContents.send('browser:delete-bookmark', url) }
  ]).popup({ window: mainWindow });
});

app.on('ready', createWindow);
app.on('window-all-closed', () => app.quit());
