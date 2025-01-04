import { CMD_INJECT_COOKIES, CMD_PARSE_NEW_COOKIE } from 'shared.js';

(() => {
  // Hook `fetch` and make sure that keepalive is always set to false when using Firefox.
  // Requests that have it set to true are not associated with a tab, and then in webRequest.onHeadersReceived you'll
  // have tabId === -1, which breaks the extension
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    const originalFetch = fetch;
    window.fetch = (url, options) => originalFetch(url, { ...options, keepalive: false });
  }
})();

(() => {
  // Hook reads/writes to document.cookie and inject our desired cookies
  let cookies = '';

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.masType !== CMD_INJECT_COOKIES) {
      return;
    }

    ({ cookies } = event.data);
  });

  Object.defineProperty(Document.prototype, 'cookie', {
    get() {
      return cookies;
    },
    set(val) {
      postMessage({
        cookies: val,
        masType: CMD_PARSE_NEW_COOKIE,
      });
    },
  });
})();
