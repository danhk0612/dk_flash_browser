'use strict';

(function () {
  const bookmarkBar = document.getElementById('bookmark-bar');
  if (!bookmarkBar || !window.dkBrowser) return;

  function visible(selector) {
    const element = document.querySelector(selector);
    return element && !element.hidden ? element : null;
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
    if (!dropdown && !context && !editor) return;

    // Anything that belongs to the bookmark bar UI remains interactive.
    if (bookmarkBar.contains(event.target)) return;
    if (dropdown && dropdown.contains(event.target)) return;
    if (context && context.contains(event.target)) return;
    if (editor && editor.contains(event.target)) return;

    // Tabs, toolbar/address bar and every other browser-chrome area close it.
    closeTransientPanels();
  }, true);

  window.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (closeTransientPanels()) event.preventDefault();
  }, true);

  // Page content is hosted in a BrowserView, so DOM mouse events above cannot
  // see page clicks. The main process forwards BrowserView focus separately.
  window.dkBrowser.on('browser:page-focus', function () {
    closeTransientPanels();
  });
})();
