import { CookieJar } from 'background/cookie_jar.js';

export const getNextRuleId = async () => {
  const { ruleId } = await chrome.storage.session.get('ruleId');
  const result = typeof ruleId === 'undefined' ? 1 : ruleId;
  return result;
};

export const saveRuleId = async (id) => await chrome.storage.session.set({ ruleId: id });

export const clearOldRequestKeys = async (expiration) => {
  const keyNames = (await chrome.storage.session.getKeys()).filter((key) => key.startsWith('request_'));
  const now = Date.now();
  const toRemove = Object.entries(await chrome.storage.session.get(keyNames))
    .filter(([_key, val]) => now - val.timestamp >= expiration)
    .map(([key, _val]) => key);
  chrome.storage.session.remove(toRemove);
};

export const setTabIdForRequestId = (requestId, tabId) =>
  chrome.storage.session.set({
    [`request_${requestId}`]: {
      tabId,
      timestamp: Date.now(),
    },
  });

export const saveCookieJar = (cookieJarId, tabIds, cookieJar) => {
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

export const getTabIdFromRequestId = async (requestId) => {
  const key = `request_${requestId}`;
  const result = await chrome.storage.session.get(key);
  const { tabId } = result[key] || {};
  return tabId;
};

// export const getCookieJarFromRequestId = async (requestId) => {
//   if (typeof tabId === 'undefined') {
//     throw new Error(`Undefined tabId for request ${requestId}`);
//   }

//   return getCookieJarFromTabId(tabId);
// };
