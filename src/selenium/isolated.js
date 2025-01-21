/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

import { CMD_COVERAGE } from 'shared.js';
import { hookCoverage } from 'selenium/hook_coverage.js';

hookCoverage();

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.masType !== CMD_COVERAGE || Object.hasOwn(event.data, 'backgroundCoverage')) {
    return;
  }

  chrome.runtime.sendMessage(event.data, (response) => {
    postMessage({
      backgroundCoverage: response,
      masType: CMD_COVERAGE,
    });
  });
});
