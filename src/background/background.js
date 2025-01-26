import 'selenium/background.js';
import { CLEAR_RULE, sessionRulesFromCookieJar } from 'background/session_rules.js';
import { CMD_COLOR, CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';
import { Cookie, cookieHeader } from 'background/cookie.js';
import { INTERCEPT_URL, RESOURCE_TYPES } from 'background/common.js';
import { CookieJarStorage } from 'background/storage/cookie_jar.js';
import { SettingsStorage } from './storage/settings.js';

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

// TODO cleanup/refactor
const tabRulesUpdated = {};
// If a new tab is opened from a tab we're hooking, make sure the new tab gets the same cookies as the existing tab
chrome.tabs.onCreated.addListener(async (details) => {
  const { promise, resolve } = Promise.withResolvers();
  tabRulesUpdated[details.id] = { openerTabId: details.openerTabId, resolve };
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
  const url = await promise;
  await chrome.tabs.update(details.id, { url });
});

// TODO
// onSendHeaders seems to be the earliest point in the lifecycle that this can work
// add more detailed comment / diagrams
// could consider hooking all and seeing which ones fires first, that seems safe
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    if (details.parentFrameId === -1 && Object.hasOwn(tabRulesUpdated, details.tabId)) {
      const { resolve, openerTabId } = tabRulesUpdated[details.tabId];
      delete tabRulesUpdated[details.tabId];

      const cookieJar = await CookieJarStorage.getCookieJarFromTabId(openerTabId);
      if (cookieJar.length() === 0) {
        return;
      }

      await chrome.tabs.update(details.tabId, { url: 'about:blank' });
      resolve(details.url);
    }
  },
  {
    types: ['main_frame'],
    urls: [INTERCEPT_URL],
  },
);

// This does not update any session rules, only removes storage
chrome.tabs.onRemoved.addListener(CookieJarStorage.removeTabId);

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    let location = void 0;
    let isRedirect = void 0;

    for (const header of details.responseHeaders) {
      const headerName = header.name.toLowerCase();

      if (headerName === 'set-cookie') {
        // In Chrome every set-cookie header is a separate array entry in details.responseHeaders
        // In Firefox there is a single set-cookie header, with all values joined together with newlines
        for (const cookieHeaderValue of header.value.split('\n')) {
          cookies.push(new Cookie(cookieHeaderValue, details.url));
        }
      } else if (headerName === 'location') {
        location = header.value;
      }
    }

    // If we got no cookies in this request, return immediately
    if (cookies.length === 0) {
      return;
    }

    if (
      details.parentFrameId === -1 &&
      details.type === 'main_frame' &&
      details.method === 'GET' &&
      (details.statusCode === 301 || details.statusCode === 302)
    ) {
      // TODO dry up with the above / move into storage
      isRedirect = true;
      await chrome.tabs.update(details.tabId, { url: 'about:blank' });
    }

    const [tabIds, cookieJar] = await CookieJarStorage.addCookiesToJar(details.tabId, cookies, details.url, true);
    await updateSessionRules(cookieJar, tabIds);

    if (isRedirect === true) {
      await chrome.tabs.update(details.tabId, { url: location });
      return;
    }

    const url = new URL(details.url);
    // Chrome sets initiator, Firefox sets originUrl
    if (details.initiator || details.originUrl) {
      const initiator = new URL(details.initiator || details.originUrl);
      // Ugly hack :(
      // Root user sign-in gives a 401 sometimes due to a race condition, and reloading the page fixes it
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
    }
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
    [CMD_COLOR]: async (message, _tab, sendResponse) => {
      // TODO be consistent between existing message passing and sendResponse
      if (message.color) {
        // Save new color
        await SettingsStorage.saveColorForAccount(message.accountId, message.color);
      } else {
        // Reply with existing color
        sendResponse(await SettingsStorage.getColorForAccount(message.accountId));
      }
    },
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
      const [tabIds, cookieJar] = await CookieJarStorage.addCookiesToJar(tab.id, [message.cookies], tab.url, false);
      await updateSessionRules(cookieJar, tabIds);
    },
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    if (typeof sender.tab === 'undefined') {
      return false;
    }

    if (Object.hasOwn(eventHandlers, message.masType) === false) {
      return false;
    }

    eventHandlers[message.masType](message, sender.tab, sendResponse);

    // Need to return true to keep the sendResponse handle valid for an async response:
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage
    return true;
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
