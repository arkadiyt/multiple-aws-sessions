import { CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';
import { Cookie, cookieHeader } from 'background/cookie.js';
import {
  clearOldRequestKeys,
  getCookieJarFromTabId,
  getNextRuleId,
  getTabIdFromRequestId,
  removeTabId,
  saveCookieJar,
  saveRuleId,
  setTabIdForRequestId,
} from 'background/storage.js';
import { RESOURCE_TYPES } from 'background/common.js';
import { sessionRulesFromCookieJar } from 'background/session_rules.js';

const INTERCEPT_URLS = ['*://*.aws.amazon.com/*'];

(async () => {
  const ALARM_NAME = 'reaper';
  const EXPIRE_AFTER = 60000;

  const alarm = await chrome.alarms.get(ALARM_NAME);
  if (!alarm) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }

  chrome.alarms.onAlarm.addListener((details) => {
    if (details.name !== ALARM_NAME) {
      return;
    }

    clearOldRequestKeys(EXPIRE_AFTER);
  });
})();

const sendUpdatedCookiesToTabs = async (cookieJar, tabIds) => {
  const promises = tabIds.map((tabId) =>
    chrome.tabs.get(tabId).then((tab) => {
      if (typeof tab.url === 'undefined') {
        return void 0;
      }

      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, httponly: false, path: tabUrl.pathname });
      return chrome.tabs.sendMessage(tabId, {
        cookies: cookieHeader(matching),
        masType: CMD_INJECT_COOKIES,
      });
    }),
  );

  try {
    await Promise.allSettled(promises);
  } catch (err) {
    // Safe to ignore "Error: No tab with id: <id>."
    console.warn(err);
  }
};

const updateSessionRules = async (cookieJar, tabIds) => {
  const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const ruleIds = existingSessionRules
    .filter((rule) => (rule.condition.tabIds || []).some((tabId) => tabIds.includes(tabId)))
    .map((rule) => rule.id);
  const ruleIdStart = await getNextRuleId();
  const rules = sessionRulesFromCookieJar(cookieJar, tabIds, ruleIdStart);

  return Promise.allSettled([
    chrome.declarativeNetRequest.updateSessionRules({
      addRules: rules,
      removeRuleIds: ruleIds,
    }),
    saveRuleId(ruleIdStart + rules.length),
    sendUpdatedCookiesToTabs(cookieJar, tabIds),
  ]);
};

// If a new tab is opened from a tab we're hooking, make sure the new tab gets the same cookies as the existing tab
chrome.tabs.onCreated.addListener(async (details) => {
  if (typeof details.openerTabId === 'undefined') {
    return;
  }

  const [cookieJarId, tabIds, cookieJar] = await getCookieJarFromTabId(details.openerTabId);
  if (typeof cookieJarId === 'undefined') {
    return;
  }

  tabIds.push(details.id);
  saveCookieJar(cookieJarId, tabIds, cookieJar);
  updateSessionRules(cookieJar, tabIds);
});

// TODO also need to update session rules here (remove from old tabs)
chrome.tabs.onRemoved.addListener(removeTabId);

// Keep track of what tabs are initiating which requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    setTabIdForRequestId(details.requestId, details.tabId);
  },
  {
    types: RESOURCE_TYPES,
    urls: INTERCEPT_URLS,
  },
);

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    for (const header of details.responseHeaders) {
      if (header.name === 'set-cookie') {
        // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
        cookies.push(new Cookie(header.value, details.url));
      }
    }

    if (cookies.length === 0) {
      return;
    }

    const tabId = await getTabIdFromRequestId(details.requestId);
    if (typeof tabId === 'undefined') {
      console.warn(`Received headers for request ${details.requestId} with no corresponding tabId`);
      return;
    }
    const [cookieJarId, tabIds, cookieJar] = await getCookieJarFromTabId(tabId);

    // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
    cookieJar.upsertCookies(cookies, details.url);
    saveCookieJar(cookieJarId, tabIds, cookieJar);
    updateSessionRules(cookieJar, tabIds);
  },
  {
    types: RESOURCE_TYPES,
    urls: INTERCEPT_URLS,
  },
  ['responseHeaders', 'extraHeaders'],
);

/**
 * Message passing with tabs
 */
(() => {
  const eventHandlers = {
    [CMD_LOADED]: async (_message, tab) => {
      const [, , cookieJar] = await getCookieJarFromTabId(tab.id);
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, httponly: false, path: tabUrl.pathname });
      chrome.tabs.sendMessage(tab.id, {
        cookies: cookieHeader(matching),
        masType: CMD_INJECT_COOKIES,
      });
    },
    [CMD_PARSE_NEW_COOKIE]: async (message, tab) => {
      const [cookieJarId, tabIds, cookieJar] = await getCookieJarFromTabId(tab.id);
      cookieJar.upsertCookies([message.cookies], tab.url);
      saveCookieJar(cookieJarId, tabIds, cookieJar);
      sendUpdatedCookiesToTabs(cookieJar, tabIds);
    },
  };
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) {
      return;
    }

    if (typeof sender.tab === 'undefined') {
      return;
    }

    if (Object.hasOwn(eventHandlers, message.masType) === false) {
      return;
    }

    eventHandlers[message.masType](message, sender.tab);
  });
})();

/**
 * Clear all existing session rules and storage on load
 */
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.session.clear();
  const removeRuleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
});
