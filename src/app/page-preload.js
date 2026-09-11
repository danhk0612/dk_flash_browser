'use strict';

const { ipcRenderer } = require('electron');

window.addEventListener('mousedown', () => {
  ipcRenderer.send('browser:page-mousedown');
}, true);

// General HTML page Ctrl+wheel zoom. Pepper Flash may consume wheel input before
// it reaches the page, so this intentionally guarantees only normal page content.
// Throttle touchpad/high-resolution wheel streams so one gesture does not jump
// through many zoom levels at once.
let lastZoomWheelAt = 0;
window.addEventListener('wheel', (event) => {
  if (!event.ctrlKey || !event.deltaY) return;

  const now = Date.now();
  if (now - lastZoomWheelAt < 90) {
    event.preventDefault();
    return;
  }
  lastZoomWheelAt = now;

  event.preventDefault();
  ipcRenderer.send(event.deltaY < 0 ? 'browser:feature-zoom-in' : 'browser:feature-zoom-out');
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

function uniqueUrls(values, filter) {
  const seen = Object.create(null);
  const result = [];
  values.forEach((value) => {
    const resolved = resolveCandidate(value);
    if (!resolved || seen[resolved] || (filter && !filter(resolved))) return;
    seen[resolved] = true;
    result.push(resolved);
  });
  return result;
}

function collectMediaCandidates() {
  const flashValues = [];
  const imageValues = [];

  try {
    document.querySelectorAll('embed').forEach((node) => flashValues.push(node.getAttribute('src')));
    document.querySelectorAll('object').forEach((node) => flashValues.push(node.getAttribute('data')));
    document.querySelectorAll('param').forEach((node) => {
      const name = String(node.getAttribute('name') || '').toLowerCase();
      if (name === 'movie' || name === 'src') flashValues.push(node.getAttribute('value'));
    });

    document.querySelectorAll('img').forEach((node) => {
      imageValues.push(node.currentSrc || node.getAttribute('src'));
    });
    document.querySelectorAll('input[type="image"]').forEach((node) => imageValues.push(node.getAttribute('src')));
    document.querySelectorAll('source').forEach((node) => {
      const srcset = String(node.getAttribute('srcset') || '').split(',');
      srcset.forEach((part) => imageValues.push(part.trim().split(/\s+/)[0]));
    });
  } catch (_error) {}

  ipcRenderer.send('browser:flash-candidates', uniqueUrls(flashValues, (url) => /\.swf(?:$|[?#])/i.test(url)));
  ipcRenderer.send('browser:image-candidates', uniqueUrls(imageValues, (url) => /^(?:https?:|file:|data:|blob:)/i.test(url)));
}

function installMediaCandidateTracking() {
  collectMediaCandidates();
  try {
    const observer = new MutationObserver(() => collectMediaCandidates());
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data', 'value']
    });
  } catch (_error) {}
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installMediaCandidateTracking, { once: true });
} else {
  installMediaCandidateTracking();
}
