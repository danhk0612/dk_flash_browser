'use strict';

(function () {
  if (!window.dkBrowser || typeof window.dkBrowser.on !== 'function') return;

  const originalOn = window.dkBrowser.on.bind(window.dkBrowser);

  function stateKey(payload) {
    const state = payload || {};
    return [
      state.id,
      state.url || '',
      state.title || '',
      state.canGoBack ? 1 : 0,
      state.canGoForward ? 1 : 0,
      state.crashed ? 1 : 0
    ].join('\u001f');
  }

  function tabsKey(payload) {
    const state = payload || {};
    const tabs = Array.isArray(state.tabs) ? state.tabs : [];
    return String(state.activeTabId == null ? '' : state.activeTabId) + '\u001e' + tabs.map(function (tab) {
      return [tab.id, tab.title || '', tab.url || '', tab.crashed ? 1 : 0].join('\u001f');
    }).join('\u001d');
  }

  window.dkBrowser.on = function (channel, handler) {
    if (channel === 'browser:state') {
      let lastKey = null;
      let timer = null;
      let pending = null;
      originalOn(channel, function (payload) {
        pending = payload || {};
        const key = stateKey(pending);
        if (key === lastKey) return;
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          timer = null;
          const nextKey = stateKey(pending);
          if (nextKey === lastKey) return;
          lastKey = nextKey;
          handler(pending);
        }, 12);
      });
      return;
    }

    if (channel === 'browser:tabs') {
      let lastKey = null;
      let lastActive = null;
      let timer = null;
      let pending = null;

      function dispatch() {
        timer = null;
        const nextKey = tabsKey(pending);
        if (nextKey === lastKey) return;
        lastKey = nextKey;
        lastActive = pending ? pending.activeTabId : null;
        handler(pending);
      }

      originalOn(channel, function (payload) {
        pending = payload || { activeTabId: null, tabs: [] };
        const key = tabsKey(pending);
        if (key === lastKey) return;

        // Tab activation should feel immediate; title/URL churn during a page
        // navigation is coalesced so the tab DOM is not rebuilt several times
        // within the same visual moment.
        if (lastKey === null || pending.activeTabId !== lastActive) {
          if (timer) window.clearTimeout(timer);
          dispatch();
          return;
        }

        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(dispatch, 28);
      });
      return;
    }

    originalOn(channel, handler);
  };
})();
