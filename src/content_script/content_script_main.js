import { CMD_PARSE_NEW_COOKIE, CMD_INJECT_COOKIES } from '../common.js';

(() => {
  let cookies = '';

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.mas_type !== CMD_INJECT_COOKIES) {
      return;
    }

    ({ cookies } = event.data);
  });

  Object.defineProperty(Document.prototype, 'cookie', {
    get() {
      return cookies;
    },
    set(val) {
      // Send written cookies to the isolated script, which will send it to the service worker, which will
      // parse it and send us back a message in the reverse direction with the new cookies.
      // This intentionally does a round trip to avoid parsing in the content script
      postMessage({
        cookies: val,
        mas_type: CMD_PARSE_NEW_COOKIE,
      });
    },
  });
})();
