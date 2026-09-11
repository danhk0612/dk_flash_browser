'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, BrowserView, Menu, dialog, clipboard, ipcMain, session } = require('electron');

const FLASH_VERSION = '29.0.0.140';
const PRODUCT_NAME = 'DK Flash Browser';
const BROWSER_PARTITION = 'persist:dk-flash-browser';

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const rootDir = getRootDir();
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
const configPath = path.join(rootDir, 'config.ini');
const userDataPath = path.join(rootDir, 'UserData');
const sessionCookieBackupPath = path.join(userDataPath, 'session-cookies.json');
const logDir = path.join(rootDir, 'Logs');
const logPath = path.join(logDir, 'browser.log');

function writeLog(type, message, error) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const details = error && error.stack ? error.stack : (error ? String(error) : '');
    const line = '[' + new Date().toISOString() + '] [' + type + '] ' + message + (details ? '\n' + details : '') + '\n';
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (_error) {
    // Logging must never crash the browser.
  }
}

process.on('uncaughtException', (error) => {
  writeLog('MAIN-UNCAUGHT', 'Uncaught exception in main process', error);
});

process.on('unhandledRejection', (reason) => {
  writeLog('MAIN-REJECTION', 'Unhandled promise rejection in main process', reason);
});

function readBrowserConfig(filePath) {
  const config = { startUrl: 'about:blank' };
  if (!fs.existsSync(filePath)) return config;

  const lines = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
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

function safeWebContents(tab) {
  if (!tab || !tab.view || !tab.view.webContents) return null;
  const contents = tab.view.webContents;
  return contents.isDestroyed() ? null : contents;
}

function sessionCookieKey(cookie) {
  return [String(cookie.domain || ''), String(cookie.path || '/'), String(cookie.name || '')].join('\t');
}

function sessionCookieDetails(cookie) {
  const domain = String(cookie.domain || '').replace(/^\./, '');
  if (!domain || !cookie.name) return null;

  const details = {
    url: (cookie.secure ? 'https://' : 'http://') + domain + '/',
    name: cookie.name,
    value: cookie.value || '',
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly
  };

  if (!cookie.hostOnly && cookie.domain) details.domain = cookie.domain;
  if (cookie.sameSite) details.sameSite = cookie.sameSite;
  return details;
}

function loadSessionCookieBackup() {
  try {
    if (!fs.existsSync(sessionCookieBackupPath)) return new Map();
    const parsed = JSON.parse(fs.readFileSync(sessionCookieBackupPath, 'utf8'));
    if (!Array.isArray(parsed)) return new Map();
    const result = new Map();
    parsed.forEach((cookie) => {
      if (cookie && cookie.name && cookie.domain) result.set(sessionCookieKey(cookie), cookie);
    });
    return result;
  } catch (error) {
    writeLog('SESSION-COOKIE', 'Failed to read session cookie backup', error);
    return new Map();
  }
}

function saveSessionCookieBackup(cookieMap) {
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    const tempPath = sessionCookieBackupPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(Array.from(cookieMap.values()), null, 2), 'utf8');
    if (fs.existsSync(sessionCookieBackupPath)) fs.unlinkSync(sessionCookieBackupPath);
    fs.renameSync(tempPath, sessionCookieBackupPath);
  } catch (error) {
    writeLog('SESSION-COOKIE', 'Failed to write session cookie backup', error);
  }
}

async function initializeSessionCookiePersistence() {
  const browserSession = session.fromPartition(BROWSER_PARTITION);
  const savedCookies = loadSessionCookieBackup();
  let restoring = true;
  let restoredCount = 0;

  for (const cookie of savedCookies.values()) {
    try {
      const details = sessionCookieDetails(cookie);
      if (!details) continue;
      await browserSession.cookies.set(details);
      restoredCount++;
    } catch (error) {
      writeLog('SESSION-COOKIE', 'Failed to restore session cookie ' + String(cookie.name || ''), error);
    }
  }

  restoring = false;
  if (restoredCount) writeLog('SESSION-COOKIE', 'Restored ' + restoredCount + ' session cookies from portable profile.');

  browserSession.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (restoring || !cookie || !cookie.name || !cookie.domain) return;

    const key = sessionCookieKey(cookie);
    if (removed || !cookie.session) {
      if (savedCookies.delete(key)) saveSessionCookieBackup(savedCookies);
      return;
    }

    savedCookies.set(key, {
      name: cookie.name,
      value: cookie.value || '',
      domain: cookie.domain,
      hostOnly: !!cookie.hostOnly,
      path: cookie.path || '/',
      secure: !!cookie.secure,
      httpOnly: !!cookie.httpOnly,
      sameSite: cookie.sameSite || undefined
    });
    saveSessionCookieBackup(savedCookies);
  });

  try {
    await browserSession.cookies.flushStore();
  } catch (error) {
    writeLog('SESSION-COOKIE', 'Failed to flush persistent cookie store', error);
  }
}

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
  const wc = safeWebContents(tab);
  if (!wc) {
    return {
      id: tab.id,
      title: tab.crashed ? '탭 오류' : '새 탭',
      url: tab.lastUrl || '',
      canGoBack: false,
      canGoForward: false,
      isLoading: false,
      crashed: !!tab.crashed
    };
  }

  return {
    id: tab.id,
    title: tab.crashed ? '탭 오류' : (wc.getTitle() || '새 탭'),
    url: wc.getURL() || tab.lastUrl || '',
    canGoBack: !tab.crashed && wc.canGoBack(),
    canGoForward: !tab.crashed && wc.canGoForward(),
    isLoading: !tab.crashed && wc.isLoading(),
    crashed: !!tab.crashed
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
  if (!url || !contents || contents.isDestroyed()) return;

  try {
    const savePath = dialog.showSaveDialogSync(mainWindow || undefined, {
      title: '다른 이름으로 저장',
      defaultPath: path.join(app.getPath('downloads'), suggestedFilename(url, filename))
    });
    if (!savePath || contents.isDestroyed()) return;

    contents.session.once('will-download', (_event, item) => {
      try {
        item.setSavePath(savePath);
      } catch (error) {
        writeLog('DOWNLOAD', 'Failed to set download path for ' + url, error);
      }
    });
    contents.downloadURL(url);
  } catch (error) {
    writeLog('DOWNLOAD', 'Failed to start download for ' + url, error);
  }
}

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const index = tabs.findIndex((tab) => tab.id === activeTabId);
  const next = (index + direction + tabs.length) % tabs.length;
  activateTab(tabs[next].id, true);
}

function handleTabCrash(tab, killed) {
  const wc = safeWebContents(tab);
  tab.crashed = true;
  tab.lastUrl = wc ? (wc.getURL() || tab.lastUrl || '') : (tab.lastUrl || '');
  writeLog('RENDERER-CRASH', 'Tab ' + tab.id + ' renderer crashed. killed=' + String(!!killed) + ' url=' + tab.lastUrl);

  sendTabs();
  sendBrowserState(tab);

  if (tab.id === activeTabId && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:tab-crashed', {
      id: tab.id,
      url: tab.lastUrl
    });
  }
}

function installBrowserHandlers(tab) {
  const contents = tab.view.webContents;

  contents.on('before-input-event', (event, input) => {
    try {
      if (input.type !== 'keyDown' || input.isAutoRepeat || input.isComposing) return;
      const key = String(input.key || '').toLowerCase();

      if (input.control && !input.shift && key === 'l') {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:focus-address');
        return;
      }
      if (input.control && !input.shift && key === 'd') {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:toggle-bookmark');
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
        if (!contents.isDestroyed()) contents.reloadIgnoringCache();
        return;
      }
      if ((input.control && !input.shift && key === 'r') || key === 'f5') {
        event.preventDefault();
        if (!contents.isDestroyed()) contents.reload();
        return;
      }
      if (input.alt && key === 'home') {
        event.preventDefault();
        if (!contents.isDestroyed()) contents.loadURL(browserConfig.startUrl).catch((error) => writeLog('NAVIGATION', 'Alt+Home failed', error));
      }
    } catch (error) {
      writeLog('INPUT-HANDLER', 'Browser shortcut handler failed for tab ' + tab.id, error);
    }
  });

  contents.on('new-window', (event, url, frameName, disposition) => {
    try {
      event.preventDefault();
      const targetUrl = url || 'about:blank';
      writeLog('NEW-WINDOW', 'Tab ' + tab.id + ' requested ' + targetUrl + ' disposition=' + String(disposition || '') + ' frame=' + String(frameName || ''));
      createTab(targetUrl, true);
    } catch (error) {
      writeLog('NEW-WINDOW', 'Failed to route popup/new-window request for tab ' + tab.id, error);
    }
  });

  contents.on('context-menu', (_event, params) => {
    try {
      if (contents.isDestroyed()) return;
      const template = [];
      if (params.linkURL) {
        template.push({ label: '새 탭에서 링크 열기', click: () => createTab(params.linkURL, true) });
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
      if (template.length && mainWindow && !mainWindow.isDestroyed()) {
        Menu.buildFromTemplate(template).popup({ window: mainWindow });
      }
    } catch (error) {
      writeLog('CONTEXT-MENU', 'Context menu failed for tab ' + tab.id, error);
    }
  });

  contents.on('crashed', (_event, killed) => handleTabCrash(tab, killed));
  contents.on('unresponsive', () => writeLog('RENDERER-UNRESPONSIVE', 'Tab ' + tab.id + ' became unresponsive. url=' + (contents.getURL() || '')));
  contents.on('responsive', () => writeLog('RENDERER-RESPONSIVE', 'Tab ' + tab.id + ' became responsive again.'));

  ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading', 'page-title-updated', 'did-fail-load'].forEach((name) => {
    contents.on(name, () => {
      try {
        if (!contents.isDestroyed()) {
          tab.crashed = false;
          tab.lastUrl = contents.getURL() || tab.lastUrl || '';
        }
        sendBrowserState(tab);
        sendTabs();
      } catch (error) {
        writeLog('STATE', 'State update failed after ' + name + ' for tab ' + tab.id, error);
      }
    });
  });
}

function createTab(url, makeActive) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const tab = {
    id: nextTabId++,
    crashed: false,
    lastUrl: url || browserConfig.startUrl,
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
  tab.view.webContents.loadURL(tab.lastUrl).catch((error) => writeLog('NAVIGATION', 'Initial tab load failed: ' + tab.lastUrl, error));
  if (makeActive || activeTabId === null) activateTab(tab.id, false);
  sendTabs();
  return tab;
}

function activateTab(id, focusPage) {
  const tab = getTab(id);
  if (!tab || !mainWindow || mainWindow.isDestroyed()) return;

  try {
    activeTabId = id;
    mainWindow.setBrowserView(tab.view);
    tab.view.setBounds(browserBounds);
    sendTabs();
    sendBrowserState(tab);
    const wc = safeWebContents(tab);
    if (focusPage && wc) wc.focus();
  } catch (error) {
    writeLog('TAB-ACTIVATE', 'Failed to activate tab ' + id, error);
  }
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const tab = tabs[index];
  const wasActive = tab.id === activeTabId;
  tabs.splice(index, 1);

  try {
    const wc = safeWebContents(tab);
    if (wc) wc.destroy();
  } catch (error) {
    writeLog('TAB-CLOSE', 'Failed to destroy tab ' + id, error);
  }

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
  }).catch((error) => writeLog('UI', 'Failed to load browser UI', error));

  mainWindow.webContents.once('did-finish-load', () => {
    createTab(browserConfig.startUrl, true);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:request-bounds');
  });

  mainWindow.on('closed', () => {
    tabs.forEach((tab) => {
      try {
        const wc = safeWebContents(tab);
        if (wc) wc.destroy();
      } catch (error) {
        writeLog('SHUTDOWN', 'Failed to destroy tab ' + tab.id + ' during shutdown', error);
      }
    });
    tabs = [];
    activeTabId = null;
    mainWindow = null;
  });
}

function activeContents() {
  return safeWebContents(getActiveTab());
}

ipcMain.on('browser:bounds', (_event, bounds) => {
  browserBounds = normalizeBounds(bounds);
  const tab = getActiveTab();
  if (tab) {
    try {
      tab.view.setBounds(browserBounds);
    } catch (error) {
      writeLog('BOUNDS', 'Failed to set BrowserView bounds', error);
    }
  }
});
ipcMain.on('browser:navigate', (_event, url) => {
  const wc = activeContents();
  const tab = getActiveTab();
  if (wc && url) {
    if (tab) tab.lastUrl = url;
    wc.loadURL(url).catch((error) => writeLog('NAVIGATION', 'Navigation failed: ' + url, error));
  }
});
ipcMain.on('browser:back', () => {
  const wc = activeContents();
  if (wc && wc.canGoBack()) wc.goBack();
});
ipcMain.on('browser:forward', () => {
  const wc = activeContents();
  if (wc && wc.canGoForward()) wc.goForward();
});
ipcMain.on('browser:reload', () => {
  const wc = activeContents();
  if (wc) wc.reload();
});
ipcMain.on('browser:hard-reload', () => {
  const wc = activeContents();
  if (wc) wc.reloadIgnoringCache();
});
ipcMain.on('browser:home', () => {
  const wc = activeContents();
  if (wc) wc.loadURL(browserConfig.startUrl).catch((error) => writeLog('NAVIGATION', 'Home navigation failed', error));
});
ipcMain.on('browser:focus-page', () => {
  const wc = activeContents();
  if (wc) wc.focus();
});
ipcMain.on('browser:new-tab', (_event, url) => createTab(url || browserConfig.startUrl, true));
ipcMain.on('browser:switch-tab', (_event, id) => activateTab(Number(id), true));
ipcMain.on('browser:close-tab', (_event, id) => closeTab(Number(id)));
ipcMain.on('browser:cycle-tab', (_event, direction) => cycleTab(Number(direction) < 0 ? -1 : 1));
ipcMain.on('browser:bookmark-context', (_event, url) => {
  if (!mainWindow || mainWindow.isDestroyed() || !url) return;
  try {
    Menu.buildFromTemplate([
      { label: '새 탭에서 열기', click: () => createTab(url, true) },
      { type: 'separator' },
      { label: '북마크 삭제', click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:delete-bookmark', url);
      } }
    ]).popup({ window: mainWindow });
  } catch (error) {
    writeLog('BOOKMARK-MENU', 'Bookmark context menu failed', error);
  }
});

app.on('gpu-process-crashed', (_event, killed) => {
  writeLog('GPU-CRASH', 'GPU process crashed. killed=' + String(!!killed));
});

app.on('ready', async () => {
  writeLog('START', PRODUCT_NAME + ' starting. Electron=' + process.versions.electron + ' Chromium=' + process.versions.chrome);
  try {
    await initializeSessionCookiePersistence();
  } catch (error) {
    writeLog('SESSION-COOKIE', 'Failed to initialize session cookie persistence', error);
  }
  createWindow();
});
app.on('before-quit', () => writeLog('STOP', PRODUCT_NAME + ' exiting.'));
app.on('window-all-closed', () => app.quit());