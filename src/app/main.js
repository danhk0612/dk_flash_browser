'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, BrowserView, Menu, dialog, clipboard, ipcMain, session } = require('electron');

const FLASH_VERSION = '29.0.0.140';
const PRODUCT_NAME = 'DK Flash Browser';
const BROWSER_PARTITION = 'persist:dk-flash-browser';
const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const rootDir = getRootDir();
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
const appIconPath = path.join(rootDir, 'DKFlashBrowser.ico');
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
  } catch (_error) {}
}

process.on('uncaughtException', (error) => writeLog('MAIN-UNCAUGHT', 'Uncaught exception in main process', error));
process.on('unhandledRejection', (reason) => writeLog('MAIN-REJECTION', 'Unhandled promise rejection in main process', reason));

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
      restoredCount += 1;
    } catch (error) {
      writeLog('SESSION-COOKIE', 'Failed to restore session cookie ' + (cookie.name || ''), error);
    }
  }

  restoring = false;
  writeLog('SESSION-COOKIE', 'Restored session cookies: ' + restoredCount);

  browserSession.cookies.on('changed', (_event, cookie, cause, removed) => {
    if (restoring || !cookie || !cookie.session) return;
    const key = sessionCookieKey(cookie);
    if (removed || cause === 'expired' || cause === 'evicted' || cause === 'expired-overwrite') savedCookies.delete(key);
    else savedCookies.set(key, cookie);
    saveSessionCookieBackup(savedCookies);
  });
}

function parseAddressInput(value) {
  const input = String(value || '').trim();
  if (!input) return 'about:blank';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) return input;
  return 'http://' + input;
}

function isDownloadableUrl(value) {
  return /^(?:https?|file):/i.test(String(value || ''));
}

function buildEditMenu(params) {
  const template = [];
  if (params.editFlags) {
    if (params.editFlags.canUndo) template.push({ role: 'undo', label: '실행 취소' });
    if (params.editFlags.canRedo) template.push({ role: 'redo', label: '다시 실행' });
    if (template.length) template.push({ type: 'separator' });
    if (params.editFlags.canCut) template.push({ role: 'cut', label: '잘라내기' });
    if (params.editFlags.canCopy) template.push({ role: 'copy', label: '복사' });
    if (params.editFlags.canPaste) template.push({ role: 'paste', label: '붙여넣기' });
    if (params.editFlags.canSelectAll) template.push({ role: 'selectAll', label: '모두 선택' });
  }
  return template;
}

let mainWindow = null;
let browserConfig = { startUrl: 'about:blank' };
let browserBounds = { x: 0, y: 0, width: 1, height: 1 };
let nextTabId = 1;
let activeTabId = null;
let tabs = [];

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function tabSummary(tab) {
  const contents = safeWebContents(tab);
  return {
    id: tab.id,
    title: tab.title || (contents ? contents.getTitle() : '') || '새 탭',
    url: tab.lastUrl || (contents ? contents.getURL() : '') || 'about:blank'
  };
}

function sendTabs() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('browser:tabs', {
    activeTabId: activeTabId,
    tabs: tabs.map(tabSummary)
  });
}

function updateWindowTitle(tab) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const title = tab && tab.title ? String(tab.title).trim() : '';
  mainWindow.setTitle(title ? title + ' - ' + PRODUCT_NAME : PRODUCT_NAME);
}

function sendBrowserState(tab) {
  if (!mainWindow || mainWindow.isDestroyed() || !tab) return;
  const contents = safeWebContents(tab);
  if (!contents) return;
  const payload = {
    id: tab.id,
    url: contents.getURL() || tab.lastUrl || '',
    title: contents.getTitle() || tab.title || '',
    canGoBack: contents.canGoBack(),
    canGoForward: contents.canGoForward(),
    isLoading: contents.isLoading()
  };
  tab.lastUrl = payload.url;
  tab.title = payload.title;
  updateWindowTitle(tab);
  mainWindow.webContents.send('browser:state', payload);
}

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  if (currentIndex < 0) return;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  activateTab(tabs[nextIndex].id, true);
}

function normalizeInputCode(input) {
  return String((input && (input.code || input.key)) || '').toLowerCase();
}

function handleZoomShortcut(event, input, contents) {
  if (!input || !input.control || input.type !== 'keyDown' || !contents || contents.isDestroyed()) return false;
  const key = String(input.key || '').toLowerCase();
  const code = normalizeInputCode(input);
  let direction = 0;
  let reset = false;

  if (key === '+' || key === '=' || code === 'equal' || code === 'numpadadd') direction = 1;
  else if (key === '-' || code === 'minus' || code === 'numpadsubtract') direction = -1;
  else if (key === '0' || code === 'digit0' || code === 'numpad0') reset = true;
  else return false;

  event.preventDefault();
  writeLog('ZOOM-KEY', 'key=' + key + ' code=' + code + ' shift=' + String(!!input.shift));
  if (reset) contents.setZoomFactor(1);
  else {
    const current = Number(contents.getZoomFactor()) || 1;
    let index = 0;
    let distance = Infinity;
    ZOOM_LEVELS.forEach((factor, factorIndex) => {
      const nextDistance = Math.abs(factor - current);
      if (nextDistance < distance) {
        distance = nextDistance;
        index = factorIndex;
      }
    });
    index += direction;
    index = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index));
    contents.setZoomFactor(ZOOM_LEVELS[index]);
  }

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const zoomFactor = Number(contents.getZoomFactor()) || 1;
      mainWindow.webContents.send('browser:zoom-state', {
        zoomFactor: zoomFactor,
        zoomPercent: Math.round(zoomFactor * 100)
      });
    }
  } catch (_error) {}
  return true;
}

function installContextMenu(tab) {
  const contents = safeWebContents(tab);
  if (!contents) return;
  contents.on('context-menu', (_event, params) => {
    try {
      const template = buildEditMenu(params);
      const linkUrl = String(params.linkURL || '');
      const srcUrl = String(params.srcURL || '');
      if (linkUrl) {
        if (template.length) template.push({ type: 'separator' });
        template.push({ label: '새 탭에서 링크 열기', click: () => createTab(linkUrl, true) });
        template.push({ label: '링크 주소 복사', click: () => clipboard.writeText(linkUrl) });
        if (isDownloadableUrl(linkUrl)) {
          template.push({ label: '링크 저장...', click: () => downloadUrl(contents, linkUrl) });
        }
      }
      if (srcUrl && isDownloadableUrl(srcUrl)) {
        if (template.length) template.push({ type: 'separator' });
        template.push({ label: '이미지/미디어 저장...', click: () => downloadUrl(contents, srcUrl) });
      }
      if (!template.length) template.push({ label: '새로고침', click: () => contents.reload() });
      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    } catch (error) {
      writeLog('CONTEXT-MENU', 'Failed to show context menu', error);
    }
  });
}

function downloadUrl(contents, url, fallbackName) {
  if (!contents || contents.isDestroyed() || !url) return;
  try {
    const savePath = dialog.showSaveDialogSync(mainWindow || undefined, {
      title: '파일 저장',
      defaultPath: path.join(app.getPath('downloads'), suggestedFilename(url, fallbackName))
    });
    if (!savePath || contents.isDestroyed()) return;
    contents.session.once('will-download', (_event, item) => {
      try { item.setSavePath(savePath); }
      catch (error) { writeLog('DOWNLOAD', 'Failed to set save path', error); }
    });
    contents.downloadURL(url);
  } catch (error) {
    writeLog('DOWNLOAD', 'Failed to download URL ' + url, error);
  }
}

function installTabEvents(tab) {
  const contents = safeWebContents(tab);
  if (!contents) return;

  contents.on('before-input-event', (event, input) => {
    try { handleZoomShortcut(event, input, contents); }
    catch (error) { writeLog('ZOOM-KEY', 'Page zoom shortcut handler failed', error); }
  });

  contents.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:page-focus');
      mainWindow.webContents.send('browser:close-bookmark-menus');
    }
  });

  contents.on('did-start-loading', () => { if (tab.id === activeTabId) sendBrowserState(tab); });
  contents.on('did-stop-loading', () => { if (tab.id === activeTabId) sendBrowserState(tab); });
  contents.on('did-navigate', (_event, url) => {
    tab.lastUrl = url || tab.lastUrl;
    if (tab.id === activeTabId) sendBrowserState(tab);
  });
  contents.on('did-navigate-in-page', (_event, url) => {
    tab.lastUrl = url || tab.lastUrl;
    if (tab.id === activeTabId) sendBrowserState(tab);
  });
  contents.on('page-title-updated', (_event, title) => {
    tab.title = title || tab.title;
    sendTabs();
    if (tab.id === activeTabId) sendBrowserState(tab);
  });
  contents.on('page-favicon-updated', (_event, favicons) => {
    if (mainWindow && !mainWindow.isDestroyed() && Array.isArray(favicons) && favicons.length) {
      mainWindow.webContents.send('browser:favicon', { url: contents.getURL() || tab.lastUrl || '', favicon: favicons[0] || '' });
    }
  });
  contents.on('zoom-changed', () => {
    if (tab.id !== activeTabId || !mainWindow || mainWindow.isDestroyed()) return;
    const factor = Number(contents.getZoomFactor()) || 1;
    mainWindow.webContents.send('browser:zoom-state', { zoomFactor: factor, zoomPercent: Math.round(factor * 100) });
  });
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    createTab(url || browserConfig.startUrl, true);
  });
  contents.on('did-fail-load', (_event, code, description, validatedUrl, isMainFrame) => {
    if (isMainFrame === false || code === -3) return;
    writeLog('NAVIGATION', 'Load failed code=' + code + ' url=' + validatedUrl + ' description=' + description);
  });
  contents.on('crashed', (_event, killed) => writeLog('RENDERER-CRASH', 'Tab renderer crashed. tab=' + tab.id + ' killed=' + String(!!killed)));
  installContextMenu(tab);
}

function createTab(url, makeActive) {
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      plugins: true,
      partition: BROWSER_PARTITION
    }
  });
  const tab = {
    id: nextTabId++,
    view: view,
    title: '새 탭',
    lastUrl: parseAddressInput(url || browserConfig.startUrl)
  };
  tabs.push(tab);
  installTabEvents(tab);
  view.webContents.loadURL(tab.lastUrl).catch((error) => writeLog('NAVIGATION', 'Initial tab load failed: ' + tab.lastUrl, error));
  sendTabs();
  if (makeActive !== false) activateTab(tab.id, true);
  return tab;
}

function activateTab(id, focusPage) {
  const tab = tabs.find((item) => item.id === id);
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
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    try {
      handleZoomShortcut(event, input, activeContents());
    } catch (error) {
      writeLog('ZOOM-KEY', 'Chrome UI zoom shortcut handler failed', error);
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
    try { tab.view.setBounds(browserBounds); }
    catch (error) { writeLog('BOUNDS', 'Failed to set BrowserView bounds', error); }
  }
});
ipcMain.on('browser:page-mousedown', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:close-bookmark-menus');
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

app.on('gpu-process-crashed', (_event, killed) => writeLog('GPU-CRASH', 'GPU process crashed. killed=' + String(!!killed)));
app.on('ready', async () => {
  writeLog('START', PRODUCT_NAME + ' starting. Electron=' + process.versions.electron + ' Chromium=' + process.versions.chrome);
  try { await initializeSessionCookiePersistence(); }
  catch (error) { writeLog('SESSION-COOKIE', 'Failed to initialize session cookie persistence', error); }
  createWindow();
});
app.on('before-quit', () => writeLog('STOP', PRODUCT_NAME + ' exiting.'));
app.on('window-all-closed', () => app.quit());
