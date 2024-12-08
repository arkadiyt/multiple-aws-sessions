(() => {
  let cookies = '';

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.type !== 'inject-cookies') {
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
      // parse it and send us back a message in the reverse direction with the new cookies
      // We intentionally do a round trip to avoid parsing in the content script
      postMessage({
        cookies: val,
        type: 'parse-new-cookie',
      });
    },
  });
})();
