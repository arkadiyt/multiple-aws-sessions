import { CLEAR_RULE, sessionRulesFromCookieJar } from 'background/session_rules.js';
import { CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';
import { Cookie, cookieHeader } from 'background/cookie.js';
import { INTERCEPT_URL, RESOURCE_TYPES } from 'background/common.js';
import { CookieJarStorage } from 'background/storage/cookie_jar.js';

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
  console.log('tabs.onCreated', details);
  // Need to test this logic for firefox + others
  const openerTabId =
    typeof details.pendingUrl === 'undefined' && details.status !== 'complete' ? void 0 : details.openerTabId;

  const cookieJar = await CookieJarStorage.getCookieJarFromTabId(details.openerTabId);
  // TODO This is very subtle usage of when to use which openerTabId / needs more documentation
  const tabIds = await CookieJarStorage.setCookieJarIdForTab(
    details.id,
    cookieJar.length() === 0 ? void 0 : openerTabId,
  );

  if (cookieJar.length() === 0) {
    return;
  }

  await updateSessionRules(cookieJar, tabIds);
});

// This does not update any session rules, only removes storage
chrome.tabs.onRemoved.addListener(CookieJarStorage.removeTabId);

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    for (const header of details.responseHeaders) {
      if (header.name.toLowerCase() === 'set-cookie') {
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

    const url = new URL(details.url);
    // Chrome sets initiator, Firefox sets originUrl
    const initiator = new URL(details.initiator || details.originUrl);
    // Ugly hack :(
    // Sign in gives a 401 sometimes due to a race condition, and reloading the page fixes it
    // TODO find a more elegant solution
    if (
      details.statusCode === 401 &&
      details.parentFrameId === -1 &&
      details.method === 'GET' &&
      initiator.hostname === 'signin.aws.amazon.com' &&
      details.type === 'main_frame' &&
      url.hostname === 'console.aws.amazon.com' &&
      url.pathname === '/console/home' &&
      url.searchParams.get('code') !== null
    ) {
      chrome.tabs.update(details.tabId, { url: details.url });
    }

    const [tabIds, cookieJar] = await CookieJarStorage.addCookiesToJar(details.tabId, cookies, details.url, false);
    await updateSessionRules(cookieJar, tabIds);
  },
  {
    types: RESOURCE_TYPES,
    urls: [INTERCEPT_URL],
  },
  /**
   * When calling chrome.webRequest.onHeadersReceived.addListener, the last option specifies whether or not response
   * headers should be included. In Firefox and others just specifying "responseHeaders" is sufficient. For Chrome it used to be,
   * but starting in Chrome 72 you need to specify "extraHeaders" to receive the Cookie header and some other sensitive headers.
   * Specifying this option causes an error in Firefox, so the value below contains the right options to include depending on
   * whether the current browser needs it or not
   */
  ['responseHeaders', chrome.webRequest.OnHeadersReceivedOptions.EXTRA_HEADERS].filter(
    (opt) => typeof opt !== 'undefined',
  ),
);

/**
 * Message passing with tabs
 */
(() => {
  const eventHandlers = {
    [CMD_LOADED]: async (_message, tab) => {
      const cookieJar = await CookieJarStorage.getCookieJarFromTabId(tab.id);
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, httponly: false, path: tabUrl.pathname });

      chrome.tabs
        .sendMessage(tab.id, {
          cookies: cookieHeader(matching),
          masType: CMD_INJECT_COOKIES,
        })
        .catch(() => {
          // Ignore "Error: Could not establish connection. Receiving end does not exist." errors
          // This can happen if the tab sends us this message but then navigates away and has no
          // listener by the time we process this message. This is safe to ignore, the new page navigation
          // will request cookies once it loads
        });
    },
    [CMD_PARSE_NEW_COOKIE]: async (message, tab) => {
      const [tabIds, cookieJar] = await CookieJarStorage.addCookiesToJar(tab.id, [message.cookies], tab.url, true);
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
 * Initialization
 */
(() => {
  const init = async () => {
    await chrome.storage.session.clear();

    // Setup initial session rule
    const removeRuleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
    await chrome.declarativeNetRequest.updateSessionRules({ addRules: [CLEAR_RULE], removeRuleIds });

    // Setup initial tabs
    const tabIds = (await chrome.tabs.query({})).map((tab) => tab.id);
    CookieJarStorage.setCookieJarsForInitialTabs(tabIds);
  };

  chrome.runtime.onStartup.addListener(init);
  chrome.runtime.onInstalled.addListener(init);
})();
