/* istanbul ignore file */

import { CMD_COVERAGE } from 'shared.js';

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.masType !== CMD_COVERAGE || Object.hasOwn(event.data, 'isolatedCoverage')) {
    return;
  }

  chrome.runtime.sendMessage(chrome.runtime.id, event.data, (response) => {
    postMessage({
      backgroundCoverage: response,
      isolatedCoverage: globalThis.__coverage__,
      masType: CMD_COVERAGE,
    });
  });
});
