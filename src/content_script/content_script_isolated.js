import { CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';

/**
 * Message passing between main and isolated scripts
 */
(() => {
  // Promise for when main world script is ready to handle messages
  const { promise, resolve } = Promise.withResolvers();
  let scriptLoaded;
  // Inject a script that runs in the main world / has access to hook document.cookie
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/content_script_main.js');
  script.onload = () => {
    script.remove();
    scriptLoaded = true;
    resolve();
  };
  // Append to document.documentElement instead of document.head - the latter isn't defined when we run
  // at document_start
  document.documentElement.appendChild(script);

  // Messages from the background service worker to us, which we forward to the main world script
  chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (sender.id !== chrome.runtime.id) {
      return;
    }

    // Doing an `await` will pause until the next tick even if the promise is already fulfilled, so only await if needed
    if (scriptLoaded !== true) {
      await promise;
    }

    postMessage(message);
  });

  // Tell the background service worker we're ready to process any already-received cookies
  chrome.runtime.sendMessage(chrome.runtime.id, { masType: CMD_LOADED });

  // Messages from the main world script to us, which we forward to the background service worker
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.masType !== CMD_PARSE_NEW_COOKIE) {
      return;
    }

    chrome.runtime.sendMessage(chrome.runtime.id, event.data);
  });
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

  const injectAccountName = async () => {
    const sessionData = JSON.parse((await waitForElm('meta[name=awsc-session-data]')).content);
    const div = document.createElement('div');
    div.innerText = sessionData.accountAlias || sessionData.displayName;
    div.style =
      'color:#ebebf0; font-size 15px; line-height: 3; text-decoration-line: underline; font-family: Amazon Ember, Helvetica Neue, Roboto, Arial, sans-serif';
    (await waitForElm('#aws-unified-search-container')).appendChild(div);
  };

  // We're running at document_start so document.readyState won't ever be complete, but just to cover all cases:
  if (document.readyState === 'complete') {
    injectAccountName();
  } else {
    document.addEventListener('DOMContentLoaded', injectAccountName);
  }
})();
