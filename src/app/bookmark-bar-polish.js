'use strict';

(function () {
  const bookmarkBar = document.getElementById('bookmark-bar');
  if (!bookmarkBar || !window.dkBrowser) return;

  function visible(selector) {
    const element = document.querySelector(selector);
    return element && !element.hidden ? element : null;
  }

  function focusBrowserChrome() {
    // Ask the main process to focus the browser chrome webContents explicitly.
    // Do not use window blur as a close trigger: opening/editing bookmark UI can
    // legitimately move focus inside the chrome renderer and would otherwise
    // close the newly opened panel immediately.
    try { window.dkBrowser.send('browser:focus-chrome'); } catch (_error) {}
    try { window.focus(); } catch (_error) {}
  }

  function closeFolderDropdown() {
    const dropdown = visible('.bookmark-dropdown');
    if (!dropdown) return false;
    const close = dropdown.querySelector('.bookmark-dropdown-close');
    if (close) {
      close.click();
      return true;
    }
    dropdown.hidden = true;
    return true;
  }

  function closeContextPanel() {
    const panel = visible('.bookmark-context-panel');
    if (!panel) return false;
    const buttons = panel.querySelectorAll('.bookmark-context-button');
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      if (String(buttons[i].textContent || '').trim() === '닫기') {
        buttons[i].click();
        return true;
      }
    }
    panel.hidden = true;
    return true;
  }

  function closeEditorPanel() {
    const panel = visible('.bookmark-editor-panel');
    if (!panel) return false;
    const buttons = panel.querySelectorAll('.bookmark-editor-button');
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      if (String(buttons[i].textContent || '').trim() === '취소') {
        buttons[i].click();
        return true;
      }
    }
    panel.hidden = true;
    return true;
  }

  function closeTransientPanels() {
    const editorClosed = closeEditorPanel();
    const contextClosed = closeContextPanel();
    const dropdownClosed = closeFolderDropdown();
    return editorClosed || contextClosed || dropdownClosed;
  }

  document.addEventListener('mousedown', function (event) {
    const dropdown = visible('.bookmark-dropdown');
    const context = visible('.bookmark-context-panel');
    const editor = visible('.bookmark-editor-panel');

    // Bookmark bar and every bookmark-related panel are one interaction region.
    // Clicking anywhere inside this region must not dismiss the UI.
    if (bookmarkBar.contains(event.target) ||
        (dropdown && dropdown.contains(event.target)) ||
        (context && context.contains(event.target)) ||
        (editor && editor.contains(event.target))) {
      focusBrowserChrome();
      return;
    }

    if (!dropdown && !context && !editor) return;
    closeTransientPanels();
  }, true);

  window.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (closeTransientPanels()) event.preventDefault();
  }, true);

  function handlePageFocus() {
    closeTransientPanels();
  }

  // Actual BrowserView page interaction is forwarded by the main process.
  // This is the only cross-surface close trigger; chrome blur itself is not.
  window.dkBrowser.on('browser:close-bookmark-menus', handlePageFocus);
  window.dkBrowser.on('browser:page-focus', handlePageFocus);
})();
