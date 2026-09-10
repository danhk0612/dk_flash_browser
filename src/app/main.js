'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, dialog, clipboard } = require('electron');

const FLASH_VERSION = '29.0.0.140';
const PRODUCT_NAME = 'DK Flash Browser';

function getRootDir() {
  if (process.defaultApp) {
    return path.resolve(__dirname, '..', '..');
  }

  return path.dirname(process.execPath);
}

function readBrowserConfig(configPath) {
  const config = {
    startUrl: 'about:blank'
  };

  if (!fs.existsSync(configPath)) {
    return config;
  }

  const lines = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let section = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    if (section !== 'browser') {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'starturl' && value) {
      config.startUrl = value;
    }
  }

  return config;
}

function suggestedFilename(url, fallback) {
  if (fallback) {
    return fallback;
  }

  try {
    const pathname = new URL(url).pathname;
    const name = path.basename(pathname);
    if (name) {
      return name;
    }
  } catch (_error) {
    // Fall through to a generic filename.
  }

  return 'download';
}

function downloadWithPrompt(contents, url, filename) {
  if (!url) {
    return;
  }

  const savePath = dialog.showSaveDialogSync(mainWindow || undefined, {
    title: '다른 이름으로 저장',
    defaultPath: path.join(app.getPath('downloads'), suggestedFilename(url, filename))
  });

  if (!savePath) {
    return;
  }

  contents.session.once('will-download', (_event, item) => {
    item.setSavePath(savePath);
  });

  contents.downloadURL(url);
}

function installGuestContextMenu(contents) {
  contents.on('context-menu', (_event, params) => {
    const template = [];

    if (params.linkURL) {
      template.push({
        label: '링크 다운로드...',
        click: () => downloadWithPrompt(contents, params.linkURL, params.suggestedFilename)
      });
      template.push({
        label: '링크 주소 복사',
        click: () => clipboard.writeText(params.linkURL)
      });
    }

    if (params.srcURL && params.srcURL !== params.linkURL) {
      const mediaLabel = params.mediaType === 'image' ? '이미지 다운로드...' : '미디어 다운로드...';
      template.push({
        label: mediaLabel,
        click: () => downloadWithPrompt(contents, params.srcURL, params.suggestedFilename)
      });
    }

    if (template.length > 0) {
      template.push({ type: 'separator' });
    }

    if (params.isEditable) {
      template.push({ role: 'cut', label: '잘라내기' });
      template.push({ role: 'copy', label: '복사' });
      template.push({ role: 'paste', label: '붙여넣기' });
      template.push({ role: 'selectall', label: '모두 선택' });
    } else if (params.selectionText) {
      template.push({ role: 'copy', label: '복사' });
    }

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window: mainWindow || undefined });
    }
  });
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

app.on('web-contents-created', (_event, contents) => {
  if (typeof contents.getType === 'function' && contents.getType() === 'webview') {
    installGuestContextMenu(contents);
  }
});

function createWindow() {
  const config = readBrowserConfig(configPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: PRODUCT_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      plugins: true,
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'browser.html'), {
    query: {
      startUrl: config.startUrl
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
