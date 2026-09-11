'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, BrowserWindow, Menu, dialog, ipcMain, session, webContents } = require('electron');
const appManifest = require('./package.json');

const FLASH_VERSION = '29.0.0.140';
const BROWSER_PARTITION = 'persist:dk-flash-browser';
const PRODUCT_NAME = 'DK Flash Browser';

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

function buildBrowserUserAgent() {
  const releaseParts = String(os.release() || '10.0').split('.');
  const windowsVersion = (releaseParts[0] || '10') + '.' + (releaseParts[1] || '0');
  const wow64 = process.arch === 'ia32' && !!process.env.PROCESSOR_ARCHITEW6432;
  const platformToken = 'Windows NT ' + windowsVersion + (wow64 ? '; WOW64' : '');
  const chromiumVersion = String(process.versions.chrome || '76.0.3809.146');
  const appVersion = String(appManifest.version || '1.0.0');

  // Keep the Chrome token for legacy site compatibility while appending explicit
  // DK Flash Browser / Chromium identity tokens. Product tokens intentionally do
  // not contain spaces because many user-agent parsers expect token/version form.
  return 'Mozilla/5.0 (' + platformToken + ') ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/' + chromiumVersion + ' Safari/537.36 ' +
    'DKFlashBrowser/' + appVersion + ' Chromium/' + chromiumVersion;
}

// Pepper Flash and the custom user-agent must be registered with Chromium before
// Electron becomes ready so BrowserViews and content-only popup windows inherit
// the same environment.
const rootDir = getRootDir();
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
const appIconPath = path.join(rootDir, 'DKFlashBrowser.ico');
const preferencesPath = path.join(rootDir, 'UserData', 'browser-preferences.json');
const bookmarksPath = path.join(rootDir, 'UserData', 'bookmarks.json');
const flashCandidatesByContents = new Map();
const imageCandidatesByContents = new Map();
app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
app.commandLine.appendSwitch('allow-outdated-plugins');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('user-agent', buildBrowserUserAgent());

function loadPopupRoutingPreference() {
  try {
    if (!fs.existsSync(preferencesPath)) return false;
    const parsed = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    return !!(parsed && parsed.forcePopupToTab);
  } catch (_error) {
    return false;
  }
}

function savePopupRoutingPreference(enabled) {
  try {
    let parsed = {};
    if (fs.existsSync(preferencesPath)) {
      try { parsed = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')) || {}; } catch (_error) { parsed = {}; }
    }
    parsed.forcePopupToTab = !!enabled;
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    const tempPath = preferencesPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2), 'utf8');
    if (fs.existsSync(preferencesPath)) fs.unlinkSync(preferencesPath);
    fs.renameSync(tempPath, preferencesPath);
  } catch (_error) {}
}

app.dkForcePopupToTab = loadPopupRoutingPreference();
app.dkSetForcePopupToTab = function (enabled) {
  app.dkForcePopupToTab = !!enabled;
  savePopupRoutingPreference(app.dkForcePopupToTab);
};

function normalizeLaunchUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) return input;
  return 'http://' + input;
}

function parseLaunchOptions(argv) {
  const args = Array.isArray(argv) ? argv.slice(process.defaultApp ? 2 : 1) : [];
  let startMaximized = false;
  let startUrl = '';

  args.forEach((rawArg) => {
    const arg = String(rawArg || '').trim();
    if (!arg) return;
    if (arg === '--start-maximized') {
      startMaximized = true;
      return;
    }
    if (arg.startsWith('-') || startUrl) return;
    startUrl = normalizeLaunchUrl(arg);
  });

  return { startMaximized, startUrl };
}

function isTabDisposition(disposition) {
  return disposition === 'foreground-tab' || disposition === 'background-tab';
}

function getMainBrowserWindow() {
  const windows = BrowserWindow.getAllWindows();
  for (let i = 0; i < windows.length; i += 1) {
    const win = windows[i];
    if (!win || win.isDestroyed()) continue;
    try {
      if (typeof win.getBrowserView === 'function' && win.getBrowserView()) return win;
    } catch (_error) {}
  }
  const focused = BrowserWindow.getFocusedWindow();
  return focused && !focused.isDestroyed() ? focused : null;
}

function getActiveBrowserViewContents() {
  const win = getMainBrowserWindow();
  if (!win || win.isDestroyed() || typeof win.getBrowserView !== 'function') return null;
  try {
    const view = win.getBrowserView();
    return view && view.webContents && !view.webContents.isDestroyed() ? view.webContents : null;
  } catch (_error) {
    return null;
  }
}

function sendMenuCommand(command) {
  const win = getMainBrowserWindow();
  if (!win || win.isDestroyed()) return;
  try { win.webContents.send('browser:menu-command', command); } catch (_error) {}
}

function mediaFilename(url, fallback) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(path.basename(parsed.pathname || ''));
    return name || fallback;
  } catch (_error) {
    return fallback;
  }
}

function mergeCandidates(map, contentsId, urls) {
  if (!contentsId) return;
  const current = map.get(contentsId) || [];
  const merged = current.concat(Array.isArray(urls) ? urls : []);
  map.set(contentsId, Array.from(new Set(merged.filter((url) => typeof url === 'string' && url))));
}

function normalizedCandidates(map, contents) {
  const stored = contents ? (map.get(contents.id) || []) : [];
  return Array.from(new Set(stored.filter((url) => typeof url === 'string' && url)));
}

function candidateLabel(url, index, fallback) {
  const name = mediaFilename(url, fallback);
  try {
    const parsed = new URL(url);
    return String(index + 1) + '. ' + name + ' — ' + parsed.host;
  } catch (_error) {
    return String(index + 1) + '. ' + name;
  }
}

function downloadMediaUrl(contents, url, fallback, title) {
  if (!contents || contents.isDestroyed() || !url) return;
  try {
    const win = getMainBrowserWindow();
    const savePath = dialog.showSaveDialogSync(win || undefined, {
      title: title,
      defaultPath: path.join(app.getPath('downloads'), mediaFilename(url, fallback))
    });
    if (!savePath || contents.isDestroyed()) return;
    contents.session.once('will-download', (_event, item) => {
      try { item.setSavePath(savePath); } catch (_error) {}
    });
    contents.downloadURL(url);
  } catch (_error) {}
}

function mediaSubmenu(contents, type) {
  const isFlash = type === 'flash';
  const candidates = normalizedCandidates(isFlash ? flashCandidatesByContents : imageCandidatesByContents, contents);
  if (!candidates.length) return [{ label: '감지된 항목 없음', enabled: false }];
  return candidates.slice(0, 100).map((url, index) => ({
    label: candidateLabel(url, index, isFlash ? 'flash.swf' : 'image'),
    toolTip: url,
    click: () => downloadMediaUrl(contents, url, isFlash ? 'flash.swf' : 'image', isFlash ? 'Flash 파일 저장' : '이미지 저장')
  }));
}

function currentZoomPercent(contents) {
  if (!contents || contents.isDestroyed()) return 100;
  try { return Math.round((Number(contents.getZoomFactor()) || 1) * 100); }
  catch (_error) { return 100; }
}

function showEnhancedFeatureMenu() {
  const win = getMainBrowserWindow();
  const contents = getActiveBrowserViewContents();
  if (!win || win.isDestroyed()) return;

  const percent = currentZoomPercent(contents);
  const template = [
    { label: '뒤로가기', enabled: !!(contents && contents.canGoBack()), click: () => { try { contents.goBack(); } catch (_error) {} } },
    { label: '앞으로가기', enabled: !!(contents && contents.canGoForward()), click: () => { try { contents.goForward(); } catch (_error) {} } },
    { label: '새로고침', enabled: !!contents, click: () => { try { contents.reload(); } catch (_error) {} } },
    { label: '강제 새로고침 (캐시 무시)', enabled: !!contents, click: () => { try { contents.reloadIgnoringCache(); } catch (_error) {} } },
    { label: '홈', click: () => sendMenuCommand('home') },
    { type: 'separator' },
    { label: '새 탭', click: () => sendMenuCommand('new-tab') },
    { label: '주소창으로 이동', click: () => sendMenuCommand('focus-address') },
    { label: '현재 페이지 북마크 추가/제거', click: () => sendMenuCommand('toggle-bookmark') },
    { type: 'separator' },
    {
      label: '새창을 항상 새 탭으로 열기',
      type: 'checkbox',
      checked: !!app.dkForcePopupToTab,
      click: (item) => app.dkSetForcePopupToTab(!!item.checked)
    },
    { type: 'separator' },
    {
      label: '배율 (' + percent + '%)',
      enabled: !!contents,
      submenu: [
        { label: '확대', click: () => ipcMain.emit('browser:feature-zoom-in') },
        { label: '축소', click: () => ipcMain.emit('browser:feature-zoom-out') },
        { label: '100%로 초기화', click: () => ipcMain.emit('browser:feature-zoom-reset') }
      ]
    },
    {
      label: '다운로드',
      enabled: !!contents,
      submenu: [
        { label: 'Flash 다운로드', submenu: mediaSubmenu(contents, 'flash') },
        { label: '이미지 다운로드', submenu: mediaSubmenu(contents, 'image') }
      ]
    }
  ];

  try { Menu.buildFromTemplate(template).popup({ window: win }); } catch (_error) {}
}

function classifyMediaRequest(url, resourceType) {
  const value = String(url || '');
  if (/\.swf(?:$|[?#])/i.test(value)) return 'flash';
  if (resourceType === 'image' || /\.(?:png|jpe?g|gif|webp|bmp|ico)(?:$|[?#])/i.test(value)) return 'image';
  return '';
}

function trackMediaCandidates(event, urls, type) {
  try {
    if (!event || !event.sender || event.sender.isDestroyed()) return;
    mergeCandidates(type === 'flash' ? flashCandidatesByContents : imageCandidatesByContents, event.sender.id, urls);
  } catch (_error) {}
}

function installIntegratedNetworkTracking() {
  try {
    const browserSession = session.fromPartition(BROWSER_PARTITION);
    browserSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      try {
        const kind = classifyMediaRequest(details.url, details.resourceType);
        if (kind) {
          const contentsId = Number(details.webContentsId) || 0;
          if (contentsId) {
            mergeCandidates(kind === 'flash' ? flashCandidatesByContents : imageCandidatesByContents, contentsId, [details.url]);
            let contents = null;
            try { contents = webContents.fromId(contentsId); } catch (_error) {}
            if (contents && !contents.isDestroyed()) {
              // Feed the original bootstrap maps as well so Ctrl+Shift+S and any
              // legacy download entry points keep the same network-only coverage.
              ipcMain.emit(kind === 'flash' ? 'browser:flash-candidates' : 'browser:image-candidates', { sender: contents }, [details.url]);
            }
          }
        }
      } catch (_error) {}
      callback({ cancel: false });
    });
  } catch (_error) {}
}

function pageOrigin(url) {
  try {
    const parsed = new URL(String(url || ''));
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.origin : '';
  } catch (_error) {
    return '';
  }
}

function bookmarkFaviconState(pageUrl) {
  const targetOrigin = pageOrigin(pageUrl);
  if (!targetOrigin || !fs.existsSync(bookmarksPath)) return { count: 0, missing: 0 };
  try {
    const parsed = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : []);
    let count = 0;
    let missing = 0;
    const walk = (nodes) => {
      (Array.isArray(nodes) ? nodes : []).forEach((node) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'folder' || Array.isArray(node.children)) {
          walk(node.children);
          return;
        }
        if (!node.url || pageOrigin(node.url) !== targetOrigin) return;
        count += 1;
        if (!String(node.favicon || '').trim()) missing += 1;
      });
    };
    walk(items);
    return { count: count, missing: missing };
  } catch (_error) {
    return { count: 0, missing: 0 };
  }
}

function forwardFaviconCandidate(event, payload) {
  try {
    if (!event || !event.sender || event.sender.isDestroyed() || !payload) return;
    const pageUrl = String(payload.pageUrl || '');
    const favicon = String(payload.favicon || '');
    const source = String(payload.source || 'declared');
    if (!pageUrl || !favicon) return;

    const senderUrl = String(event.sender.getURL() || '');
    if (pageOrigin(pageUrl) && pageOrigin(senderUrl) && pageOrigin(pageUrl) !== pageOrigin(senderUrl)) return;

    if (source === 'fallback') {
      const state = bookmarkFaviconState(pageUrl);
      // A generic /favicon.ico fallback is only allowed to fill an origin whose
      // matching bookmarks are all missing icons. It must never replace a known
      // custom favicon with a weaker fallback candidate.
      if (!state.count || state.missing !== state.count) return;
    }

    const forwarded = { url: pageUrl, favicon: favicon };
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed()) win.webContents.send('browser:favicon', forwarded);
    });
  } catch (_error) {}
}

const popupWindows = new Set();

function createPopupWindow(url, options) {
  const requested = options && typeof options === 'object' ? options : {};
  const requestedWebPreferences = requested.webPreferences && typeof requested.webPreferences === 'object'
    ? requested.webPreferences
    : {};

  const popupOptions = Object.assign({}, requested, {
    width: Number(requested.width) > 0 ? Number(requested.width) : 800,
    height: Number(requested.height) > 0 ? Number(requested.height) : 600,
    title: PRODUCT_NAME,
    icon: appIconPath,
    show: false,
    autoHideMenuBar: true,
    webPreferences: Object.assign({}, requestedWebPreferences, {
      nodeIntegration: false,
      plugins: true,
      partition: BROWSER_PARTITION
    })
  });

  // A BrowserWindow created for event.newGuest must own its WebContents. Reusing
  // an Electron-supplied webContents here can bypass the explicit portable
  // partition / plugin settings above.
  delete popupOptions.webContents;

  const popup = new BrowserWindow(popupOptions);
  popupWindows.add(popup);
  try { popup.setMenu(null); } catch (_error) {}

  popup.once('ready-to-show', () => {
    try {
      if (!popup.isDestroyed()) popup.show();
    } catch (_error) {}
  });
  popup.on('closed', () => popupWindows.delete(popup));

  const targetUrl = String(url || 'about:blank');
  popup.loadURL(targetUrl).catch(() => {});
  return popup;
}

function routeNewWindow(event, url, _frameName, disposition, options) {
  try {
    event.preventDefault();

    if (app.dkForcePopupToTab || isTabDisposition(disposition)) {
      // Keep normal _blank requests in tabs. When the user enables the feature
      // menu toggle, real popup/window.open requests are routed to tabs as well.
      ipcMain.emit('browser:new-tab', { sender: null }, url || 'about:blank');
      return;
    }

    // window.open(), explicitly requested new-window dispositions, and legacy
    // popup-style requests retain a real content-only BrowserWindow. Setting
    // event.newGuest preserves Electron's child-window/opener behavior.
    const popup = createPopupWindow(url, options);
    event.newGuest = popup;
  } catch (_error) {}
}

function installWindowRouting(contents) {
  if (!contents || typeof contents.on !== 'function') return;

  // main.js historically installed a catch-all new-window handler that forced
  // every request into a tab. BrowserView creation emits web-contents-created
  // before that handler is attached, so defer one tick, replace only the
  // new-window routing listeners, and leave all other BrowserView handlers intact.
  process.nextTick(() => {
    try {
      if (!contents || contents.isDestroyed()) return;
      contents.removeAllListeners('new-window');
      contents.on('new-window', routeNewWindow);
    } catch (_error) {}
  });
}

// Apply the same routing rule to main BrowserViews and content-only popup
// windows, so a popup can legitimately open another popup when legacy code
// requires it.
app.on('web-contents-created', (_event, contents) => installWindowRouting(contents));

ipcMain.on('browser:enhanced-feature-menu', showEnhancedFeatureMenu);
ipcMain.on('browser:flash-candidates', (event, urls) => trackMediaCandidates(event, urls, 'flash'));
ipcMain.on('browser:image-candidates', (event, urls) => trackMediaCandidates(event, urls, 'image'));
ipcMain.on('browser:page-favicon-candidate', forwardFaviconCandidate);

const launchOptions = parseLaunchOptions(process.argv);
let maximizePending = launchOptions.startMaximized;
let startUrlPending = launchOptions.startUrl;

if (maximizePending) {
  app.on('browser-window-created', (_event, win) => {
    if (!maximizePending || !win || win.isDestroyed()) return;
    maximizePending = false;
    try { win.maximize(); } catch (_error) {}
  });
}

if (startUrlPending) {
  app.on('web-contents-created', (_event, contents) => {
    try {
      if (!startUrlPending || !contents || typeof contents.getType !== 'function' || contents.getType() !== 'browserView') return;

      const targetUrl = startUrlPending;
      startUrlPending = '';
      let redirected = false;

      const redirectToLaunchUrl = (_navigationEvent, currentUrl, _isInPlace, isMainFrame) => {
        if (redirected || isMainFrame === false) return;
        redirected = true;
        if (String(currentUrl || '') === targetUrl) return;
        setImmediate(() => {
          try {
            if (contents && !contents.isDestroyed()) contents.loadURL(targetUrl).catch(() => {});
          } catch (_error) {}
        });
      };

      contents.on('did-start-navigation', redirectToLaunchUrl);

      // Fallback for unusual pages that do not emit the initial main-frame event.
      setTimeout(() => {
        if (redirected || !contents || contents.isDestroyed()) return;
        redirected = true;
        try { contents.loadURL(targetUrl).catch(() => {}); } catch (_error) {}
      }, 500);
    } catch (_error) {}
  });
}

require('./bootstrap');

// Electron webRequest keeps only the last listener for a given hook. Register the
// integrated tracker after bootstrap so it becomes the active listener, while
// feeding every detected URL back through bootstrap's existing IPC caches.
app.on('ready', installIntegratedNetworkTracking);
