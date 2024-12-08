/**
 * Inject a script that runs in the "MAIN" world / has access to hook document.cookie
 */

(() => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/content_script_main.js');
  script.onload = () => script.remove();
  document.head.appendChild(script);
})();

/**
 * Message passing between main and isolated scripts
 */
(() => {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) {
      return;
    }
    postMessage(message);
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }
    if (event.type !== 'parse-new-cookie') {
      return;
    }
    chrome.runtime.sendMessage(chrome.runtime.id, event.data);
  });

  // Tell the service worker we're loaded so it can send us any already-received cookies to inject
  chrome.runtime.sendMessage(chrome.runtime.id, { type: 'loaded' });
})();

/**
 * Add a div to show the current account id at the top of the page
 */
(async () => {
  const waitForElm = (selector) =>
    new Promise((resolve) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });

  const sessionData = JSON.parse((await waitForElm('meta[name=awsc-session-data]')).content);
  const div = document.createElement('div');
  div.innerText = sessionData.accountAlias;
  div.style =
    'color:#ebebf0; font-size 15px; line-height: 3; text-decoration-line: underline; font-family: Amazon Ember,Helvetica Neue,Roboto,Arial,sans-serif';
  (await waitForElm('#aws-unified-search-container')).appendChild(div);
})();
