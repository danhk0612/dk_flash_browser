'use strict';

(function () {
  const indicator = document.getElementById('zoom-indicator');
  if (!indicator || !window.dkBrowser) return;

  function applyState(state) {
    const percent = Math.max(25, Math.min(500, Number(state && state.zoomPercent) || 100));
    indicator.textContent = Math.round(percent) + '%';
    indicator.title = '현재 배율 ' + Math.round(percent) + '% · 클릭하면 100%로 초기화 (Ctrl+0)';
  }

  indicator.addEventListener('click', function () {
    window.dkBrowser.send('browser:zoom-reset');
  });

  window.dkBrowser.on('browser:state', applyState);
})();
