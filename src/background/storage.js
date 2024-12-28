import { CookieJar } from './cookie_jar.js';

export const getNextRuleId = async () => {
  const { ruleId } = await chrome.storage.session.get('ruleId'),
    result = ruleId === undefined ? 1 : ruleId;
  return result;
};

export const saveRuleId = async (id) => await chrome.storage.session.set({ ruleId: id });

const getTabIdFromRequestId = async (requestId) => {
  const key = `request_${requestId}`,
    result = await chrome.storage.session.get(key);
  return (result[key] || {}).tabId;
};

export const setTabIdForRequestId = (requestId, tabId) =>
  chrome.storage.session.set({
    [`request_${requestId}`]: {
      tabId,
      timestamp: Date.now(),
    },
  });

export const getCookieJarFromRequestId = (requestId) =>
  // Todo remove usage of new Promise
  new Promise(async (resolve, reject) => {
    const tabId = await getTabIdFromRequestId(requestId);
    // TODO should this move into getTabIdFromRequestId?
    if (tabId === undefined) {
      reject(`Tab not found for request ${requestId}`);
      return;
    }

    getCookieJarFromTabId(tabId).then(resolve);
  });

export const getCookieJarFromTabId = (tabId) =>
  new Promise((resolve) => {
    const tabKey = `tab_${tabId}`;
    chrome.storage.session.get(tabKey, (tab) => {
      const { cookieJarId } = tab[tabKey] || {};

      if (cookieJarId === undefined) {
        resolve([cookieJarId, [tabId], new CookieJar()]);
        return;
      }

      const cookieJarKey = `cookie_jar_${cookieJarId}`;
      chrome.storage.session.get(cookieJarKey, (cookieJarDetails) => {
        const { tabIds, cookieJar } = cookieJarDetails[cookieJarKey] || {};
        resolve([cookieJarId, tabIds, CookieJar.unmarshal(cookieJar)]);
      });
    });
  });

export const saveCookieJar = async (cookieJarId, tabIds, cookieJar) => {
  if (cookieJarId === undefined) {
    cookieJarId = crypto.randomUUID();
  }

  // TODO could optimize this / don't always need to save _all_ tabIds here
  const val = { cookieJarId },
    toSet = {};
  // TODO can this be cleaner
  for (const tabId of tabIds) {
    toSet[`tab_${tabId}`] = val;
  }
  await chrome.storage.session.set(toSet);

  return chrome.storage.session.set({
    [`cookie_jar_${cookieJarId}`]: {
      cookieJar,
      tabIds,
    },
  });
};
