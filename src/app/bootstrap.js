'use strict';

const fs = require('fs');
const path = require('path');
const { app, crashReporter } = require('electron');

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const rootDir = getRootDir();
const logDir = path.join(rootDir, 'Logs');
const logPath = path.join(logDir, 'browser.log');
const crashDir = path.join(rootDir, 'CrashDumps');

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
  fs.mkdirSync(crashDir, { recursive: true });
  app.setPath('crashDumps', crashDir);
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
  writeBootstrapLog('CRASH-REPORTER', 'Crash reporter enabled. dumps=' + crashDir);
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
