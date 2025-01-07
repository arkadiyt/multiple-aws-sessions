import { CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';

const { scriptLoadedPromise, scriptLoadedResolve } = Promise.withResolvers();

/**
 * Inject a script that runs in the "MAIN" world / has access to hook document.cookie
 */
(() => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/content_script_main.js');
  script.onload = () => {
    scriptLoadedResolve();
    script.remove();
  };
  document.documentElement.appendChild(script);
})();

/**
 * Message passing between main and isolated scripts
 */
(async () => {
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

    if (event.data.masType !== CMD_PARSE_NEW_COOKIE) {
      return;
    }

    chrome.runtime.sendMessage(chrome.runtime.id, event.data);
  });

  // Wait until the main world script is loaded and tell the service worker we're
  // ready to process any already-received cookies
  await scriptLoadedPromise();
  chrome.runtime.sendMessage(chrome.runtime.id, { masType: CMD_LOADED });
})();

/**
 * Add a div to show the current account id at the top of the page
 */
(() => {
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

  // Since we run at document_start, document.body (used above) isn't defined yet, so wait for the DOMContentLoaded event
  document.addEventListener('DOMContentLoaded', async () => {
    const sessionData = JSON.parse((await waitForElm('meta[name=awsc-session-data]')).content);
    const div = document.createElement('div');
    div.innerText = sessionData.accountAlias || sessionData.displayName;
    div.style =
      'color:#ebebf0; font-size 15px; line-height: 3; text-decoration-line: underline; font-family: Amazon Ember, Helvetica Neue, Roboto, Arial, sans-serif';
    (await waitForElm('#aws-unified-search-container')).appendChild(div);
  });
})();
