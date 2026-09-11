'use strict';

const fs = require('fs');
const path = require('path');
const { app, crashReporter } = require('electron');

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
  // Keep all Crashpad data portable by setting userData before crashReporter starts.
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
