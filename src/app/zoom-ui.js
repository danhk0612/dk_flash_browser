'use strict';

(function () {
  const indicator = document.getElementById('zoom-indicator');
  if (!indicator || !window.dkBrowser) return;

  function applyZoomState(state) {
    const percent = Math.max(25, Math.min(500, Number(state && state.zoomPercent) || 100));
    indicator.textContent = Math.round(percent) + '%';
    indicator.title = '현재 배율 ' + Math.round(percent) + '% · 클릭하면 100%로 초기화 (Ctrl+0)';
  }

  indicator.addEventListener('click', function () {
    window.dkBrowser.send('browser:feature-zoom-reset');
  });

  // Do not use browser:state.zoomPercent here. That value is maintained by the
  // older tab model and can lag behind the BrowserView's real zoom factor.
  window.dkBrowser.on('browser:zoom-state', applyZoomState);
})();
