'use strict';

const path = require('path');
const os = require('os');
const { app, BrowserWindow, ipcMain } = require('electron');
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
app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
app.commandLine.appendSwitch('allow-outdated-plugins');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('user-agent', buildBrowserUserAgent());

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

    if (isTabDisposition(disposition)) {
      // Keep normal _blank / browser-tab style requests inside the main tab UI.
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
