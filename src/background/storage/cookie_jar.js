import { CookieJar } from 'background/cookie_jar.js';

export class CookieJarStorage {
  static #getTabs = async () => {
    const tabsKey = 'tabs';
    const inverseKey = 'tabsInverse';
    const result = await chrome.storage.session.get([tabsKey, inverseKey]);
    const tabs = result[tabsKey] || {};
    const tabsInverse = result[inverseKey] || {};
    return [tabs, tabsInverse];
  };

  static #saveTabs = (tabs, tabsInverse) => chrome.storage.session.set({ tabs, tabsInverse });

  static getCookieJarFromTabId = async (tabId) => {
    const [tabs] = await this.#getTabs();
    const cookieJarId = tabs[tabId];
    const cookieJarKey = `cookie_jar_${cookieJarId}`;
    const cookieJarDetails = await chrome.storage.session.get(cookieJarKey);
    return CookieJar.unmarshal(
      Object.hasOwn(cookieJarDetails, cookieJarKey) ? cookieJarDetails[cookieJarKey] : { cookies: [] },
    );
  };

  static addCookiesToJar = async (tabId, cookies, requestUrl, fromHttp) => {
    const [tabs, tabsInverse] = await this.#getTabs();
    const cookieJarId = tabs[tabId];
    const cookieJarKey = `cookie_jar_${cookieJarId}`;

    return navigator.locks.request(cookieJarKey, async () => {
      const cookieJarDetails = await chrome.storage.session.get(cookieJarKey);
      const cookieJar = CookieJar.unmarshal(cookieJarDetails[cookieJarKey] || { cookies: [] });
      cookieJar.upsertCookies(cookies, requestUrl, fromHttp);
      await chrome.storage.session.set({
        [cookieJarKey]: cookieJar,
      });
      return [tabsInverse[cookieJarId], cookieJar];
    });
  };

  static setCookieJarIdForTab = (tabId, openerTabId) =>
    navigator.locks.request('tabs', async () => {
      const [tabs, tabsInverse] = await this.#getTabs();

      if (typeof openerTabId !== 'undefined' && typeof tabs[openerTabId] !== 'undefined') {
        const cookieJarId = tabs[openerTabId];
        tabs[tabId] = cookieJarId;
        tabsInverse[cookieJarId].push(tabId);
      } else {
        tabs[tabId] = crypto.randomUUID();
        tabsInverse[tabs[tabId]] = [tabId];
      }

      await this.#saveTabs(tabs, tabsInverse);

      return tabsInverse[tabs[tabId]];
    });

  static setCookieJarsForInitialTabs = (tabIds) => {
    if (tabIds.length === 0) {
      return;
    }

    navigator.locks.request('tabs', async () => {
      const [tabs, tabsInverse] = await this.#getTabs();

      for (const tabId of tabIds) {
        tabs[tabId] = crypto.randomUUID();
        tabsInverse[tabs[tabId]] = [tabId];
      }

      await this.#saveTabs(tabs, tabsInverse);
    });
  };

  static removeTabId = (tabId) =>
    navigator.locks.request('tabs', async () => {
      const [tabs, tabsInverse] = await this.#getTabs();

      if (typeof tabs[tabId] === 'undefined') {
        return;
      }

      const cookieJarId = tabs[tabId];
      delete tabs[tabId];
      tabsInverse[cookieJarId] = tabsInverse[cookieJarId].filter((item) => item !== tabId);

      await this.#saveTabs(tabs, tabsInverse);

      if (tabsInverse[cookieJarId].length === 0) {
        // No await, no lock on cookie jar
        chrome.storage.session.remove(`cookie_jar_${cookieJarId}`);
      }
    });
}
