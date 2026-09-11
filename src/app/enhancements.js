'use strict';

(function () {
  if (!window.dkBrowser) return;

  const featureButton = document.getElementById('feature-menu-button');
  const bookmarkButton = document.getElementById('bookmark-button');
  const addressInput = document.getElementById('address-input');
  const homeUrl = new URLSearchParams(window.location.search).get('startUrl') || 'about:blank';

  function send(channel, payload) {
    window.dkBrowser.send(channel, payload);
  }

  if (featureButton) {
    featureButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      send('browser:enhanced-feature-menu');
    });
  }

  window.dkBrowser.on('browser:menu-command', function (command) {
    switch (String(command || '')) {
      case 'home':
        if (addressInput) addressInput.value = homeUrl;
        send('browser:home');
        break;
      case 'new-tab':
        send('browser:new-tab', homeUrl);
        break;
      case 'focus-address':
        if (addressInput) {
          addressInput.focus();
          addressInput.select();
        }
        break;
      case 'toggle-bookmark':
        if (bookmarkButton) bookmarkButton.click();
        break;
      default:
        break;
    }
  });
})();
