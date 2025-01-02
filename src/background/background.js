import { CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';
import { Cookie, cookieHeader } from 'background/cookie.js';
import { MAX_RULE_ID, sessionRulesFromCookieJar } from 'background/session_rules.js';
import {
  addCookiesToJar,
  clearOldRequestKeys,
  getCookieJarFromTabId,
  getTabIdFromRequestId,
  removeTabId,
  setCookieJarIdForTab,
  setTabIdForRequestId,
} from 'background/storage.js';
import { onHeadersReceivedOptions, supportsListingSessionStorageKeys } from 'background/browser.js';
import { RESOURCE_TYPES } from 'background/common.js';

const INTERCEPT_URL = '*://*.aws.amazon.com/*';

// TODO: remove after the race condition refactoring
(async () => {
  if (supportsListingSessionStorageKeys === false) {
    console.warn('Listing storage keys is not supported, old storage will not be reaped');
    return;
  }

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

const sendUpdatedCookiesToTabs = (cookieJar, tabIds) => {
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

  // Promise.allSettled swallows exceptions which is fine, we don't care about "Error: No tab with id: <id>."
  return Promise.allSettled(promises);
};

const updateSessionRules = (cookieJar, tabIds) => {
  const updateSessionRulesLock = navigator.locks.request('updateSessionRules', async () => {
    const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
    const ruleIdStart =
      existingSessionRules.length > 0 ? existingSessionRules[existingSessionRules.length - 1].id + 1 : 0;
    const addRules = sessionRulesFromCookieJar(cookieJar, tabIds, ruleIdStart);
    const removeRuleIds = existingSessionRules
      .filter((rule) => (rule.condition.tabIds || []).some((tabId) => tabIds.includes(tabId)))
      .map((rule) => rule.id);
    await chrome.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds });
  });

  return Promise.all([updateSessionRulesLock, sendUpdatedCookiesToTabs(cookieJar, tabIds)]);
};

// If a new tab is opened from a tab we're hooking, make sure the new tab gets the same cookies as the existing tab
chrome.tabs.onCreated.addListener(async (details) => {
  const tabIds = await setCookieJarIdForTab(
    details.id,
    typeof details.pendingUrl === 'undefined' ? void 0 : details.openerTabId,
  );

  const cookieJar = await getCookieJarFromTabId(details.id);
  if (cookieJar.length() === 0) {
    return;
  }

  updateSessionRules(cookieJar, tabIds);
});

// This does not update any session rules, only removes storage
chrome.tabs.onRemoved.addListener(removeTabId);

// Keep track of what tabs are initiating which requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    setTabIdForRequestId(details.requestId, details.tabId);
  },
  {
    types: RESOURCE_TYPES,
    urls: [INTERCEPT_URL],
  },
);

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    for (const header of details.responseHeaders) {
      if (header.name === 'set-cookie') {
        // In Chrome every set-cookie header is a separate array entry in details.responseHeaders
        // In Firefox there is a single set-cookie header, with all values joined together with newlines
        for (const cookieHeaderValue of header.value.split('\n')) {
          cookies.push(new Cookie(cookieHeaderValue, details.url));
        }
      }
    }

    // If we got no cookies in this request, return immediately
    if (cookies.length === 0) {
      return;
    }

    const tabId = await getTabIdFromRequestId(details.requestId);
    if (typeof tabId === 'undefined') {
      console.warn(`Received cookies for request ${details.requestId} with no corresponding tabId`);
      return;
    }

    const [tabIds, cookieJar] = await addCookiesToJar(tabId, cookies, details.url, false);
    await updateSessionRules(cookieJar, tabIds);
  },
  {
    types: RESOURCE_TYPES,
    urls: [INTERCEPT_URL],
  },
  onHeadersReceivedOptions,
);

/**
 * Message passing with tabs
 */
(() => {
  const eventHandlers = {
    [CMD_LOADED]: async (_message, tab) => {
      const cookieJar = await getCookieJarFromTabId(tab.id);
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, httponly: false, path: tabUrl.pathname });
      chrome.tabs.sendMessage(tab.id, {
        cookies: cookieHeader(matching),
        masType: CMD_INJECT_COOKIES,
      });
    },
    [CMD_PARSE_NEW_COOKIE]: async (message, tab) => {
      const [tabIds, cookieJar] = await addCookiesToJar(tab.id, [message.cookies], tab.url, true);
      await updateSessionRules(cookieJar, tabIds);
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
 * Clear all existing session rules and storage on reload
 */

(() => {
  // Add this rule on load / have this always be set
  // This ensures that
  // 1) later append operations are appending onto a blank slate, and
  // 2) navigating to AWS in a manually opened new tab (e.g. via cmd+T and pasting the url) doesn't get some residual browser cookies
  const addRules = [
    {
      action: {
        requestHeaders: [
          {
            header: 'cookie',
            operation: 'set',
            value: '',
          },
        ],
        type: 'modifyHeaders',
      },
      condition: {
        resourceTypes: RESOURCE_TYPES,
        urlFilter: INTERCEPT_URL,
      },
      id: 1,
      priority: MAX_RULE_ID,
    },
  ];

  chrome.runtime.onInstalled.addListener(async () => {
    chrome.storage.session.clear();
    const removeRuleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
    chrome.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds });
  });

  chrome.runtime.onStartup.addListener(() => {
    chrome.declarativeNetRequest.updateSessionRules({ addRules });
  });
})();
