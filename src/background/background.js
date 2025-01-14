import { CLEAR_RULE, sessionRulesFromCookieJar } from 'background/session_rules.js';
import { CMD_INJECT_COOKIES, CMD_LOADED, CMD_PARSE_NEW_COOKIE } from 'shared.js';
import { Cookie, cookieHeader } from 'background/cookie.js';
import { INTERCEPT_URL, RESOURCE_TYPES } from 'background/common.js';
import { CookieJarStorage } from 'background/storage/cookie_jar.js';
import { TabHookStorage } from './storage/tab_hook.js';

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

// TODO document / move to storage
// const tabRulesUpdated = {};

// If a new tab is opened from a tab we're hooking, make sure the new tab gets the same cookies as the existing tab
chrome.tabs.onCreated.addListener(async (details) => {
  console.log('tabs.onCreated', details);
  TabHookStorage.pauseTabNavigation(details.id, details.openerTabId)
  // const { promise, resolve } = Promise.withResolvers();
  // tabRulesUpdated[details.id] = { openerTabId: details.openerTabId, resolve };

  // Need to test this logic for firefox + others
  const openerTabId =
    typeof details.pendingUrl === 'undefined' && details.status !== 'complete' ? void 0 : details.openerTabId;

  const cookieJar = await CookieJarStorage.getCookieJarFromTabId(details.openerTabId);
  // This is very subtle usage of when to use which openerTabId / needs more documentation
  const tabIds = await CookieJarStorage.setCookieJarIdForTab(
    details.id,
    cookieJar.length() === 0 ? void 0 : openerTabId,
  );

  if (cookieJar.length() === 0) {
    TabHookStorage.resumeTabNavigation(details.id)
    return;
  }

  await updateSessionRules(cookieJar, tabIds);
  const url = TabHookStorage.resumeTabNavigation(details.id);
  console.log('tabCreated url', url)
  await chrome.tabs.update(details.id, { url });
});

// This does not update any session rules, only removes storage
chrome.tabs.onRemoved.addListener(CookieJarStorage.removeTabId);

['onBeforeNavigate', 'onCommitted'].forEach((event) => {
  chrome.webNavigation[event].addListener(
    async (details) => {
      if (details.frameType !== 'outermost_frame') {
        return;
      }

      // if (TabHookStorage.isPaused(details.tabId)) {
      //   return;
      // }

      const tabId = TabHookStorage.cookieTabForTabId(details.tabId)
      if (typeof tabId === 'undefined') {
        return;
      }

      console.log(`chrome.webNavigation.${event}`, details);

      const cookieJar = await CookieJarStorage.getCookieJarFromTabId(tabId);
      if (cookieJar.length() === 0) {
        // TabHookStorage.resumeTabNavigation(details.id)
        return;
      }

      TabHookStorage.updateValue(details.tabId, details.url);
      console.log(`${event} updating to about:blank`)
      await chrome.tabs.update(details.tabId, { url: 'about:blank' });
    },
    {
      url: [
        {
          hostSuffix: 'aws.amazon.com', // TODO
        },
      ],
    },
  );
});

// TODO
// onSendHeaders seems to be the earliest point in the lifecycle that this can work
// add more detailed comment / diagrams
// could consider hooking all and seeing which ones fires first, that seems safe
// chrome.webRequest.onBeforeSendHeaders.addListener(
//   async (details) => {
//     console.log('webRequest.onBeforeSendHeaders', details)
//     if (
//       details.type === 'main_frame' &&
//       details.frameType === 'outermost_frame' &&
//       Object.hasOwn(tabRulesUpdated, details.tabId)
//     ) {
//       const { resolve, openerTabId } = tabRulesUpdated[details.tabId];
//       delete tabRulesUpdated[details.tabId];

//       const cookieJar = await CookieJarStorage.getCookieJarFromTabId(openerTabId);
//       if (cookieJar.length() === 0) {
//         return;
//       }

//       await chrome.tabs.update(details.tabId, { url: 'about:blank' });
//       resolve(details.url);
//     }
//   },
//   {
//     types: ['main_frame'],
//     urls: [INTERCEPT_URL],
//   },
// );

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    let location, isRedirect;
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

    // TODO remove
    if (typeof details.tabId === 'undefined') {
      console.error('onHeadersReceived with tabId undefined', details);
    }
    // TODO can just use details.tabId below
    const tabId = details.tabId;

    // If we got a redirect response with Set-Cookie headers, the tab will follow the redirect before our updated rules get saved
    // Work around this by updating the tab to go to about:blank until the rules get updated, at which point we go back to the original url
    // let promise, resolve;
    if (
      details.frameType === 'outermost_frame' &&
      details.type === 'main_frame' &&
      details.method === 'GET' &&
      (details.statusCode === 301 || details.statusCode === 302)
    ) {
      console.log('onHeadersReceived with redirect, updating to about:blank', details);
      // TODO dry up with the above / move into storage
      // Also rename openerTabId to tabId
      isRedirect = true;
      await chrome.tabs.update(tabId, { url: 'about:blank' });
    }

    const [tabIds, cookieJar] = await CookieJarStorage.addCookiesToJar(tabId, cookies, details.url, false);
    await updateSessionRules(cookieJar, tabIds);

    if (isRedirect === true) {
      console.log('onHeadersReceived with redirect, updating url to ', location)
      await chrome.tabs.update(tabId, { url: location });
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
    [CMD_LOADED]: async (_message, tab) => {
      const cookieJar = await CookieJarStorage.getCookieJarFromTabId(tab.id);
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, httponly: false, path: tabUrl.pathname });
      chrome.tabs.sendMessage(tab.id, {
        cookies: cookieHeader(matching),
        masType: CMD_INJECT_COOKIES,
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
