/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

import { COVERAGE_PREFIX, hookCoverage } from 'selenium/hook_coverage.js';
import { CMD_COVERAGE } from 'shared.js';

hookCoverage();

// Pull all the coverage data from this main world content script, the isolated world content script,
// and the background service worker
const fetchCoverage = () => {
  const pageCoverage = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key.startsWith(COVERAGE_PREFIX)) {
      pageCoverage[key.substring(COVERAGE_PREFIX.length)] = JSON.parse(localStorage.getItem(key));
    }
  }

  return new Promise((resolve) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return;
      }

      if (event.data.masType !== CMD_COVERAGE || !Object.hasOwn(event.data, 'backgroundCoverage')) {
        return;
      }

      resolve({ pageCoverage, ...event.data });
    });
    postMessage({ masType: CMD_COVERAGE });
  });
};

// Make these global so Selenium can call them
globalThis._MAS = {
  fetchCoverage,
};
