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
  const browserPlaceholder = document.getElementById('browser-placeholder');
  const bookmarkContextMenu = document.getElementById('bookmark-context-menu');
  const bookmarkDeleteButton = document.getElementById('bookmark-delete-button');

  let currentState = {
    url: '',
    title: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false
  };
  let isEditingAddress = false;
  let pendingAddress = '';
  let contextBookmarkUrl = '';

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

  function hideBookmarkContextMenu() {
    bookmarkContextMenu.hidden = true;
    contextBookmarkUrl = '';
  }

  function showBookmarkContextMenu(event, bookmarkUrl) {
    contextBookmarkUrl = bookmarkUrl;
    bookmarkContextMenu.hidden = false;
    const menuWidth = bookmarkContextMenu.offsetWidth;
    const menuHeight = bookmarkContextMenu.offsetHeight;
    bookmarkContextMenu.style.left = Math.min(event.clientX, Math.max(0, window.innerWidth - menuWidth - 4)) + 'px';
    bookmarkContextMenu.style.top = Math.min(event.clientY, Math.max(0, window.innerHeight - menuHeight - 4)) + 'px';
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
        showBookmarkContextMenu(event, bookmark.url);
      });
      bookmarkBar.appendChild(item);
    });
  }

  function toggleBookmark() {
    const url = currentState.url;
    if (!url || url === 'about:blank') return;

    const bookmarks = loadBookmarks();
    const index = bookmarks.findIndex((bookmark) => bookmark.url === url);
    if (index >= 0) {
      bookmarks.splice(index, 1);
    } else {
      bookmarks.push({ url: url, title: currentState.title || url });
    }
    saveBookmarks(bookmarks);
    renderBookmarks();
    updateBookmarkButton();
  }

  function updateNavigationState(state) {
    currentState = Object.assign({}, currentState, state || {});
    backButton.disabled = !currentState.canGoBack;
    forwardButton.disabled = !currentState.canGoForward;

    if (currentState.url && !isEditingAddress && !pendingAddress && document.activeElement !== addressInput) {
      addressInput.value = currentState.url;
    }
    if (pendingAddress && currentState.url === pendingAddress) pendingAddress = '';
    updateBookmarkButton();
  }

  function navigate(value) {
    const url = normalizeUrl(value);
    if (!url) return;
    pendingAddress = url;
    addressInput.value = url;
    send('browser:navigate', url);
  }

  function syncBrowserBounds() {
    const rect = browserPlaceholder.getBoundingClientRect();
    send('browser:bounds', {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    });
  }

  backButton.addEventListener('click', () => {
    pendingAddress = '';
    send('browser:back');
  });
  forwardButton.addEventListener('click', () => {
    pendingAddress = '';
    send('browser:forward');
  });
  reloadButton.addEventListener('click', () => send('browser:reload'));
  hardReloadButton.addEventListener('click', () => send('browser:hard-reload'));
  homeButton.addEventListener('click', () => {
    pendingAddress = homeUrl;
    send('browser:home');
  });
  bookmarkButton.addEventListener('click', toggleBookmark);

  bookmarkDeleteButton.addEventListener('click', () => {
    if (contextBookmarkUrl) removeBookmark(contextBookmarkUrl);
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
    if (!pendingAddress && currentState.url) addressInput.value = currentState.url;
  });
  addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      isEditingAddress = false;
      navigate(addressInput.value);
      addressInput.blur();
      send('browser:focus-page');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      isEditingAddress = false;
      pendingAddress = '';
      addressInput.value = currentState.url || '';
      addressInput.blur();
      send('browser:focus-page');
    }
  });

  window.dkBrowser.on('browser:state', updateNavigationState);
  window.dkBrowser.on('browser:focus-address', () => {
    isEditingAddress = true;
    addressInput.focus();
    addressInput.select();
  });
  window.dkBrowser.on('browser:toggle-bookmark', toggleBookmark);

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      addressInput.focus();
      addressInput.select();
      return;
    }
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleBookmark();
      return;
    }
    if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') || (event.ctrlKey && event.key === 'F5')) {
      event.preventDefault();
      send('browser:hard-reload');
      return;
    }
    if ((event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'r') || event.key === 'F5') {
      event.preventDefault();
      send('browser:reload');
      return;
    }
    if (event.altKey && event.key === 'Home') {
      event.preventDefault();
      send('browser:home');
    }
  });

  window.addEventListener('mousedown', (event) => {
    if (!bookmarkContextMenu.hidden && !bookmarkContextMenu.contains(event.target)) hideBookmarkContextMenu();
  });
  window.addEventListener('blur', hideBookmarkContextMenu);
  window.addEventListener('resize', () => {
    hideBookmarkContextMenu();
    syncBrowserBounds();
  });

  if (window.ResizeObserver) {
    new ResizeObserver(syncBrowserBounds).observe(browserPlaceholder);
  }

  renderBookmarks();
  syncBrowserBounds();
})();
