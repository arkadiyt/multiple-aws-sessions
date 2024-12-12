import { RESOURCE_TYPES } from './common.js';
import { Cookie, cookieHeader } from './cookie.js';
import { CookieJar } from './cookie_jar.js';
import { sessionRulesFromCookieJar } from './session_rules.js';

const REQUEST_MAP = 'request_map';
const COOKIE_JARS = 'cookie_jars';

const INTERCEPT_URLS = ['*://*.aws.amazon.com/*'];
const INTERCEPT_COOKIES = {
  'aws-userInfo': true,
  'aws-userInfo-signed': true,
  'aws-creds': true,
};

// TODO cleanup
const getNextRuleId = async () => {
  const { ruleId } = await chrome.storage.session.get('ruleId');
  const result = ruleId === undefined ? 1 : ruleId;
  return result;
};

const saveRuleId = async (id) => {
  await chrome.storage.session.set({ ruleId: id });
};

const getTabIdFromRequestId = (requestId) =>
  new Promise(async (resolve) => {
    const requestMap = (await chrome.storage.session.get(REQUEST_MAP))[REQUEST_MAP] || {};
    return resolve(requestMap[requestId]);
  });

const setTabIdForRequestId = (requestId, tabId) =>
  new Promise(async (resolve) => {
    const requestMap = (await chrome.storage.session.get(REQUEST_MAP))[REQUEST_MAP] || {};
    requestMap[requestId] = tabId;
    chrome.storage.session.set({ [REQUEST_MAP]: requestMap }, resolve);

    // Don't let the map grow unbounded
    // TODO convert to alarms api: https://developer.chrome.com/docs/extensions/reference/api/alarms
    // https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#convert-timers
    // setTimeout(function() {
    //   delete requestToTabMap[details.requestId];
    // }, 60000);
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

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const cookies = [];
    for (const header of details.responseHeaders) {
      if (header.name === 'set-cookie') {
        // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
        const cookie = new Cookie(header.value, details.url);
        if (INTERCEPT_COOKIES[cookie.name] || cookie.name.startsWith('aws')) {
          cookies.push(cookie);
        }
      }
    }

    if (cookies.length === 0) {
      return;
    }

    const tabIdPromise = getTabIdFromRequestId(details.requestId);
    const cookieJarsPromise = chrome.storage.session.get(COOKIE_JARS);
    const tabId = await tabIdPromise;
    if (tabId === undefined) {
      console.log('Undefined tabid for request', details.requestId, details);
      return;
    }
    const cookieJars = (await cookieJarsPromise)[COOKIE_JARS] || {};

    const cookieJar = Object.hasOwn(cookieJars, tabId) ? CookieJar.unmarshal(cookieJars[tabId]) : new CookieJar();
    // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?

    cookieJar.upsertCookies(cookies, details.url);

    cookieJars[tabId] = cookieJar;
    chrome.storage.session.set({ [COOKIE_JARS]: cookieJars });

    const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
    const ruleIds = existingSessionRules
      .filter((rule) => (rule.condition.tabIds || []).includes(tabId))
      .map((rule) => rule.id);
    const ruleIdStart = await getNextRuleId();
    const rules = sessionRulesFromCookieJar(cookieJar, tabId, ruleIdStart);
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: ruleIds,
      addRules: rules,
    });
    await saveRuleId(ruleIdStart + rules.length);

    const tab = await chrome.tabs.get(tabId);
    if (tab.url !== undefined) {
      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
      try {
        await chrome.tabs.sendMessage(tabId, {
          cookies: cookieHeader(matching),
          type: 'inject-cookies',
        });
      } catch (err) {}
    }
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
    'loaded': async (_, tab) => {
      // TODO dry-up with the tab sending above

      const cookieJars = (await chrome.storage.session.get(COOKIE_JARS))[COOKIE_JARS] || {};
      const cookieJar = Object.hasOwn(cookieJars, tab.id) ? CookieJar.unmarshal(cookieJars[tab.id]) : new CookieJar();

      const tabUrl = new URL(tab.url);
      const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
      chrome.tabs.sendMessage(tab.id, {
        cookies: cookieHeader(matching),
        type: 'inject-cookies',
      });
    },
    'parse-new-cookie': async (message, tab) => {
      const tabUrl = new URL(tab.url);

      // TODO dry this up
      const cookieJars = (await chrome.storage.session.get(COOKIE_JARS))[COOKIE_JARS] || {};
      const cookieJar = Object.hasOwn(cookieJars, tab.id) ? CookieJar.unmarshal(cookieJars[tab.id]) : new CookieJar();
      cookieJar.upsertCookies([message.cookies], tab.url);
      cookieJars[tab.id] = cookieJar;
      chrome.storage.session.set({ [COOKIE_JARS]: cookieJars });
      const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
      chrome.tabs.sendMessage(tab.id, {
        cookies: cookieHeader(matching),
        type: 'inject-cookies',
      });
    },
  };
  chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (sender.id !== chrome.runtime.id) {
      return;
    }

    if (sender.tab === undefined) {
      return;
    }

    if (Object.hasOwn(eventHandlers, message.type) === false) {
      return;
    }

    eventHandlers[message.type](message, sender.tab);
  });
})();

/**
 * Debugging
 */
(async () => {
  const ruleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
  });
})();
