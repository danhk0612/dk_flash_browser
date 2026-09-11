'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, crashReporter } = require('electron');

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const rootDir = getRootDir();
const userDataPath = path.join(rootDir, 'UserData');
const logDir = path.join(rootDir, 'Logs');
const logPath = path.join(logDir, 'browser.log');

function writeBootstrapLog(type, message, error) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const details = error && error.stack ? error.stack : (error ? String(error) : '');
    fs.appendFileSync(
      logPath,
      '[' + new Date().toISOString() + '] [' + type + '] ' + message + (details ? '\n' + details : '') + '\n',
      'utf8'
    );
  } catch (_error) {
    // Diagnostics must never prevent browser startup.
  }
}

try {
  // Electron 6 does not support app.setPath('crashDumps', ...).
  // Keep the portable browser profile fixed before Crashpad starts.
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath('userData', userDataPath);

  crashReporter.start({
    companyName: 'danhk0612',
    productName: 'DK Flash Browser',
    submitURL: 'http://127.0.0.1/',
    uploadToServer: false,
    ignoreSystemCrashHandler: false,
    extra: {
      runtime: 'electron-6.1.12',
      purpose: 'legacy-flash-browser'
    }
  });

  let crashDirectory = '';
  try {
    if (typeof crashReporter.getCrashesDirectory === 'function') {
      crashDirectory = crashReporter.getCrashesDirectory() || '';
    }
  } catch (error) {
    writeBootstrapLog('CRASH-REPORTER', 'Crash reporter started, but crash directory lookup failed', error);
  }

  writeBootstrapLog(
    'CRASH-REPORTER',
    'Crash reporter enabled.' + (crashDirectory ? ' dumps=' + crashDirectory : ' dumps=under portable UserData')
  );
} catch (error) {
  writeBootstrapLog('CRASH-REPORTER', 'Failed to initialize crash reporter', error);
}

// Electron 5-7 on Windows has known native BrowserView lifecycle crashes when a
// BrowserView WebContents is explicitly destroyed while native view/layout work
// is still in flight. DK Flash Browser uses BrowserViews as tabs, so stability is
// more important than reclaiming a closed tab immediately. Closed BrowserView
// renderers are left for Electron/OS cleanup when the application exits.
app.on('web-contents-created', (_event, contents) => {
  try {
    if (!contents || typeof contents.getType !== 'function' || contents.getType() !== 'browserView') return;
    const originalDestroy = contents.destroy.bind(contents);
    let destroySuppressed = false;

    contents.destroy = function guardedBrowserViewDestroy() {
      if (app.isQuitting) {
        return originalDestroy();
      }
      if (!destroySuppressed) {
        destroySuppressed = true;
        writeBootstrapLog('BROWSERVIEW-LIFECYCLE', 'Suppressed runtime BrowserView destroy for webContents=' + String(contents.id));
      }
      return undefined;
    };

    // BrowserView content is a separate native surface. Clicking the page does
    // not generate DOM events in the browser chrome renderer, so tell the chrome
    // explicitly to close bookmark menus whenever page content gains focus.
    contents.on('focus', () => {
      try {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed()) win.webContents.send('browser:close-bookmark-menus');
        });
      } catch (error) {
        writeBootstrapLog('BOOKMARK-MENU', 'Failed to close bookmark menus on BrowserView focus', error);
      }
    });

    contents.on('page-favicon-updated', (_faviconEvent, favicons) => {
      try {
        if (!Array.isArray(favicons) || !favicons.length || contents.isDestroyed()) return;
        const payload = {
          url: contents.getURL() || '',
          favicon: favicons[0] || ''
        };
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed()) win.webContents.send('browser:favicon', payload);
        });
      } catch (error) {
        writeBootstrapLog('FAVICON', 'Failed to forward page favicon', error);
      }
    });
  } catch (error) {
    writeBootstrapLog('BROWSERVIEW-LIFECYCLE', 'Failed to install BrowserView destroy guard', error);
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('renderer-process-crashed', (_event, webContents, killed) => {
  let url = '';
  try {
    if (webContents && !webContents.isDestroyed()) url = webContents.getURL() || '';
  } catch (_error) {}
  writeBootstrapLog('RENDERER-PROCESS-CRASHED', 'killed=' + String(!!killed) + ' url=' + url);
});

app.on('gpu-process-crashed', (_event, killed) => {
  writeBootstrapLog('GPU-PROCESS-CRASHED', 'killed=' + String(!!killed));
});

process.on('exit', (code) => {
  writeBootstrapLog('PROCESS-EXIT', 'Main process exit code=' + String(code));
});

require('./main');