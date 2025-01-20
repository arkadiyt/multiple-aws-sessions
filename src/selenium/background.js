/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

import { CMD_COVERAGE, CMD_LOG } from 'shared.js';

// Send our coverage data to the isolated content script when it asks for it
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    return;
  }

  if (typeof sender.tab === 'undefined') {
    return;
  }

  if (message.masType !== CMD_COVERAGE) {
    return;
  }

  sendResponse(globalThis.__coverage__);
});

// Can't open the background page inspector window in Selenium, so send our logs to the content script
['log', 'warn', 'error'].forEach((method) => {
  const original = console[method];
  console[method] = (...args) => {
    const result = original(...args);

    (async () => {
      const tabs = await chrome.tabs.query({});
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          args,
          masType: CMD_LOG,
        });
      });
    })();

    return result;
  };
});
