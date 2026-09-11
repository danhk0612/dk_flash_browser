'use strict';

const path = require('path');
const { app } = require('electron');

const FLASH_VERSION = '29.0.0.140';

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

// Pepper Flash must be registered with Chromium before Electron becomes ready.
// Keep this in the earliest application entry point so both development and
// packaged/public-release launches use the same user-supplied DLL path.
const rootDir = getRootDir();
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
app.commandLine.appendSwitch('ppapi-flash-path', flashPath);
app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
app.commandLine.appendSwitch('allow-outdated-plugins');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');

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
