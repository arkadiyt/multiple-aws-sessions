/* istanbul ignore file */

/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * It faciliates coverage instrumentation when executing in a selenium environment
 */

export const COVERAGE_PREFIX = '__mas_coverage__';

export const hookCoverage = () => {
  // We don't want to lose the in-memory coverage data from the page when Selenium navigates the tab to a new page,
  // so this proxy object hooks writes to the window.__coverage__ object, does the original modification, and then writes
  // the entire object to local storage - then we can fetch it at a later time. But since localStorage is shared between
  // tabs this cause a problem, tabs will overwrite each others' coverage data, so have each tab generate a UUID and
  // store that page's storage to __mas_coverage__<uuid>
  const coverageObj = {};
  const uuid = crypto.randomUUID();
  globalThis.__coverage__ = new Proxy(coverageObj, {
    set(...args) {
      const result = Reflect.set(...args);
      localStorage.setItem(COVERAGE_PREFIX + uuid, JSON.stringify(coverageObj));
      return result;
    },
  });
};
