/* Transport only. The protocol adapter must validate contract/PROTOCOL.md schemas.
   Nothing installs or sends native messages until an adapter is supplied. */
(function (root) {
  'use strict';
  function createRouter(browser, adapter) {
    if (!adapter || typeof adapter.validateRequest !== 'function' || typeof adapter.validateResponse !== 'function') throw new Error('PROTOCOL_REQUIRED');
    const pending = new Map();
    const allowed = sender => sender.id === browser.runtime.id && Number.isInteger(sender.tab?.id) && sender.frameId === 0 && /^https?:$/.test(new URL(sender.url).protocol);
    async function receive(message, sender) {
      if (!allowed(sender) || !adapter.validateRequest(message)) return undefined;
      const tabId = sender.tab.id, url = sender.url, token = {};
      pending.set(tabId, token);
      try {
        const response = await adapter.sendNative(message);
        if (pending.get(tabId) !== token || !adapter.validateResponse(response, message)) return undefined;
        const tab = await browser.tabs.get(tabId);
        if (tab.url !== url) return undefined;
        return response;
      } finally { if (pending.get(tabId) === token) pending.delete(tabId); }
    }
    const invalidate = (tabId, info) => { if (!info || info.url || info.status === 'loading') pending.delete(tabId); };
    browser.runtime.onMessage.addListener(receive);
    browser.tabs.onUpdated.addListener(invalidate);
    browser.tabs.onRemoved.addListener(invalidate);
    return { dispose() { pending.clear(); browser.runtime.onMessage.removeListener(receive); browser.tabs.onUpdated.removeListener(invalidate); browser.tabs.onRemoved.removeListener(invalidate); } };
  }
  root.SeeForMeBackground = Object.freeze({ createRouter });
})(globalThis);
