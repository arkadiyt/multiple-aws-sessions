import 'selenium/isolated.js';
import { CMD_COLOR, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';

/**
 * Message passing between main and isolated scripts
 */
(() => {
  // Promise for when main world script is ready to handle messages
  const { promise, resolve } = Promise.withResolvers();
  let scriptLoaded = false;
  // Inject a script that runs in the main world / has access to hook document.cookie
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('dist/main.js');
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
  chrome.runtime.sendMessage({ masType: CMD_LOADED });

  // Messages from the main world script to us, which we forward to the background service worker
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.masType !== CMD_PARSE_NEW_COOKIE) {
      return;
    }

    chrome.runtime.sendMessage(event.data);
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

    const colorPromise = new Promise((resolve) => {
      chrome.runtime.sendMessage({ accountId: sessionData.accountId, masType: CMD_COLOR }, resolve);
    });

    const div = document.createElement('div');
    div.classList.add('masAccount');

    // Always have a link to the current page so people can easily open a new tab with the existing cookies
    const anchor = document.createElement('a');
    anchor.href = '';
    anchor.target = '_blank';
    anchor.innerText = sessionData.accountAlias || sessionData.displayName;
    div.appendChild(anchor);

    const colorPickerLabel = document.createElement('label');
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';

    const nav = await waitForElm('nav[aria-label="Global"]');
    colorPicker.addEventListener('input', (event) => {
      nav.style.backgroundColor = event.target.value;
    });
    colorPicker.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({
        accountId: sessionData.accountId,
        color: event.target.value,
        masType: CMD_COLOR,
        set: true,
      });
    });

    colorPickerLabel.appendChild(colorPicker);
    div.appendChild(colorPickerLabel);

    const existingColor = await colorPromise;
    nav.style.backgroundColor = existingColor;
    colorPicker.value = existingColor;
    (await waitForElm('#aws-unified-search-container')).appendChild(div);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAccountName);
  } else {
    injectAccountName();
  }
})();
