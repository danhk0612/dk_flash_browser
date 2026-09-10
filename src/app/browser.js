'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  const homeUrl = params.get('startUrl') || 'about:blank';
  const bookmarkStorageKey = 'dkFlashBrowser.bookmarks.v1';

  const backButton = document.getElementById('back-button');
  const forwardButton = document.getElementById('forward-button');
  const reloadButton = document.getElementById('reload-button');
  const hardReloadButton = document.getElementById('hard-reload-button');
  const homeButton = document.getElementById('home-button');
  const bookmarkButton = document.getElementById('bookmark-button');
  const addressInput = document.getElementById('address-input');
  const bookmarkBar = document.getElementById('bookmark-bar');
  const bookmarkContextMenu = document.getElementById('bookmark-context-menu');
  const bookmarkDeleteButton = document.getElementById('bookmark-delete-button');
  const webview = document.getElementById('browser-view');

  let initialNavigationStarted = false;
  let isEditingAddress = false;
  let contextBookmarkUrl = '';

  function normalizeUrl(value) {
    const input = String(value || '').trim();
    if (!input) {
      return '';
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) {
      return input;
    }

    return 'http://' + input;
  }

  function currentUrl() {
    try {
      return webview.getURL() || '';
    } catch (_error) {
      return '';
    }
  }

  function loadBookmarks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(bookmarkStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    localStorage.setItem(bookmarkStorageKey, JSON.stringify(bookmarks));
  }

  function hideBookmarkContextMenu() {
    bookmarkContextMenu.hidden = true;
    contextBookmarkUrl = '';
  }

  function showBookmarkContextMenu(event, bookmarkUrl) {
    contextBookmarkUrl = bookmarkUrl;
    bookmarkContextMenu.hidden = false;

    const menuWidth = bookmarkContextMenu.offsetWidth;
    const menuHeight = bookmarkContextMenu.offsetHeight;
    const left = Math.min(event.clientX, Math.max(0, window.innerWidth - menuWidth - 4));
    const top = Math.min(event.clientY, Math.max(0, window.innerHeight - menuHeight - 4));

    bookmarkContextMenu.style.left = left + 'px';
    bookmarkContextMenu.style.top = top + 'px';
  }

  function removeBookmark(url) {
    const next = loadBookmarks().filter((entry) => entry.url !== url);
    saveBookmarks(next);
    renderBookmarks();
    updateBookmarkButton();
  }

  function updateBookmarkButton() {
    const url = currentUrl();
    const exists = loadBookmarks().some((bookmark) => bookmark.url === url);
    bookmarkButton.textContent = exists ? '★' : '☆';
    bookmarkButton.title = exists ? '북마크 제거 (Ctrl+D)' : '북마크 추가 (Ctrl+D)';
  }

  function renderBookmarks() {
    const bookmarks = loadBookmarks();
    bookmarkBar.textContent = '';

    bookmarks.forEach((bookmark) => {
      const item = document.createElement('button');
      item.className = 'bookmark-item';
      item.type = 'button';
      item.textContent = bookmark.title || bookmark.url;
      item.title = bookmark.url;
      item.addEventListener('click', () => navigate(bookmark.url));
      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showBookmarkContextMenu(event, bookmark.url);
      });
      bookmarkBar.appendChild(item);
    });
  }

  function toggleBookmark() {
    const url = currentUrl();
    if (!url || url === 'about:blank') {
      return;
    }

    const bookmarks = loadBookmarks();
    const index = bookmarks.findIndex((bookmark) => bookmark.url === url);

    if (index >= 0) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push({
        url: url,
        title: webview.getTitle() || url
      });
    }

    saveBookmarks(bookmarks);
    renderBookmarks();
    updateBookmarkButton();
  }

  function updateNavigationState() {
    try {
      backButton.disabled = !webview.canGoBack();
      forwardButton.disabled = !webview.canGoForward();
    } catch (_error) {
      backButton.disabled = true;
      forwardButton.disabled = true;
    }

    const url = currentUrl();
    if (url && !isEditingAddress && document.activeElement !== addressInput) {
      addressInput.value = url;
    }
    updateBookmarkButton();
  }

  function navigate(value) {
    const url = normalizeUrl(value);
    if (!url) {
      return;
    }

    webview.loadURL(url);
  }

  backButton.addEventListener('click', () => {
    if (webview.canGoBack()) {
      webview.goBack();
    }
  });

  forwardButton.addEventListener('click', () => {
    if (webview.canGoForward()) {
      webview.goForward();
    }
  });

  reloadButton.addEventListener('click', () => webview.reload());
  hardReloadButton.addEventListener('click', () => webview.reloadIgnoringCache());
  homeButton.addEventListener('click', () => navigate(homeUrl));
  bookmarkButton.addEventListener('click', toggleBookmark);

  bookmarkDeleteButton.addEventListener('click', () => {
    if (contextBookmarkUrl) {
      removeBookmark(contextBookmarkUrl);
    }
    hideBookmarkContextMenu();
  });

  addressInput.addEventListener('focus', () => {
    isEditingAddress = true;
    addressInput.select();
  });

  addressInput.addEventListener('input', () => {
    isEditingAddress = true;
  });

  addressInput.addEventListener('blur', () => {
    isEditingAddress = false;
    const url = currentUrl();
    if (url) {
      addressInput.value = url;
    }
  });

  addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const requestedUrl = addressInput.value;
      event.preventDefault();
      isEditingAddress = false;
      navigate(requestedUrl);
      addressInput.blur();
      webview.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      isEditingAddress = false;
      addressInput.value = currentUrl();
      addressInput.blur();
      webview.focus();
    }
  });

  webview.addEventListener('dom-ready', () => {
    if (!initialNavigationStarted) {
      initialNavigationStarted = true;
      navigate(homeUrl);
    }
    updateNavigationState();
  });

  webview.addEventListener('did-navigate', updateNavigationState);
  webview.addEventListener('did-navigate-in-page', updateNavigationState);
  webview.addEventListener('did-stop-loading', updateNavigationState);
  webview.addEventListener('page-title-updated', updateBookmarkButton);

  window.dkFlashBrowserCommand = function (command) {
    if (command === 'focus-address') {
      isEditingAddress = true;
      addressInput.focus();
      addressInput.select();
      return;
    }

    if (command === 'toggle-bookmark') {
      toggleBookmark();
      return;
    }

    if (command === 'home') {
      navigate(homeUrl);
    }
  };

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      isEditingAddress = true;
      addressInput.focus();
      addressInput.select();
      return;
    }

    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleBookmark();
      return;
    }

    if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') ||
        (event.ctrlKey && event.key === 'F5')) {
      event.preventDefault();
      webview.reloadIgnoringCache();
      return;
    }

    if ((event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'r') || event.key === 'F5') {
      event.preventDefault();
      webview.reload();
      return;
    }

    if (event.altKey && event.key === 'Home') {
      event.preventDefault();
      navigate(homeUrl);
    }
  });

  window.addEventListener('mousedown', (event) => {
    if (!bookmarkContextMenu.hidden && !bookmarkContextMenu.contains(event.target)) {
      hideBookmarkContextMenu();
    }
  });

  window.addEventListener('blur', hideBookmarkContextMenu);
  window.addEventListener('resize', hideBookmarkContextMenu);

  renderBookmarks();
  webview.src = 'about:blank';
})();
