'use strict';

const { ipcRenderer } = require('electron');

// BrowserView is a separate native surface, so clicks inside page content never
// reach the browser-chrome DOM. Forward only the fact that page content was
// pressed; do not inspect or alter the clicked element.
window.addEventListener('mousedown', () => {
  ipcRenderer.send('browser:page-mousedown');
}, true);
