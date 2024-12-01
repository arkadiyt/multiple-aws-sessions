import { CMD_INJECT_COOKIES, CMD_PARSE_NEW_COOKIE } from 'shared.js';

(() => {
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
