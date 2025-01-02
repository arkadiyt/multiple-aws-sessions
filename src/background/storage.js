import { CookieJar } from 'background/cookie_jar.js';

const getTabs = async () => {
  const tabsKey = 'tabs';
  const inverseKey = 'tabsInverse';
  const result = await chrome.storage.session.get([tabsKey, inverseKey]);
  const tabs = result[tabsKey] || {};
  const tabsInverse = result[inverseKey] || {};
  return [tabs, tabsInverse];
};

export const clearOldRequestKeys = async (expiration) => {
  const keyNames = (await chrome.storage.session.getKeys()).filter((key) => key.startsWith('request_'));
  const now = Date.now();
  const toRemove = Object.entries(await chrome.storage.session.get(keyNames))
    .filter(([_key, val]) => now - val.timestamp >= expiration)
    .map(([key, _val]) => key);
  return chrome.storage.session.remove(toRemove);
};

export const setTabIdForRequestId = (requestId, tabId) =>
  chrome.storage.session.set({
    [`request_${requestId}`]: {
      tabId,
      timestamp: Date.now(),
    },
  });

export const getCookieJarFromTabId = async (tabId) => {
  const [tabs] = await getTabs();
  const cookieJarId = tabs[tabId];
  const cookieJarKey = `cookie_jar_${cookieJarId}`;
  const cookieJarDetails = await chrome.storage.session.get(cookieJarKey);
  return CookieJar.unmarshal(
    Object.hasOwn(cookieJarDetails, cookieJarKey) ? cookieJarDetails[cookieJarKey] : { cookies: [] },
  );
};

export const getTabIdFromRequestId = async (requestId) => {
  const key = `request_${requestId}`;
  const result = await chrome.storage.session.get(key);
  const { tabId } = result[key] || {};
  return tabId;
};

export const addCookiesToJar = async (tabId, cookies, requestUrl, fromJavascript) => {
  const [tabs, tabsInverse] = await getTabs();
  const cookieJarId = tabs[tabId];
  const cookieJarKey = `cookie_jar_${cookieJarId}`;

  return navigator.locks.request(cookieJarKey, async () => {
    const cookieJarDetails = await chrome.storage.session.get(cookieJarKey);
    const cookieJar = CookieJar.unmarshal(cookieJarDetails[cookieJarKey] || { cookies: [] });
    cookieJar.upsertCookies(cookies, requestUrl, fromJavascript);
    await chrome.storage.session.set({
      [cookieJarKey]: cookieJar,
    });
    return [tabsInverse[cookieJarId], cookieJar];
  });
};

const saveTabs = (tabs, tabsInverse) => chrome.storage.session.set({ tabs, tabsInverse });

export const setCookieJarIdForTab = (tabId, openerTabId) =>
  navigator.locks.request('tabs', async () => {
    const [tabs, tabsInverse] = await getTabs();

    if (typeof openerTabId !== 'undefined' && typeof tabs[openerTabId] !== 'undefined') {
      const cookieJarId = tabs[openerTabId];
      tabs[tabId] = cookieJarId;
      tabsInverse[cookieJarId].push(tabId);
    } else {
      tabs[tabId] = crypto.randomUUID();
      tabsInverse[tabs[tabId]] = [tabId];
    }

    await saveTabs(tabs, tabsInverse);

    return tabsInverse[tabs[tabId]];
  });

export const removeTabId = (tabId) =>
  navigator.locks.request('tabs', async () => {
    const [tabs, tabsInverse] = await getTabs();

    if (typeof tabs[tabId] === 'undefined') {
      return;
    }

    const cookieJarId = tabs[tabId];
    delete tabs[tabId];
    tabsInverse[cookieJarId] = tabsInverse[cookieJarId].filter((item) => item !== tabId);

    await saveTabs(tabs, tabsInverse);

    if (tabsInverse[cookieJarId].length === 0) {
      // No await, no lock on cookie jar
      chrome.storage.session.remove(`cookie_jar_${cookieJarId}`);
    }
  });
