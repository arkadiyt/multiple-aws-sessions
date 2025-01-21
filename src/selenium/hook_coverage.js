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
  // store that page's coverage to __mas_coverage__<uuid>. We merge these results later in the test script
  const coverageObj = {};
  const uuid = crypto.randomUUID();

  const handler = {
    set(target, property, value, receiver) {
      let newValue = value;

      if (typeof value === 'object') {
        newValue = new Proxy(value, handler);
        // If we hook __coverage__ and someone does:
        // __coverage__.a = {b: {c: 1}}
        // then the nested objects are not hooked, so the code below recursively proxies all nested objects
        for (const [key, val] of Object.entries(value)) {
          newValue[key] = val;
        }
      }

      const result = Reflect.set(target, property, newValue, receiver);
      localStorage.setItem(COVERAGE_PREFIX + uuid, JSON.stringify(coverageObj));

      return result;
    },
  };

  globalThis.__coverage__ = new Proxy(coverageObj, handler);
};
