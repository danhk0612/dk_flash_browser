'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  const homeUrl = params.get('startUrl') || 'about:blank';
  const bookmarkStorageKey = 'dkFlashBrowser.bookmarks.v1';
  const preferredTabWidth = 180;
  const minimumTabWidth = 36;
  const iconOnlyThreshold = 72;
  const tabGap = 2;
  const newTabReservedWidth = 41;

  const tabList = document.getElementById('tab-list');
  const newTabButton = document.getElementById('new-tab-button');
  const backButton = document.getElementById('back-button');
  const forwardButton = document.getElementById('forward-button');
  const reloadButton = document.getElementById('reload-button');
  const hardReloadButton = document.getElementById('hard-reload-button');
  const homeButton = document.getElementById('home-button');
  const bookmarkButton = document.getElementById('bookmark-button');
  const addressInput = document.getElementById('address-input');
  const addressFavicon = document.getElementById('address-favicon');
  const bookmarkBar = document.getElementById('bookmark-bar');
  const browserPlaceholder = document.getElementById('browser-placeholder');

  let currentState = { id: null, url: '', title: '', canGoBack: false, canGoForward: false, isLoading: false };
  let tabState = { activeTabId: null, tabs: [] };
  let isEditingAddress = false;
  const faviconCache = Object.create(null);
  let bookmarkData = { version: 2, items: [] };
  let openFolderId = null;
  let contextTargetId = null;
  let idCounter = 0;

  const bookmarkDropdown = document.createElement('div');
  bookmarkDropdown.className = 'bookmark-dropdown';
  bookmarkDropdown.hidden = true;
  bookmarkBar.parentNode.insertBefore(bookmarkDropdown, browserPlaceholder);

  const bookmarkContextPanel = document.createElement('div');
  bookmarkContextPanel.className = 'bookmark-context-panel';
  bookmarkContextPanel.hidden = true;
  bookmarkBar.parentNode.insertBefore(bookmarkContextPanel, browserPlaceholder);

  function send(channel, payload) {
    window.dkBrowser.send(channel, payload);
  }

  function normalizeUrl(value) {
    const input = String(value || '').trim();
    if (!input) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) return input;
    return 'http://' + input;
  }

  function newNodeId(prefix) {
    idCounter += 1;
    return String(prefix || 'n') + '-' + Date.now().toString(36) + '-' + idCounter.toString(36);
  }

  function urlOrigin(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.origin;
    } catch (_error) {
      return '';
    }
  }

  function fallbackFaviconUrl(url) {
    const origin = urlOrigin(url);
    return origin ? origin + '/favicon.ico' : '';
  }

  function cacheFavicon(pageUrl, favicon) {
    if (!pageUrl || !favicon) return;
    faviconCache[pageUrl] = favicon;
    const origin = urlOrigin(pageUrl);
    if (origin) faviconCache[origin] = favicon;
  }

  function faviconForUrl(url) {
    if (!url) return '';
    const origin = urlOrigin(url);
    return faviconCache[url] || (origin ? faviconCache[origin] : '') || fallbackFaviconUrl(url);
  }

  function setImageSource(image, pageUrl, preferredFavicon) {
    const src = preferredFavicon || faviconForUrl(pageUrl);
    image.style.display = 'none';
    image.removeAttribute('src');
    if (!src) return;
    image.onload = function () { image.style.display = 'block'; };
    image.onerror = function () {
      if (src !== fallbackFaviconUrl(pageUrl)) {
        const fallback = fallbackFaviconUrl(pageUrl);
        if (fallback) {
          image.onload = function () { image.style.display = 'block'; };
          image.onerror = function () {
            image.style.display = 'none';
            image.removeAttribute('src');
          };
          image.src = fallback;
          return;
        }
      }
      image.style.display = 'none';
      image.removeAttribute('src');
    };
    image.src = src;
  }

  function normalizeBookmarkNode(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.type === 'folder' || Array.isArray(raw.children)) {
      return {
        id: raw.id || newNodeId('f'),
        type: 'folder',
        title: String(raw.title || '새 폴더'),
        children: (Array.isArray(raw.children) ? raw.children : []).map(normalizeBookmarkNode).filter(Boolean)
      };
    }
    if (!raw.url) return null;
    return {
      id: raw.id || newNodeId('b'),
      type: 'bookmark',
      title: String(raw.title || raw.url),
      url: String(raw.url),
      favicon: String(raw.favicon || '')
    };
  }

  function readLegacyBookmarks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(bookmarkStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function normalizeBookmarkStore(stored) {
    let source = [];
    if (Array.isArray(stored)) source = stored;
    else if (stored && stored.version === 2 && Array.isArray(stored.items)) source = stored.items;
    return { version: 2, items: source.map(normalizeBookmarkNode).filter(Boolean) };
  }

  function initializeBookmarks() {
    let stored = null;
    try { stored = window.dkBrowser.loadBookmarks(); } catch (_error) {}
    bookmarkData = normalizeBookmarkStore(stored);

    if (!bookmarkData.items.length) {
      const legacy = readLegacyBookmarks();
      if (legacy.length) bookmarkData = normalizeBookmarkStore(legacy);
    }
    saveBookmarkData(false);
  }

  function saveBookmarkData(render) {
    try { window.dkBrowser.saveBookmarks(bookmarkData); } catch (_error) {}
    try { localStorage.setItem(bookmarkStorageKey, JSON.stringify(bookmarkData)); } catch (_error) {}
    if (render !== false) {
      renderBookmarks();
      renderBookmarkDropdown();
      updateBookmarkButton();
    }
  }

  function findNode(id, nodes, parentFolder) {
    const list = nodes || bookmarkData.items;
    for (let index = 0; index < list.length; index += 1) {
      const node = list[index];
      if (node.id === id) return { node, list, index, parentFolder: parentFolder || null };
      if (node.type === 'folder') {
        const nested = findNode(id, node.children, node);
        if (nested) return nested;
      }
    }
    return null;
  }

  function findBookmarkByUrl(url, nodes) {
    const list = nodes || bookmarkData.items;
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (node.type === 'bookmark' && node.url === url) return node;
      if (node.type === 'folder') {
        const nested = findBookmarkByUrl(url, node.children);
        if (nested) return nested;
      }
    }
    return null;
  }

  function findFolderPath(id, nodes, path) {
    const list = nodes || bookmarkData.items;
    const currentPath = path || [];
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (node.type !== 'folder') continue;
      const nextPath = currentPath.concat(node);
      if (node.id === id) return nextPath;
      const nested = findFolderPath(id, node.children, nextPath);
      if (nested) return nested;
    }
    return null;
  }

  function folderContainsId(folder, id) {
    if (!folder || folder.type !== 'folder') return false;
    for (let i = 0; i < folder.children.length; i += 1) {
      const child = folder.children[i];
      if (child.id === id) return true;
      if (child.type === 'folder' && folderContainsId(child, id)) return true;
    }
    return false;
  }

  function removeNodeById(id) {
    const found = findNode(id);
    if (!found) return null;
    return found.list.splice(found.index, 1)[0] || null;
  }

  function moveNode(dragId, targetFolderId, beforeId) {
    if (!dragId || dragId === beforeId || dragId === targetFolderId) return;
    const source = findNode(dragId);
    if (!source) return;

    let destination = bookmarkData.items;
    if (targetFolderId) {
      const targetFolder = findNode(targetFolderId);
      if (!targetFolder || targetFolder.node.type !== 'folder') return;
      if (source.node.type === 'folder' && folderContainsId(source.node, targetFolderId)) return;
      destination = targetFolder.node.children;
    }

    const moving = source.list.splice(source.index, 1)[0];
    let insertAt = destination.length;
    if (beforeId) {
      const beforeIndex = destination.findIndex((item) => item.id === beforeId);
      if (beforeIndex >= 0) insertAt = beforeIndex;
    }
    destination.splice(insertAt, 0, moving);
    saveBookmarkData(true);
  }

  function parentFolderIdOf(id) {
    const found = findNode(id);
    return found && found.parentFolder ? found.parentFolder.id : null;
  }

  function createFolder(parentFolderId) {
    const title = window.prompt('폴더 이름', '새 폴더');
    if (title === null) return;
    const folder = { id: newNodeId('f'), type: 'folder', title: String(title || '새 폴더').trim() || '새 폴더', children: [] };
    if (parentFolderId) {
      const parent = findNode(parentFolderId);
      if (parent && parent.node.type === 'folder') parent.node.children.push(folder);
      else bookmarkData.items.push(folder);
    } else {
      bookmarkData.items.push(folder);
    }
    saveBookmarkData(true);
  }

  function editNode(id) {
    const found = findNode(id);
    if (!found) return;
    const node = found.node;
    const title = window.prompt(node.type === 'folder' ? '폴더 이름' : '북마크 이름', node.title || '');
    if (title === null) return;
    node.title = String(title || '').trim() || (node.type === 'folder' ? '새 폴더' : node.url);
    if (node.type === 'bookmark') {
      const url = window.prompt('주소', node.url || '');
      if (url === null) return;
      const normalized = normalizeUrl(url);
      if (normalized) node.url = normalized;
    }
    saveBookmarkData(true);
  }

  function deleteNode(id) {
    const found = findNode(id);
    if (!found) return;
    const node = found.node;
    const message = node.type === 'folder'
      ? '폴더 "' + node.title + '"와 하위 북마크를 모두 삭제할까요?'
      : '북마크 "' + node.title + '"을 삭제할까요?';
    if (!window.confirm(message)) return;
    removeNodeById(id);
    if (openFolderId && (!findNode(openFolderId) || openFolderId === id)) openFolderId = null;
    saveBookmarkData(true);
  }

  function updateBookmarkButton() {
    const exists = !!findBookmarkByUrl(currentState.url);
    bookmarkButton.textContent = exists ? '★' : '☆';
    bookmarkButton.title = exists ? '북마크 제거 (Ctrl+D)' : '북마크 추가 (Ctrl+D)';
  }

  function setDragHandlers(element, node, parentFolderId) {
    element.draggable = true;
    element.dataset.bookmarkId = node.id;
    element.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
      element.classList.add('dragging');
    });
    element.addEventListener('dragend', () => element.classList.remove('dragging'));
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      element.classList.add('drag-over');
    });
    element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove('drag-over');
      const dragId = event.dataTransfer.getData('text/plain');
      if (!dragId || dragId === node.id) return;
      if (node.type === 'folder' && event.offsetX > 12) moveNode(dragId, node.id, null);
      else moveNode(dragId, parentFolderId, node.id);
    });
  }

  function createBookmarkElement(node, parentFolderId, compact) {
    const item = document.createElement('button');
    item.className = 'bookmark-item' + (node.type === 'folder' ? ' bookmark-folder' : '');
    item.type = 'button';
    item.title = node.type === 'folder' ? node.title : node.url;

    if (node.type === 'folder') {
      const folderIcon = document.createElement('span');
      folderIcon.className = 'bookmark-folder-icon';
      folderIcon.textContent = '▸';
      const title = document.createElement('span');
      title.className = 'bookmark-title';
      title.textContent = node.title;
      item.appendChild(folderIcon);
      item.appendChild(title);
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        openFolderId = node.id;
        hideContextPanel();
        renderBookmarkDropdown();
      });
    } else {
      const icon = document.createElement('img');
      icon.className = 'bookmark-favicon';
      icon.alt = '';
      icon.draggable = false;
      setImageSource(icon, node.url, node.favicon || '');
      const title = document.createElement('span');
      title.className = 'bookmark-title';
      title.textContent = node.title || node.url;
      item.appendChild(icon);
      item.appendChild(title);
      item.addEventListener('click', () => navigate(node.url));
    }

    if (compact) item.classList.add('dropdown-bookmark-item');
    setDragHandlers(item, node, parentFolderId);
    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showContextPanel(node.id);
    });
    return item;
  }

  function addDropToContainer(container, folderId) {
    container.addEventListener('dragover', (event) => {
      if (event.target !== container) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      container.classList.add('drag-over-container');
    });
    container.addEventListener('dragleave', (event) => {
      if (event.target === container) container.classList.remove('drag-over-container');
    });
    container.addEventListener('drop', (event) => {
      if (event.target !== container) return;
      event.preventDefault();
      container.classList.remove('drag-over-container');
      const dragId = event.dataTransfer.getData('text/plain');
      if (dragId) moveNode(dragId, folderId || null, null);
    });
  }

  function renderBookmarks() {
    bookmarkBar.textContent = '';
    bookmarkData.items.forEach((node) => bookmarkBar.appendChild(createBookmarkElement(node, null, false)));
    addDropToContainer(bookmarkBar, null);
    bookmarkBar.oncontextmenu = function (event) {
      if (event.target !== bookmarkBar) return;
      event.preventDefault();
      showContextPanel(null);
    };
  }

  function renderBookmarkDropdown() {
    bookmarkDropdown.textContent = '';
    const found = openFolderId ? findNode(openFolderId) : null;
    if (!found || found.node.type !== 'folder') {
      bookmarkDropdown.hidden = true;
      openFolderId = null;
      syncBrowserBoundsSoon();
      return;
    }

    bookmarkDropdown.hidden = false;
    const path = findFolderPath(openFolderId) || [found.node];
    const header = document.createElement('div');
    header.className = 'bookmark-dropdown-header';

    const rootButton = document.createElement('button');
    rootButton.type = 'button';
    rootButton.className = 'bookmark-path-button';
    rootButton.textContent = '북마크';
    rootButton.addEventListener('click', () => { openFolderId = null; renderBookmarkDropdown(); });
    header.appendChild(rootButton);

    path.forEach((folder, index) => {
      const separator = document.createElement('span');
      separator.className = 'bookmark-path-separator';
      separator.textContent = '›';
      header.appendChild(separator);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bookmark-path-button';
      button.textContent = folder.title;
      if (index === path.length - 1) button.classList.add('current');
      button.addEventListener('click', () => { openFolderId = folder.id; renderBookmarkDropdown(); });
      header.appendChild(button);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bookmark-dropdown-close';
    close.textContent = '×';
    close.title = '폴더 닫기';
    close.addEventListener('click', () => { openFolderId = null; renderBookmarkDropdown(); });
    header.appendChild(close);
    bookmarkDropdown.appendChild(header);

    const list = document.createElement('div');
    list.className = 'bookmark-dropdown-list';
    found.node.children.forEach((node) => list.appendChild(createBookmarkElement(node, found.node.id, true)));
    if (!found.node.children.length) {
      const empty = document.createElement('div');
      empty.className = 'bookmark-folder-empty';
      empty.textContent = '빈 폴더 — 여기에 북마크를 드래그하거나 우클릭해 새 폴더를 만들 수 있습니다.';
      list.appendChild(empty);
    }
    addDropToContainer(list, found.node.id);
    list.oncontextmenu = function (event) {
      if (event.target !== list && !event.target.classList.contains('bookmark-folder-empty')) return;
      event.preventDefault();
      showContextPanel(found.node.id, true);
    };
    bookmarkDropdown.appendChild(list);
    syncBrowserBoundsSoon();
  }

  function hideContextPanel() {
    bookmarkContextPanel.hidden = true;
    bookmarkContextPanel.textContent = '';
    contextTargetId = null;
    syncBrowserBoundsSoon();
  }

  function contextButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bookmark-context-button';
    button.textContent = label;
    button.addEventListener('click', () => {
      hideContextPanel();
      handler();
    });
    return button;
  }

  function showContextPanel(id, emptyFolderArea) {
    contextTargetId = id || null;
    bookmarkContextPanel.textContent = '';
    bookmarkContextPanel.hidden = false;
    const found = id ? findNode(id) : null;
    const node = found ? found.node : null;

    if (node && node.type === 'bookmark') {
      bookmarkContextPanel.appendChild(contextButton('열기', () => navigate(node.url)));
      bookmarkContextPanel.appendChild(contextButton('새 탭에서 열기', () => send('browser:new-tab', node.url)));
      bookmarkContextPanel.appendChild(contextButton('수정…', () => editNode(node.id)));
      bookmarkContextPanel.appendChild(contextButton('새 폴더…', () => createFolder(parentFolderIdOf(node.id))));
      bookmarkContextPanel.appendChild(contextButton('삭제', () => deleteNode(node.id)));
    } else if (node && node.type === 'folder' && !emptyFolderArea) {
      bookmarkContextPanel.appendChild(contextButton('열기', () => { openFolderId = node.id; renderBookmarkDropdown(); }));
      bookmarkContextPanel.appendChild(contextButton('수정…', () => editNode(node.id)));
      bookmarkContextPanel.appendChild(contextButton('하위 폴더 만들기…', () => createFolder(node.id)));
      bookmarkContextPanel.appendChild(contextButton('삭제', () => deleteNode(node.id)));
    } else {
      const parentFolderId = node && node.type === 'folder' ? node.id : null;
      bookmarkContextPanel.appendChild(contextButton('새 폴더…', () => createFolder(parentFolderId)));
    }

    bookmarkContextPanel.appendChild(contextButton('닫기', hideContextPanel));
    syncBrowserBoundsSoon();
  }

  function toggleBookmark() {
    const url = currentState.url;
    if (!url || url === 'about:blank') return;
    const existing = findBookmarkByUrl(url);
    if (existing) removeNodeById(existing.id);
    else bookmarkData.items.push({
      id: newNodeId('b'),
      type: 'bookmark',
      url,
      title: currentState.title || url,
      favicon: faviconForUrl(url)
    });
    saveBookmarkData(true);
  }

  function updateFaviconsInNodes(nodes, payload) {
    let changed = false;
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        if (updateFaviconsInNodes(node.children, payload)) changed = true;
      } else if (node.url === payload.url || urlOrigin(node.url) === urlOrigin(payload.url)) {
        if (node.favicon !== payload.favicon) {
          node.favicon = payload.favicon;
          changed = true;
        }
      }
    });
    return changed;
  }

  function ensureActiveTabVisible() {
    const active = tabList.querySelector('.tab-item.active');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function layoutTabs() {
    const items = Array.prototype.slice.call(tabList.querySelectorAll('.tab-item'));
    const count = items.length;
    if (!count) return;
    const available = Math.max(0, tabList.clientWidth - newTabReservedWidth - (count * tabGap));
    let width = Math.floor(available / count);
    width = Math.min(preferredTabWidth, width);
    if (width < minimumTabWidth) width = minimumTabWidth;
    const iconOnly = width <= iconOnlyThreshold;
    items.forEach((item) => {
      item.style.flexBasis = width + 'px';
      item.style.width = width + 'px';
      item.classList.toggle('icon-only', iconOnly);
    });
  }

  function renderTabs(state) {
    tabState = state || { activeTabId: null, tabs: [] };
    tabList.textContent = '';
    tabState.tabs.forEach((tab) => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === tabState.activeTabId ? ' active' : '');
      item.title = tab.title || tab.url || '새 탭';

      const icon = document.createElement('img');
      icon.className = 'tab-favicon';
      icon.alt = '';
      icon.draggable = false;
      setImageSource(icon, tab.url);

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
      item.appendChild(icon);
      item.appendChild(title);
      item.appendChild(close);
      tabList.appendChild(item);
    });
    tabList.appendChild(newTabButton);
    window.requestAnimationFrame(() => { layoutTabs(); ensureActiveTabVisible(); });
  }

  function updateNavigationState(state) {
    currentState = Object.assign({}, currentState, state || {});
    backButton.disabled = !currentState.canGoBack;
    forwardButton.disabled = !currentState.canGoForward;
    if (currentState.url && !isEditingAddress && document.activeElement !== addressInput) addressInput.value = currentState.url;
    setImageSource(addressFavicon, currentState.url);
    updateBookmarkButton();
  }

  function handleFavicon(payload) {
    if (!payload || !payload.url || !payload.favicon) return;
    cacheFavicon(payload.url, payload.favicon);
    if (currentState.url && (currentState.url === payload.url || urlOrigin(currentState.url) === urlOrigin(payload.url))) {
      setImageSource(addressFavicon, currentState.url, payload.favicon);
    }
    if (updateFaviconsInNodes(bookmarkData.items, payload)) saveBookmarkData(false);
    renderTabs(tabState);
    renderBookmarks();
    renderBookmarkDropdown();
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

  function syncBrowserBoundsSoon() {
    window.requestAnimationFrame(syncBrowserBounds);
  }

  newTabButton.addEventListener('click', () => send('browser:new-tab', homeUrl));
  tabList.addEventListener('wheel', (event) => {
    if (tabList.scrollWidth <= tabList.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    tabList.scrollLeft += delta;
  }, { passive: false });

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
  window.dkBrowser.on('browser:favicon', handleFavicon);
  window.dkBrowser.on('browser:focus-address', () => {
    isEditingAddress = true;
    addressInput.focus();
    addressInput.select();
  });
  window.dkBrowser.on('browser:toggle-bookmark', toggleBookmark);
  window.dkBrowser.on('browser:delete-bookmark', (url) => {
    const bookmark = findBookmarkByUrl(url);
    if (bookmark) deleteNode(bookmark.id);
  });
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

  window.addEventListener('resize', () => {
    syncBrowserBounds();
    window.requestAnimationFrame(() => { layoutTabs(); ensureActiveTabVisible(); });
  });
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      syncBrowserBounds();
      layoutTabs();
    }).observe(browserPlaceholder);
  }

  document.addEventListener('click', (event) => {
    if (!bookmarkContextPanel.hidden && !bookmarkContextPanel.contains(event.target)) hideContextPanel();
  });

  initializeBookmarks();
  renderBookmarks();
  renderBookmarkDropdown();
  syncBrowserBounds();
})();
