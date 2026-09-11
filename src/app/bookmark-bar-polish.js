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
    return false;
  }

  function closeTransientPanels() {
    closeContextPanel();
    closeFolderDropdown();
  }

  document.addEventListener('mousedown', function (event) {
    const dropdown = visible('.bookmark-dropdown');
    const context = visible('.bookmark-context-panel');
    const editor = visible('.bookmark-editor-panel');
    if (!dropdown && !context) return;
    if (bookmarkBar.contains(event.target)) return;
    if (dropdown && dropdown.contains(event.target)) return;
    if (context && context.contains(event.target)) return;
    if (editor && editor.contains(event.target)) return;
    closeTransientPanels();
  }, true);

  window.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (visible('.bookmark-editor-panel')) return;
    if (closeContextPanel() || closeFolderDropdown()) event.preventDefault();
  }, true);

  window.dkBrowser.on('browser:page-focus', function () {
    if (visible('.bookmark-editor-panel')) return;
    closeTransientPanels();
  });
})();
