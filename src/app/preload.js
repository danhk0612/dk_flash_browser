'use strict';

const { ipcRenderer } = require('electron');

window.dkBrowser = {
  send: function (channel, payload) {
    ipcRenderer.send(channel, payload);
  },
  on: function (channel, handler) {
    ipcRenderer.on(channel, function (_event, payload) {
      handler(payload);
    });
  }
};
