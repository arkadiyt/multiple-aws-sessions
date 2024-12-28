import { Cookie, cookieHeader } from 'background/cookie.js';
import {
  getCookieJarFromRequestId,
  getCookieJarFromTabId,
  getNextRuleId,
  saveCookieJar,
  saveRuleId,
  setTabIdForRequestId,
} from 'background/storage.js';
import { RESOURCE_TYPES } from 'background/common.js';
import { sessionRulesFromCookieJar } from 'background/session_rules.js';
import { CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';

const INTERCEPT_URLS = ['*://*.aws.amazon.com/*'];
/**
   * TODO
timers:
- once a minute, reap old request_id keys
- once a minute, delete unreferenced cookiejars
   */

// TODO cleanup

const sendUpdatedCookiesToTabs = async (cookieJar, tabIds) => {
  const promises = [];
  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(tabId);
    if (typeof tab.url === 'undefined') {
      continue;
    }

    const tabUrl = new URL(tab.url);
    const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
    promises.push(
      chrome.tabs.sendMessage(tabId, {
        cookies: cookieHeader(matching),
        masType: CMD_INJECT_COOKIES,
      }),
    );
  }

  try {
    await Promise.allSettled(promises);
  } catch (err) {
    // Safe to ignore "Error: No tab with id: <id>."
    console.warn(err);
  }
};

// If a new tab is opened from a tab we're hooking, make sure the new tab gets the same cookies as the existing tab
chrome.tabs.onCreated.addListener(async (details) => {
  if (typeof details.openerTabId === 'undefined') {
    return;
  }

  const [cookieJarId, tabIds, cookieJar] = await getCookieJarFromTabId(details.openerTabId);
  tabIds.push(details.id);
  saveCookieJar(cookieJarId, tabIds, cookieJar);
  updateSessionRules(cookieJar, tabIds);
});

chrome.tabs.onRemoved.addListener((details) => {
  // Delete tabid -> cookieid storage
  // Delete tab from cookiejar storage
});

// Keep track of what tabs are initiating which requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    setTabIdForRequestId(details.requestId, details.tabId);
  },
  {
    urls: INTERCEPT_URLS,
    types: RESOURCE_TYPES,
  },
);

const updateSessionRules = async (cookieJar, tabIds) => {
  const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const ruleIds = existingSessionRules
    .filter((rule) => (rule.condition.tabIds || []).some((tabId) => tabIds.includes(tabId)))
    .map((rule) => rule.id);
  const ruleIdStart = await getNextRuleId();
  const rules = sessionRulesFromCookieJar(cookieJar, tabIds, ruleIdStart);
  /*Await*/ chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
    addRules: rules,
  });
  await saveRuleId(ruleIdStart + rules.length);

  sendUpdatedCookiesToTabs(cookieJar, tabIds);
};

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

    let cookieJar;
    let cookieJarId;
    let tabIds;
    try {
      [cookieJarId, tabIds, cookieJar] = await getCookieJarFromRequestId(details.requestId);
    } catch (err) {
      console.warn(err);
      return;
    }
    // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
    cookieJar.upsertCookies(cookies, details.url);
    /*Await*/ saveCookieJar(cookieJarId, tabIds, cookieJar);

    /*Await*/ updateSessionRules(cookieJar, tabIds);
  },
  {
    urls: INTERCEPT_URLS,
    types: RESOURCE_TYPES,
  },
  ['responseHeaders', 'extraHeaders'],
);

/**
 * Message passing with tabs
 */
(() => {
  const eventHandlers = {
    // TODO move these string values (loaded, parse-new-cookie) into shared file between background and content script
    [CMD_LOADED]: async (_message, tab) => {
      const [, , cookieJar] = await getCookieJarFromTabId(tab.id);
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
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
 * Debugging
 */
(async () => {
  // Clear all existing session rules and storage on load
  const ruleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
  });
  await chrome.storage.session.clear();
})();
