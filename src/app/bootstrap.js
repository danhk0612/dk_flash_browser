'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, crashReporter, dialog, ipcMain } = require('electron');

const DEFAULT_START_URL = 'https://html.duckduckgo.com/html';
const MIN_FLASH_SIZE = 4 * 1024 * 1024;

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const rootDir = getRootDir();
const userDataPath = path.join(rootDir, 'UserData');
const bookmarksPath = path.join(userDataPath, 'bookmarks.json');
const configPath = path.join(rootDir, 'config.ini');
const flashPath = path.join(rootDir, 'Flash', 'pepflashplayer.dll');
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

function readConfigText() {
  try {
    return fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '') : '';
  } catch (error) {
    writeBootstrapLog('CONFIG', 'Failed to read config.ini', error);
    return '';
  }
}

function ensureDefaultStartUrl() {
  try {
    let text = readConfigText();
    if (!text.trim()) {
      fs.writeFileSync(configPath, '[Browser]\r\nStartUrl=' + DEFAULT_START_URL + '\r\n', 'utf8');
      writeBootstrapLog('CONFIG', 'Created config.ini with fallback StartUrl=' + DEFAULT_START_URL);
      return;
    }

    const lines = text.split(/\r?\n/);
    let browserStart = -1;
    let browserEnd = lines.length;
    let currentSection = '';
    let startUrlLine = -1;
    let startUrlValue = '';

    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        const nextSection = sectionMatch[1].trim().toLowerCase();
        if (currentSection === 'browser' && browserEnd === lines.length) browserEnd = i;
        currentSection = nextSection;
        if (currentSection === 'browser' && browserStart < 0) browserStart = i;
        continue;
      }
      if (currentSection !== 'browser') continue;
      const match = lines[i].match(/^\s*StartUrl\s*=\s*(.*)$/i);
      if (match) {
        startUrlLine = i;
        startUrlValue = String(match[1] || '').trim();
      }
    }

    if (startUrlLine >= 0 && startUrlValue) return;

    if (startUrlLine >= 0) {
      lines[startUrlLine] = 'StartUrl=' + DEFAULT_START_URL;
    } else if (browserStart >= 0) {
      lines.splice(browserEnd, 0, 'StartUrl=' + DEFAULT_START_URL);
    } else {
      if (lines.length && lines[lines.length - 1].trim()) lines.push('');
      lines.push('[Browser]');
      lines.push('StartUrl=' + DEFAULT_START_URL);
    }

    fs.writeFileSync(configPath, lines.join('\r\n'), 'utf8');
    writeBootstrapLog('CONFIG', 'Applied fallback StartUrl=' + DEFAULT_START_URL);
  } catch (error) {
    writeBootstrapLog('CONFIG', 'Failed to apply fallback homepage', error);
  }
}

function parseDefaultBookmarks() {
  const text = readConfigText();
  if (!text) return [];

  const result = [];
  let section = '';
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) return;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim().toLowerCase();
      return;
    }
    if (section !== 'defaultbookmarks') return;

    const separator = line.indexOf('=');
    if (separator < 0) return;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (!/^bookmark\d*$/.test(key)) return;

    const value = line.slice(separator + 1).trim();
    if (!value) return;
    const divider = value.indexOf('|');
    const title = divider >= 0 ? value.slice(0, divider).trim() : value;
    const url = divider >= 0 ? value.slice(divider + 1).trim() : value;
    if (!url) return;

    result.push({
      id: 'default-' + String(result.length + 1),
      type: 'bookmark',
      title: title || url,
      url: url,
      favicon: ''
    });
  });
  return result;
}

function initializeDefaultBookmarks() {
  try {
    if (fs.existsSync(bookmarksPath)) return;

    const defaults = parseDefaultBookmarks();
    if (!defaults.length) return;

    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(bookmarksPath, JSON.stringify({ version: 2, items: defaults }, null, 2), 'utf8');
    writeBootstrapLog('BOOKMARKS', 'Created first-run bookmarks: ' + String(defaults.length));
  } catch (error) {
    writeBootstrapLog('BOOKMARKS', 'Failed to create first-run bookmarks', error);
  }
}

function validateFlashDll() {
  try {
    if (!fs.existsSync(flashPath)) {
      return { ok: false, reason: 'Flash DLL 파일을 찾을 수 없습니다.\n\n' + flashPath };
    }

    const stat = fs.statSync(flashPath);
    if (!stat.isFile() || stat.size < MIN_FLASH_SIZE) {
      return { ok: false, reason: 'Flash DLL 파일 크기 또는 형식이 올바르지 않습니다.\n\n' + flashPath };
    }

    const handle = fs.openSync(flashPath, 'r');
    try {
      const header = Buffer.alloc(4096);
      const bytesRead = fs.readSync(handle, header, 0, header.length, 0);
      if (bytesRead < 64 || header[0] !== 0x4d || header[1] !== 0x5a) {
        return { ok: false, reason: 'Flash DLL이 유효한 Windows PE 파일이 아닙니다.' };
      }
      const peOffset = header.readUInt32LE(0x3c);
      if (peOffset + 6 > bytesRead || header.toString('ascii', peOffset, peOffset + 4) !== 'PE\u0000\u0000') {
        return { ok: false, reason: 'Flash DLL의 PE 헤더를 확인할 수 없습니다.' };
      }
      const machine = header.readUInt16LE(peOffset + 4);
      if (machine !== 0x014c) {
        return { ok: false, reason: 'Flash DLL이 x86(32비트) 버전이 아닙니다.\n감지된 PE machine: 0x' + machine.toString(16) };
      }
    } finally {
      fs.closeSync(handle);
    }

    writeBootstrapLog('FLASH-CHECK', 'Flash preflight passed. path=' + flashPath + ' size=' + String(stat.size));
    return { ok: true, reason: '' };
  } catch (error) {
    writeBootstrapLog('FLASH-CHECK', 'Flash preflight failed with exception', error);
    return { ok: false, reason: 'Flash DLL 검사 중 오류가 발생했습니다.\n\n' + String(error && error.message ? error.message : error) };
  }
}

try {
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

    contents.on('focus', () => {
      try {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('browser:page-focus');
            win.webContents.send('browser:close-bookmark-menus');
          }
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

ipcMain.on('browser:focus-chrome', () => {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.focus();
      }
    });
  } catch (error) {
    writeBootstrapLog('BOOKMARK-MENU', 'Failed to focus browser chrome webContents', error);
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

ensureDefaultStartUrl();
initializeDefaultBookmarks();

const flashCheck = validateFlashDll();
if (!flashCheck.ok) {
  writeBootstrapLog('FLASH-CHECK', 'Browser startup blocked: ' + flashCheck.reason);
  app.once('ready', () => {
    try {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'DK Flash Browser - Flash 오류',
        message: 'Adobe Flash Player를 사용할 수 없습니다.',
        detail: flashCheck.reason + '\n\nFlash 구성요소를 확인한 후 다시 실행하세요.',
        buttons: ['확인'],
        defaultId: 0,
        noLink: true
      });
    } catch (error) {
      writeBootstrapLog('FLASH-CHECK', 'Failed to show Flash startup error dialog', error);
    }
    app.quit();
  });
} else {
  require('./main');
}
