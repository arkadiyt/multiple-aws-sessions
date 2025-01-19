/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

import { CMD_COVERAGE } from 'shared.js';

// We don't want to lose the in-memory coverage data from the page when Selenium navigates the tab to a new page,
// so this proxy object hooks writes to the window.__coverage__ object, does the original modification, and then writes
// the entire object to local storage - then we can fetch it at a later time. But since localStorage is shared between
// tabs this cause a problem, tabs will overwrite each others' coverage data, so have each tab generate a UUID and
// store that page's storage to __mas_coverage__<uuid>
const coverageObj = {};
const uuid = crypto.randomUUID();
const coveragePrefix = '__mas_coverage__';

globalThis.__coverage__ = new Proxy(coverageObj, {
  set(...args) {
    const result = Reflect.set(...args);
    localStorage.setItem(coveragePrefix + uuid, JSON.stringify(coverageObj));
    return result;
  },
});

// This function is invoked from Selenium to pull all the coverage data from this main world content script,
// the isolated world content script, and the background service worker
const fetchCoverage = () => {
  const mainCoverage = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key.startsWith(coveragePrefix)) {
      mainCoverage[key.substring(coveragePrefix.length)] = localStorage.getItem(key);
    }
  }

  return new Promise((resolve) => {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return;
      }

      if (event.data.masType !== CMD_COVERAGE || !Object.hasOwn(event.data, 'isolatedCoverage')) {
        return;
      }

      resolve({ mainCoverage, ...event.data });
    });
    postMessage({ masType: CMD_COVERAGE });
  });
};

// Define this globally so that Selenium can invoke it
globalThis.fetchCoverage = fetchCoverage;
