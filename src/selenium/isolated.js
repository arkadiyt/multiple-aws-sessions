/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

import { CMD_COVERAGE, CMD_LOG } from 'shared.js';
import { hookCoverage } from 'selenium/hook_coverage.js';

hookCoverage();

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.masType !== CMD_COVERAGE || Object.hasOwn(event.data, 'backgroundCoverage')) {
    return;
  }

  chrome.runtime.sendMessage(chrome.runtime.id, event.data, (response) => {
    postMessage({
      backgroundCoverage: response,
      masType: CMD_COVERAGE,
    });
  });
});

// Can't open the background page inspector window in Selenium, so this mirrors console.logs from the background window
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) {
    return;
  }

  if (message.masType !== CMD_LOG) {
    return;
  }

  console.warn('Background Page: ', ...message.args);
});
