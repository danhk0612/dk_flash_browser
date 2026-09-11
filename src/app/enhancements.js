'use strict';

(function () {
  if (!window.dkBrowser) return;

  const featureButton = document.getElementById('feature-menu-button');
  const bookmarkButton = document.getElementById('bookmark-button');
  const addressInput = document.getElementById('address-input');
  const homeUrl = new URLSearchParams(window.location.search).get('startUrl') || 'about:blank';
  const retryTimers = [];
  let lastPageUrl = '';

  function send(channel, payload) {
    window.dkBrowser.send(channel, payload);
  }

  function pageOrigin(url) {
    try {
      const parsed = new URL(String(url || ''));
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.origin : '';
    } catch (_error) {
      return '';
    }
  }

  function samePageOrOrigin(left, right) {
    if (!left || !right) return false;
    if (String(left) === String(right)) return true;
    const leftOrigin = pageOrigin(left);
    const rightOrigin = pageOrigin(right);
    return !!leftOrigin && leftOrigin === rightOrigin;
  }

  function walkBookmarks(nodes, handler) {
    (Array.isArray(nodes) ? nodes : []).forEach(function (node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'folder' || Array.isArray(node.children)) walkBookmarks(node.children, handler);
      else handler(node);
    });
  }

  function readBookmarkStore() {
    try {
      const stored = window.dkBrowser.loadBookmarks();
      if (Array.isArray(stored)) return { version: 2, items: stored };
      if (stored && stored.version === 2 && Array.isArray(stored.items)) return stored;
    } catch (_error) {}
    return null;
  }

  function testImage(url, callback) {
    if (!url) return callback(false);
    const image = new Image();
    let done = false;
    const finish = function (ok) {
      if (done) return;
      done = true;
      image.onload = null;
      image.onerror = null;
      callback(!!ok);
    };
    image.onload = function () { finish(true); };
    image.onerror = function () { finish(false); };
    image.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_dkfb=' + Date.now();
    window.setTimeout(function () { finish(false); }, 2500);
  }

  function refreshBookmarkedFavicon(pageUrl) {
    const origin = pageOrigin(pageUrl);
    if (!origin) return;

    const store = readBookmarkStore();
    if (!store) return;

    const matches = [];
    walkBookmarks(store.items, function (node) {
      if (node && node.url && samePageOrOrigin(node.url, pageUrl)) matches.push(node);
    });
    if (!matches.length) return;

    // The normal browser:favicon event remains the preferred source and will
    // update stored custom favicon URLs. This retry path covers sites that do
    // not emit that event by probing /favicon.ico whenever a bookmarked site is
    // actually visited. A cache-busting query also refreshes same-URL icons.
    const fallback = origin + '/favicon.ico';
    testImage(fallback, function (ok) {
      if (!ok) return;
      let changed = false;
      matches.forEach(function (node) {
        if (node.favicon !== fallback) {
          node.favicon = fallback;
          changed = true;
        }
      });
      if (changed) {
        try { window.dkBrowser.saveBookmarks(store); } catch (_error) {}
      }
    });
  }

  function scheduleFaviconRetries(pageUrl) {
    while (retryTimers.length) window.clearTimeout(retryTimers.pop());
    if (!pageOrigin(pageUrl)) return;
    [350, 1600, 4500].forEach(function (delay) {
      retryTimers.push(window.setTimeout(function () {
        if (lastPageUrl === pageUrl) refreshBookmarkedFavicon(pageUrl);
      }, delay));
    });
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

  window.dkBrowser.on('browser:state', function (state) {
    const url = state && state.url ? String(state.url) : '';
    if (!url || url === lastPageUrl) return;
    lastPageUrl = url;
    scheduleFaviconRetries(url);
  });
})();
