'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  const homeUrl = params.get('startUrl') || 'about:blank';
  const bookmarkStorageKey = 'dkFlashBrowser.bookmarks.v1';

  const tabList = document.getElementById('tab-list');
  const newTabButton = document.getElementById('new-tab-button');
  const backButton = document.getElementById('back-button');
  const forwardButton = document.getElementById('forward-button');
  const reloadButton = document.getElementById('reload-button');
  const hardReloadButton = document.getElementById('hard-reload-button');
  const homeButton = document.getElementById('home-button');
  const bookmarkButton = document.getElementById('bookmark-button');
  const addressInput = document.getElementById('address-input');
  const bookmarkBar = document.getElementById('bookmark-bar');
  const browserPlaceholder = document.getElementById('browser-placeholder');

  let currentState = { id: null, url: '', title: '', canGoBack: false, canGoForward: false, isLoading: false };
  let tabState = { activeTabId: null, tabs: [] };
  let isEditingAddress = false;

  function send(channel, payload) {
    window.dkBrowser.send(channel, payload);
  }

  function normalizeUrl(value) {
    const input = String(value || '').trim();
    if (!input) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) return input;
    return 'http://' + input;
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

  function removeBookmark(url) {
    saveBookmarks(loadBookmarks().filter((entry) => entry.url !== url));
    renderBookmarks();
    updateBookmarkButton();
  }

  function updateBookmarkButton() {
    const exists = loadBookmarks().some((bookmark) => bookmark.url === currentState.url);
    bookmarkButton.textContent = exists ? '★' : '☆';
    bookmarkButton.title = exists ? '북마크 제거 (Ctrl+D)' : '북마크 추가 (Ctrl+D)';
  }

  function renderBookmarks() {
    bookmarkBar.textContent = '';
    loadBookmarks().forEach((bookmark) => {
      const item = document.createElement('button');
      item.className = 'bookmark-item';
      item.type = 'button';
      item.textContent = bookmark.title || bookmark.url;
      item.title = bookmark.url;
      item.addEventListener('click', () => navigate(bookmark.url));
      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        send('browser:bookmark-context', bookmark.url);
      });
      bookmarkBar.appendChild(item);
    });
  }

  function toggleBookmark() {
    const url = currentState.url;
    if (!url || url === 'about:blank') return;
    const bookmarks = loadBookmarks();
    const index = bookmarks.findIndex((bookmark) => bookmark.url === url);
    if (index >= 0) bookmarks.splice(index, 1);
    else bookmarks.push({ url: url, title: currentState.title || url });
    saveBookmarks(bookmarks);
    renderBookmarks();
    updateBookmarkButton();
  }

  function renderTabs(state) {
    tabState = state || { activeTabId: null, tabs: [] };
    tabList.textContent = '';

    tabState.tabs.forEach((tab) => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === tabState.activeTabId ? ' active' : '');
      item.title = tab.title || tab.url || '새 탭';

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || '새 탭';
      title.addEventListener('click', () => send('browser:switch-tab', tab.id));

      const close = document.createElement('button');
      close.className = 'tab-close';
      close.type = 'button';
      close.title = '탭 닫기 (Ctrl+W)';
      close.textContent = '×';
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        send('browser:close-tab', tab.id);
      });

      item.addEventListener('click', () => send('browser:switch-tab', tab.id));
      item.appendChild(title);
      item.appendChild(close);
      tabList.appendChild(item);
    });
  }

  function updateNavigationState(state) {
    currentState = Object.assign({}, currentState, state || {});
    backButton.disabled = !currentState.canGoBack;
    forwardButton.disabled = !currentState.canGoForward;
    if (currentState.url && !isEditingAddress && document.activeElement !== addressInput) addressInput.value = currentState.url;
    updateBookmarkButton();
  }

  function navigate(value) {
    const url = normalizeUrl(value);
    if (!url) return;
    addressInput.value = url;
    send('browser:navigate', url);
  }

  function syncBrowserBounds() {
    const rect = browserPlaceholder.getBoundingClientRect();
    send('browser:bounds', { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  }

  newTabButton.addEventListener('click', () => send('browser:new-tab', homeUrl));
  backButton.addEventListener('click', () => send('browser:back'));
  forwardButton.addEventListener('click', () => send('browser:forward'));
  reloadButton.addEventListener('click', () => send('browser:reload'));
  hardReloadButton.addEventListener('click', () => send('browser:hard-reload'));
  homeButton.addEventListener('click', () => {
    addressInput.value = homeUrl;
    send('browser:home');
  });
  bookmarkButton.addEventListener('click', toggleBookmark);

  addressInput.addEventListener('focus', () => {
    isEditingAddress = true;
    addressInput.select();
  });
  addressInput.addEventListener('input', () => { isEditingAddress = true; });
  addressInput.addEventListener('blur', () => {
    isEditingAddress = false;
    if (currentState.url) addressInput.value = currentState.url;
  });
  addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const requested = addressInput.value;
      isEditingAddress = false;
      navigate(requested);
      addressInput.blur();
      send('browser:focus-page');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      isEditingAddress = false;
      addressInput.value = currentState.url || '';
      addressInput.blur();
      send('browser:focus-page');
    }
  });

  window.dkBrowser.on('browser:state', updateNavigationState);
  window.dkBrowser.on('browser:tabs', renderTabs);
  window.dkBrowser.on('browser:focus-address', () => {
    isEditingAddress = true;
    addressInput.focus();
    addressInput.select();
  });
  window.dkBrowser.on('browser:toggle-bookmark', toggleBookmark);
  window.dkBrowser.on('browser:delete-bookmark', (url) => { if (url) removeBookmark(url); });
  window.dkBrowser.on('browser:request-bounds', syncBrowserBounds);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey && !event.shiftKey && key === 'l') {
      event.preventDefault();
      addressInput.focus();
      addressInput.select();
      return;
    }
    if (event.ctrlKey && !event.shiftKey && key === 'd') {
      event.preventDefault();
      toggleBookmark();
      return;
    }
    if (event.ctrlKey && !event.shiftKey && key === 't') {
      event.preventDefault();
      send('browser:new-tab', homeUrl);
      return;
    }
    if (event.ctrlKey && !event.shiftKey && key === 'w') {
      event.preventDefault();
      if (tabState.activeTabId !== null) send('browser:close-tab', tabState.activeTabId);
      return;
    }
    if (event.ctrlKey && key === 'tab') {
      event.preventDefault();
      send('browser:cycle-tab', event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.ctrlKey && event.shiftKey && key === 'r') || (event.ctrlKey && key === 'f5')) {
      event.preventDefault();
      send('browser:hard-reload');
      return;
    }
    if ((event.ctrlKey && !event.shiftKey && key === 'r') || key === 'f5') {
      event.preventDefault();
      send('browser:reload');
      return;
    }
    if (event.altKey && key === 'home') {
      event.preventDefault();
      addressInput.value = homeUrl;
      send('browser:home');
    }
  });

  window.addEventListener('resize', syncBrowserBounds);
  if (window.ResizeObserver) new ResizeObserver(syncBrowserBounds).observe(browserPlaceholder);

  renderBookmarks();
  syncBrowserBounds();
})();
