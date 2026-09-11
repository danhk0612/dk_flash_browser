'use strict';

(function () {
  const indicator = document.getElementById('zoom-indicator');
  if (!indicator || !window.dkBrowser) return;

  let lastPercent = 100;

  function applyZoomState(state) {
    const percent = Math.max(25, Math.min(500, Number(state && state.zoomPercent) || 100));
    lastPercent = Math.round(percent);
    indicator.textContent = lastPercent + '%';
    indicator.title = '현재 배율 ' + lastPercent + '% · 클릭하면 100%로 초기화 (Ctrl+0)';
  }

  function requestActualZoom() {
    window.dkBrowser.send('browser:request-zoom-state');
  }

  indicator.addEventListener('click', function () {
    window.dkBrowser.send('browser:feature-zoom-reset');
    window.setTimeout(requestActualZoom, 60);
  });

  window.dkBrowser.on('browser:zoom-state', applyZoomState);

  // The old tab-state model can lag behind native/global zoom shortcuts.
  // Query the active BrowserView periodically as a safety net so the number
  // shown in the toolbar always converges to the real webContents zoom.
  requestActualZoom();
  window.setInterval(requestActualZoom, 500);
  window.addEventListener('focus', requestActualZoom);
})();
