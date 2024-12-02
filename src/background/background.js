/*
Notes:
TODO: handle user opening new tab from existing window
TODO remove rules when a hooked tab navigates away from AWS, or the tab closes. also delete the cookie jar. maybe with some grace window in case someone navigates away, then clicks back
TODO: rename to multiple-aws-sessions

NEXT STEPS PICK UP FROM HERE:
- figure out why clearing aws-userInfo cookies logs me out, they should be sent as part of server request
*/

import { Cookie } from './cookie.js';
import { CookieJar, cookieHeader } from './cookie_jar.js';
import { sessionRulesFromCookieJar } from './session_rules.js';

const REQUEST_MAP = 'request_map';
const COOKIE_JARS = 'cookie_jars';

// Don't hook on non-https urls
const INTERCEPT_URLS = ['*://*.aws.amazon.com/*'];
const INTERCEPT_COOKIES = {
  'aws-userInfo': true,
  'aws-userInfo-signed': true,
  'aws-creds': true,
};

// TODO cleanup
const getNextRuleId = async () => {
  const { rule_id } = await chrome.storage.session.get('rule_id');
  const result = rule_id === undefined ? 1 : rule_id;
  // console.log('getNextRuleId', result);
  return result;
};

const saveRuleId = async (id) => {
  // console.log('saveRuleId', id);
  await chrome.storage.session.set({ rule_id: id });
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
    // types: ['main_frame'],
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

    // return
    // TODO does this affect other extensions / do I need to limit this to only my rules?
    const existingSessionRules = await chrome.declarativeNetRequest.getSessionRules();
    const ruleIds = existingSessionRules
      .filter((rule) => (rule.condition.tabIds || []).includes(tabId))
      .map((rule) => rule.id);
    const ruleIdStart = await getNextRuleId();
    const rules = sessionRulesFromCookieJar(cookieJar, tabId, ruleIdStart);
    const deets = {
      removeRuleIds: ruleIds,
      addRules: rules,
    };
    // console.log('updateSessionRules', deets);
    // TODO could try approach where I do an initial set header, then append with a bunch of rules of lower priority. might be simpler?
    // chrome.declarativeNetRequest.updateSessionRules(deets);
    await saveRuleId(ruleIdStart + rules.length);

    const tab = await chrome.tabs.get(tabId);
    if (tab.url !== undefined) {
      const tabUrl = new URL(tab.url);

      try {
        const matching = cookieJar.matching({ domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false });
        // console.log('calling matching with', { domain: tabUrl.hostname, path: tabUrl.pathname, httponly: false }, 'got ', matching, 'all cookies', cookieJar.getCookies())
        await chrome.tabs.sendMessage(tabId, {
          cookies: cookieHeader(matching),
          type: 'set-cookies',
        });
      } catch (err) {
        // On page load the content script isn't loaded / listening yet
        // console.log('Error sending message to tabs', err);
      }
    }
  },
  {
    urls: INTERCEPT_URLS,
    // types: ['main_frame'],
  },
  ['responseHeaders', 'extraHeaders'],
);

// const clearAllSessionRules = async () => {
//   const ruleIds = (await chrome.declarativeNetRequest.getSessionRules()).map((rule) => rule.id);
//   console.log('Clearing rule ids', ruleIds);
//   chrome.declarativeNetRequest.updateSessionRules({
//     removeRuleIds: ruleIds,
//   });
// };
// clearAllSessionRules();

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
  console.log('onRuleMatchedDebug', details);
});

(() => {
  const eventHandlers = {
    'set-cookies': (message, tabId, cookieJar) => {},
    'loaded': (message, tabId, cookieJar) => {},
  };
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (Object.hasOwn(eventHandlers, message.type) === false) {
      return;
    }

    // return if send.tab not set

    // TODO get cookie jar for current tab
    const cookieJar = new CookieJar();
    if (cookieJar.length === 0) {
      return;
    }

    eventHandlers[message.type](message, sender.tab.id, cookieJar);
  });
})();
