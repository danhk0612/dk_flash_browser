'use strict';

(function () {
  const bookmarkBar = document.getElementById('bookmark-bar');
  const browserPlaceholder = document.getElementById('browser-placeholder');
  if (!bookmarkBar || !browserPlaceholder || !window.dkBrowser) return;

  const MENU_WIDTH = 296;
  const MENU_GAP = 4;
  const MAX_MENU_HEIGHT = 320;
  const EMPTY_MENU_HEIGHT = 58;
  const MENU_ITEM_HEIGHT = 32;
  const MENU_PADDING = 12;

  const layer = document.createElement('div');
  layer.className = 'chrome-bookmark-layer';
  bookmarkBar.parentNode.insertBefore(layer, browserPlaceholder);

  let store = loadStore();
  let menuChain = [];
  let rootAnchorX = 8;
  let contextAnchorX = 8;

  function loadStore() {
    let raw = null;
    try { raw = window.dkBrowser.loadBookmarks(); } catch (_error) {}
    if (raw && raw.version === 2 && Array.isArray(raw.items)) return raw;
    if (Array.isArray(raw)) return { version: 2, items: raw };
    return { version: 2, items: [] };
  }

  function saveStore() {
    try { window.dkBrowser.saveBookmarks(store); } catch (_error) {}
  }

  function refreshChrome() {
    window.setTimeout(function () { window.location.reload(); }, 0);
  }

  function syncBounds() {
    window.requestAnimationFrame(function () {
      const rect = browserPlaceholder.getBoundingClientRect();
      window.dkBrowser.send('browser:bounds', {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    });
  }

  function findNode(id, nodes, parent) {
    const list = nodes || store.items;
    for (let i = 0; i < list.length; i += 1) {
      const node = list[i];
      if (node.id === id) return { node: node, list: list, index: i, parent: parent || null };
      if (node.type === 'folder' && Array.isArray(node.children)) {
        const nested = findNode(id, node.children, node);
        if (nested) return nested;
      }
    }
    return null;
  }

  function containsId(folder, id) {
    if (!folder || folder.type !== 'folder' || !Array.isArray(folder.children)) return false;
    for (let i = 0; i < folder.children.length; i += 1) {
      const child = folder.children[i];
      if (child.id === id) return true;
      if (child.type === 'folder' && containsId(child, id)) return true;
    }
    return false;
  }

  function parentFolderId(id) {
    const found = findNode(id);
    return found && found.parent ? found.parent.id : null;
  }

  function removeNode(id) {
    const found = findNode(id);
    if (!found) return null;
    return found.list.splice(found.index, 1)[0] || null;
  }

  function moveNode(dragId, folderId, beforeId) {
    const source = findNode(dragId);
    if (!source || dragId === folderId || dragId === beforeId) return;

    let destination = store.items;
    if (folderId) {
      const target = findNode(folderId);
      if (!target || target.node.type !== 'folder') return;
      if (source.node.type === 'folder' && containsId(source.node, folderId)) return;
      destination = target.node.children;
    }

    const moving = source.list.splice(source.index, 1)[0];
    let index = destination.length;
    if (beforeId) {
      const foundIndex = destination.findIndex(function (entry) { return entry.id === beforeId; });
      if (foundIndex >= 0) index = foundIndex;
    }
    destination.splice(index, 0, moving);
    saveStore();
    refreshChrome();
  }

  function clampLeft(left, width) {
    return Math.max(4, Math.min(left, window.innerWidth - width - 4));
  }

  function setLayerHeight(height) {
    const value = Math.max(0, Math.min(Number(height) || 0, MAX_MENU_HEIGHT));
    if (value <= 0) {
      layer.classList.remove('open');
      layer.style.flexBasis = '0px';
      layer.style.height = '0px';
      layer.style.minHeight = '0px';
    } else {
      layer.classList.add('open');
      layer.style.flexBasis = value + 'px';
      layer.style.height = value + 'px';
      layer.style.minHeight = value + 'px';
    }
    syncBounds();
  }

  function openLayer(height) {
    setLayerHeight(height);
  }

  function closeLayer() {
    menuChain = [];
    layer.textContent = '';
    setLayerHeight(0);
  }

  function folderMenuHeight(folder) {
    const count = folder && Array.isArray(folder.children) ? folder.children.length : 0;
    if (!count) return EMPTY_MENU_HEIGHT;
    return Math.min(MAX_MENU_HEIGHT, MENU_PADDING + count * MENU_ITEM_HEIGHT + 2);
  }

  function contextMenuHeight(itemCount, separatorCount) {
    return Math.min(MAX_MENU_HEIGHT, MENU_PADDING + itemCount * MENU_ITEM_HEIGHT + separatorCount * 11 + 2);
  }

  function faviconFor(node) {
    if (node.favicon) return node.favicon;
    try {
      const u = new URL(node.url);
      return u.origin + '/favicon.ico';
    } catch (_error) {
      return '';
    }
  }

  function makeBookmarkIcon(node) {
    const img = document.createElement('img');
    img.className = 'chrome-bookmark-menu-icon';
    img.alt = '';
    img.draggable = false;
    const src = faviconFor(node);
    if (src) img.src = src;
    img.onerror = function () { img.style.visibility = 'hidden'; };
    return img;
  }

  function makeFolderIcon() {
    const icon = document.createElement('span');
    icon.className = 'chrome-bookmark-folder-icon';
    icon.textContent = '▭';
    return icon;
  }

  function setDrag(item, node, parentId) {
    item.draggable = true;
    item.addEventListener('dragstart', function (event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', function () { item.classList.remove('dragging'); });
    item.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.stopPropagation();
      item.classList.add('drag-over');
      event.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('dragleave', function () { item.classList.remove('drag-over'); });
    item.addEventListener('drop', function (event) {
      event.preventDefault();
      event.stopPropagation();
      item.classList.remove('drag-over');
      const dragId = event.dataTransfer.getData('text/plain');
      if (!dragId || dragId === node.id) return;
      if (node.type === 'folder') moveNode(dragId, node.id, null);
      else moveNode(dragId, parentId || null, node.id);
    });
  }

  function menuLeftForDepth(depth) {
    let left = rootAnchorX + depth * (MENU_WIDTH + MENU_GAP);
    if (left + MENU_WIDTH > window.innerWidth - 4) {
      left = rootAnchorX - depth * (MENU_WIDTH + MENU_GAP);
    }
    return clampLeft(left, MENU_WIDTH);
  }

  function renderFolderMenus() {
    layer.textContent = '';
    let neededHeight = EMPTY_MENU_HEIGHT;

    for (let depth = 0; depth < menuChain.length; depth += 1) {
      const folderId = menuChain[depth];
      const found = findNode(folderId);
      if (!found || found.node.type !== 'folder') continue;
      const folder = found.node;
      neededHeight = Math.max(neededHeight, folderMenuHeight(folder));

      const menu = document.createElement('div');
      menu.className = 'chrome-bookmark-menu';
      menu.style.left = menuLeftForDepth(depth) + 'px';
      menu.style.maxHeight = Math.max(44, neededHeight - 6) + 'px';

      const children = Array.isArray(folder.children) ? folder.children : [];
      if (!children.length) {
        const empty = document.createElement('div');
        empty.className = 'chrome-bookmark-menu-empty';
        empty.textContent = '빈 폴더';
        menu.appendChild(empty);
      }

      children.forEach(function (node) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'chrome-bookmark-menu-item';
        item.appendChild(node.type === 'folder' ? makeFolderIcon() : makeBookmarkIcon(node));

        const title = document.createElement('span');
        title.className = 'chrome-bookmark-menu-title';
        title.textContent = node.title || node.url || '북마크';
        item.appendChild(title);

        if (node.type === 'folder') {
          const arrow = document.createElement('span');
          arrow.className = 'chrome-bookmark-submenu-arrow';
          arrow.textContent = '›';
          item.appendChild(arrow);
          if (menuChain[depth + 1] === node.id) item.classList.add('submenu-open');
          item.addEventListener('mouseenter', function () {
            menuChain = menuChain.slice(0, depth + 1).concat(node.id);
            renderFolderMenus();
          });
          item.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            menuChain = menuChain.slice(0, depth + 1).concat(node.id);
            renderFolderMenus();
          });
        } else {
          item.addEventListener('mouseenter', function () {
            if (menuChain.length > depth + 1) {
              menuChain = menuChain.slice(0, depth + 1);
              renderFolderMenus();
            }
          });
          item.addEventListener('click', function () {
            closeLayer();
            window.dkBrowser.send('browser:navigate', node.url);
          });
        }

        item.addEventListener('contextmenu', function (event) {
          event.preventDefault();
          event.stopPropagation();
          showContextMenu(node.id, event.clientX);
        });
        setDrag(item, node, folder.id);
        menu.appendChild(item);
      });

      menu.addEventListener('dragover', function (event) {
        if (event.target !== menu) return;
        event.preventDefault();
        menu.classList.add('drag-over-container');
      });
      menu.addEventListener('drop', function (event) {
        if (event.target !== menu) return;
        event.preventDefault();
        const dragId = event.dataTransfer.getData('text/plain');
        if (dragId) moveNode(dragId, folder.id, null);
      });
      menu.addEventListener('contextmenu', function (event) {
        if (event.target !== menu) return;
        event.preventDefault();
        event.stopPropagation();
        showContextMenu(folder.id, event.clientX, true);
      });
      layer.appendChild(menu);
    }

    openLayer(neededHeight);
  }

  function contextItem(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chrome-bookmark-menu-item';
    const spacer = document.createElement('span');
    spacer.className = 'chrome-bookmark-folder-icon';
    spacer.textContent = '';
    button.appendChild(spacer);
    const title = document.createElement('span');
    title.className = 'chrome-bookmark-menu-title';
    title.textContent = label;
    button.appendChild(title);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function addSeparator(menu) {
    const sep = document.createElement('div');
    sep.className = 'chrome-bookmark-menu-separator';
    menu.appendChild(sep);
  }

  function showContextMenu(id, x, emptyFolder) {
    layer.textContent = '';
    contextAnchorX = clampLeft(Number(x) || 8, MENU_WIDTH);
    const menu = document.createElement('div');
    menu.className = 'chrome-bookmark-menu';
    menu.style.left = contextAnchorX + 'px';
    const found = id ? findNode(id) : null;
    const node = found ? found.node : null;
    let itemCount = 0;
    let separatorCount = 0;

    function addItem(label, fn) {
      menu.appendChild(contextItem(label, fn));
      itemCount += 1;
    }
    function sep() {
      addSeparator(menu);
      separatorCount += 1;
    }

    if (node && node.type === 'bookmark') {
      addItem('탭에서 열기', function () {
        closeLayer();
        window.dkBrowser.send('browser:navigate', node.url);
      });
      addItem('새 탭에서 열기', function () {
        closeLayer();
        window.dkBrowser.send('browser:new-tab', node.url);
      });
      sep();
      addItem('수정…', function () { showEditor('edit', node.id); });
      addItem('새 폴더…', function () { showEditor('folder', parentFolderId(node.id)); });
      sep();
      addItem('삭제', function () { showDelete(node.id); });
    } else if (node && node.type === 'folder' && !emptyFolder) {
      addItem('열기', function () {
        menuChain = [node.id];
        rootAnchorX = contextAnchorX;
        renderFolderMenus();
      });
      sep();
      addItem('수정…', function () { showEditor('edit', node.id); });
      addItem('새 폴더…', function () { showEditor('folder', node.id); });
      sep();
      addItem('삭제', function () { showDelete(node.id); });
    } else {
      const parentId = node && node.type === 'folder' ? node.id : null;
      addItem('새 폴더…', function () { showEditor('folder', parentId); });
    }

    layer.appendChild(menu);
    openLayer(contextMenuHeight(itemCount, separatorCount));
  }

  function editorButton(label, primary, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chrome-bookmark-editor-button' + (primary ? ' primary' : '');
    button.textContent = label;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function showEditor(mode, id) {
    const found = mode === 'edit' ? findNode(id) : null;
    const node = found ? found.node : null;
    layer.textContent = '';
    const editor = document.createElement('div');
    editor.className = 'chrome-bookmark-editor';
    editor.style.left = clampLeft(contextAnchorX || rootAnchorX || 8, 390) + 'px';

    const heading = document.createElement('div');
    heading.className = 'chrome-bookmark-editor-title';
    heading.textContent = mode === 'folder' ? '새 폴더' : (node && node.type === 'folder' ? '폴더 수정' : '북마크 수정');
    editor.appendChild(heading);

    const nameLabel = document.createElement('label');
    nameLabel.className = 'chrome-bookmark-editor-label';
    nameLabel.textContent = '이름';
    editor.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.className = 'chrome-bookmark-editor-input';
    nameInput.value = mode === 'folder' ? '새 폴더' : (node ? (node.title || '') : '');
    editor.appendChild(nameInput);

    let urlInput = null;
    if (node && node.type === 'bookmark') {
      const urlLabel = document.createElement('label');
      urlLabel.className = 'chrome-bookmark-editor-label';
      urlLabel.textContent = 'URL';
      editor.appendChild(urlLabel);
      urlInput = document.createElement('input');
      urlInput.className = 'chrome-bookmark-editor-input';
      urlInput.value = node.url || '';
      editor.appendChild(urlInput);
    }

    const actions = document.createElement('div');
    actions.className = 'chrome-bookmark-editor-actions';
    const save = editorButton('저장', true, function () {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (mode === 'folder') {
        const folder = { id: 'f-' + Date.now().toString(36), type: 'folder', title: name, children: [] };
        if (id) {
          const parent = findNode(id);
          if (parent && parent.node.type === 'folder') parent.node.children.push(folder);
          else store.items.push(folder);
        } else {
          store.items.push(folder);
        }
      } else if (node) {
        node.title = name;
        if (urlInput) {
          let value = urlInput.value.trim();
          if (value && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) value = 'http://' + value;
          if (!value) { urlInput.focus(); return; }
          node.url = value;
        }
      }
      saveStore();
      refreshChrome();
    });
    actions.appendChild(save);
    actions.appendChild(editorButton('취소', false, closeLayer));
    editor.appendChild(actions);
    layer.appendChild(editor);

    openLayer(node && node.type === 'bookmark' ? 205 : 158);

    function keyHandler(event) {
      if (event.key === 'Enter') { event.preventDefault(); save.click(); }
      if (event.key === 'Escape') { event.preventDefault(); closeLayer(); }
    }
    nameInput.addEventListener('keydown', keyHandler);
    if (urlInput) urlInput.addEventListener('keydown', keyHandler);
    window.requestAnimationFrame(function () { nameInput.focus(); nameInput.select(); });
  }

  function showDelete(id) {
    const found = findNode(id);
    if (!found) return;
    const node = found.node;
    layer.textContent = '';
    const editor = document.createElement('div');
    editor.className = 'chrome-bookmark-editor';
    editor.style.left = clampLeft(contextAnchorX || rootAnchorX || 8, 390) + 'px';
    const title = document.createElement('div');
    title.className = 'chrome-bookmark-editor-title';
    title.textContent = '삭제 확인';
    editor.appendChild(title);
    const message = document.createElement('div');
    message.className = 'chrome-bookmark-editor-message';
    message.textContent = node.type === 'folder'
      ? '“' + node.title + '” 폴더와 그 안의 북마크를 모두 삭제할까요?'
      : '“' + node.title + '” 북마크를 삭제할까요?';
    editor.appendChild(message);
    const actions = document.createElement('div');
    actions.className = 'chrome-bookmark-editor-actions';
    actions.appendChild(editorButton('삭제', true, function () {
      removeNode(id);
      saveStore();
      refreshChrome();
    }));
    actions.appendChild(editorButton('취소', false, closeLayer));
    editor.appendChild(actions);
    layer.appendChild(editor);
    openLayer(138);
  }

  bookmarkBar.addEventListener('click', function (event) {
    const folder = event.target.closest('.bookmark-item.bookmark-folder');
    if (!folder || !bookmarkBar.contains(folder)) {
      if (layer.classList.contains('open')) closeLayer();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = folder.dataset.bookmarkId;
    if (!id) return;

    if (menuChain.length === 1 && menuChain[0] === id && layer.classList.contains('open')) {
      closeLayer();
      return;
    }

    const barRect = bookmarkBar.getBoundingClientRect();
    const itemRect = folder.getBoundingClientRect();
    rootAnchorX = clampLeft(itemRect.left - barRect.left + 8, MENU_WIDTH);
    contextAnchorX = rootAnchorX;
    menuChain = [id];
    renderFolderMenus();
  }, true);

  bookmarkBar.addEventListener('contextmenu', function (event) {
    const item = event.target.closest('.bookmark-item');
    event.preventDefault();
    event.stopImmediatePropagation();
    if (item && bookmarkBar.contains(item)) {
      showContextMenu(item.dataset.bookmarkId || null, event.clientX);
    } else {
      showContextMenu(null, event.clientX);
    }
  }, true);

  layer.addEventListener('mousedown', function (event) {
    if (event.target === layer) {
      event.preventDefault();
      event.stopPropagation();
      closeLayer();
    }
  }, true);

  document.addEventListener('mousedown', function (event) {
    if (!layer.classList.contains('open')) return;
    if (bookmarkBar.contains(event.target)) return;
    if (layer.contains(event.target) && event.target !== layer) return;
    closeLayer();
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && layer.classList.contains('open')) {
      event.preventDefault();
      closeLayer();
    }
  }, true);

  window.dkBrowser.on('browser:close-bookmark-menus', function () {
    if (layer.classList.contains('open')) closeLayer();
  });

  window.addEventListener('resize', function () {
    if (layer.classList.contains('open')) closeLayer();
  });
})();