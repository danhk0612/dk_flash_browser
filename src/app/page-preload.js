'use strict';

const { ipcRenderer } = require('electron');

window.addEventListener('mousedown', () => {
  ipcRenderer.send('browser:page-mousedown');
}, true);

// Ctrl+mouse-wheel zoom is intentionally not intercepted here. In the current
// Electron 6 + BrowserView runtime the gesture is consumed before this preload
// reliably receives it, even on ordinary pages. Supported zoom controls are
// Ctrl + +/-/0 and the browser function menu.

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

let lastFaviconKey = '';
let fallbackProbeUrl = '';

function sendFaviconCandidate(favicon, source) {
  const pageUrl = String(window.location.href || '');
  const resolved = resolveCandidate(favicon);
  if (!pageUrl || !resolved) return;
  const key = pageUrl + '|' + source + '|' + resolved;
  if (key === lastFaviconKey) return;
  lastFaviconKey = key;
  ipcRenderer.send('browser:page-favicon-candidate', {
    pageUrl: pageUrl,
    favicon: resolved,
    source: source
  });
}

function declaredFaviconCandidates() {
  const values = [];
  try {
    const links = Array.prototype.slice.call(document.querySelectorAll('link[rel][href]'));
    links.reverse().forEach((node) => {
      const rel = String(node.getAttribute('rel') || '').toLowerCase();
      const tokens = rel.split(/\s+/).filter(Boolean);
      if (tokens.indexOf('icon') >= 0 || rel.indexOf('shortcut icon') >= 0 || rel.indexOf('apple-touch-icon') >= 0) {
        values.push(node.getAttribute('href'));
      }
    });
  } catch (_error) {}
  return uniqueUrls(values, (url) => /^(?:https?:|file:|data:)/i.test(url));
}

function probeFallbackFavicon() {
  let origin = '';
  try {
    const parsed = new URL(window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    origin = parsed.origin;
  } catch (_error) {
    return;
  }

  const canonical = origin + '/favicon.ico';
  if (fallbackProbeUrl === canonical) return;
  fallbackProbeUrl = canonical;

  const image = new Image();
  let finished = false;
  const finish = function (ok) {
    if (finished) return;
    finished = true;
    image.onload = null;
    image.onerror = null;
    if (ok) sendFaviconCandidate(canonical, 'fallback');
  };
  image.onload = function () { finish(true); };
  image.onerror = function () { finish(false); };
  image.src = canonical + '?_dkfb_probe=' + Date.now();
  window.setTimeout(function () { finish(false); }, 2500);
}

function collectFaviconCandidate() {
  const declared = declaredFaviconCandidates();
  if (declared.length) {
    fallbackProbeUrl = '';
    sendFaviconCandidate(declared[0], 'declared');
    return;
  }
  probeFallbackFavicon();
}

function collectPageCandidates() {
  collectMediaCandidates();
  collectFaviconCandidate();
}

function installCandidateTracking() {
  collectPageCandidates();
  window.setTimeout(collectFaviconCandidate, 800);
  window.setTimeout(collectFaviconCandidate, 2500);
  window.addEventListener('load', collectFaviconCandidate, { once: true });

  try {
    const observer = new MutationObserver(() => collectPageCandidates());
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data', 'value', 'href', 'rel', 'sizes', 'type']
    });
  } catch (_error) {}
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installCandidateTracking, { once: true });
} else {
  installCandidateTracking();
}
