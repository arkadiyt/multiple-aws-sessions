import { CookieJar } from 'background/cookie_jar.js';

export const getNextRuleId = async () => {
  const { ruleId } = await chrome.storage.session.get('ruleId');
  const result = typeof ruleId === 'undefined' ? 1 : ruleId;
  return result;
};

export const saveRuleId = async (id) => await chrome.storage.session.set({ ruleId: id });

const getTabIdFromRequestId = async (requestId) => {
  const key = `request_${requestId}`;
  const result = await chrome.storage.session.get(key);
  return (result[key] || {}).tabId;
};

export const setTabIdForRequestId = (requestId, tabId) =>
  chrome.storage.session.set({
    [`request_${requestId}`]: {
      tabId,
      timestamp: Date.now(),
    },
  });

export const saveCookieJar = async (cookieJarId, tabIds, cookieJar) => {
  const id = typeof cookieJarId === 'undefined' ? crypto.randomUUID() : cookieJarId;
  const toSave = {
    [`cookie_jar_${id}`]: {
      cookieJar,
      tabIds,
    },
  };

  for (const tabId of tabIds) {
    toSave[`tab_${tabId}`] = { cookieJarId: id };
  }

  return chrome.storage.session.set(toSave);
};

export const getCookieJarFromTabId = async (tabId) => {
  const tabKey = `tab_${tabId}`;
  const tab = await chrome.storage.session.get(tabKey);
  const { cookieJarId } = tab[tabKey] || {};

  if (typeof cookieJarId === 'undefined') {
    return [cookieJarId, [tabId], new CookieJar()];
  }

  const cookieJarKey = `cookie_jar_${cookieJarId}`;
  const cookieJarDetails = await chrome.storage.session.get(cookieJarKey);
  const { tabIds, cookieJar } = cookieJarDetails[cookieJarKey] || {};
  return [cookieJarId, tabIds, CookieJar.unmarshal(cookieJar)];
};

export const removeTabId = async (tabId) => {
  const [cookieJarId, tabIds, cookieJar] = await getCookieJarFromTabId(tabId);

  if (typeof cookieJarId === 'undefined') {
    return void 0;
  }

  const newTabIds = tabIds.filter((id) => id === tabId);
  const promises = [chrome.storage.session.remove(`tab_${tabId}`)];
  if (newTabIds.length === 0) {
    promises.push(chrome.storage.session.remove(`cookie_jar_${cookieJarId}`));
  } else {
    promises.push(saveCookieJar(cookieJarId, newTabIds, cookieJar));
  }

  return Promise.allSettled(promises);
};

export const getCookieJarFromRequestId = async (requestId) => {
  const tabId = await getTabIdFromRequestId(requestId);
  // TODO should this move into getTabIdFromRequestId?
  if (typeof tabId === 'undefined') {
    reject(`Tab not found for request ${requestId}`);
    return;
  }

  return getCookieJarFromTabId(tabId);
};