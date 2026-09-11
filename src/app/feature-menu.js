'use strict';

(function () {
  const button = document.getElementById('feature-menu-button');
  if (!button || !window.dkBrowser) return;

  button.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    window.dkBrowser.send('browser:feature-menu');
  });
})();
