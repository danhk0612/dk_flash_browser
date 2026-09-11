'use strict';

const { ipcRenderer } = require('electron');

// BrowserView is a separate native surface, so clicks inside page content never
// reach the browser-chrome DOM. Forward only the fact that page content was
// pressed; do not alter the clicked element.
window.addEventListener('mousedown', () => {
  ipcRenderer.send('browser:page-mousedown');
}, true);

// Chrome-like Ctrl + mouse-wheel zoom. Prevent the renderer's default action so
// zoom is owned by the browser shell and the current percentage stays in sync.
window.addEventListener('wheel', (event) => {
  if (!event.ctrlKey || !event.deltaY) return;
  event.preventDefault();
  ipcRenderer.send('browser:zoom-wheel', event.deltaY < 0 ? 1 : -1);
}, { capture: true, passive: false });

function resolveCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, window.location.href).href;
  } catch (_error) {
    return '';
  }
}

function collectFlashCandidates() {
  const urls = [];
  const seen = Object.create(null);

  function add(value) {
    const resolved = resolveCandidate(value);
    if (!resolved || !/\.swf(?:$|[?#])/i.test(resolved) || seen[resolved]) return;
    seen[resolved] = true;
    urls.push(resolved);
  }

  try {
    document.querySelectorAll('embed').forEach((node) => add(node.getAttribute('src')));
    document.querySelectorAll('object').forEach((node) => add(node.getAttribute('data')));
    document.querySelectorAll('param').forEach((node) => {
      const name = String(node.getAttribute('name') || '').toLowerCase();
      if (name === 'movie' || name === 'src') add(node.getAttribute('value'));
    });
  } catch (_error) {}

  ipcRenderer.send('browser:flash-candidates', urls);
}

function installFlashCandidateTracking() {
  collectFlashCandidates();
  try {
    const observer = new MutationObserver(() => collectFlashCandidates());
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data', 'value']
    });
  } catch (_error) {}
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installFlashCandidateTracking, { once: true });
} else {
  installFlashCandidateTracking();
}
