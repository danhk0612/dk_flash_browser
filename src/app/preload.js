'use strict';

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const bookmarksPath = path.join(getRootDir(), 'UserData', 'bookmarks.json');

function loadBookmarksFile() {
  try {
    if (!fs.existsSync(bookmarksPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveBookmarksFile(bookmarks) {
  try {
    const safe = Array.isArray(bookmarks) ? bookmarks : [];
    fs.mkdirSync(path.dirname(bookmarksPath), { recursive: true });
    const tempPath = bookmarksPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(safe, null, 2), 'utf8');
    if (fs.existsSync(bookmarksPath)) fs.unlinkSync(bookmarksPath);
    fs.renameSync(tempPath, bookmarksPath);
    return true;
  } catch (_error) {
    return false;
  }
}

window.dkBrowser = {
  send: function (channel, payload) {
    ipcRenderer.send(channel, payload);
  },
  on: function (channel, handler) {
    ipcRenderer.on(channel, function (_event, payload) {
      handler(payload);
    });
  },
  loadBookmarks: loadBookmarksFile,
  saveBookmarks: saveBookmarksFile
};
