/*
Notes:
- listening to all tabs definitely works (need onbeforerequest and onheadersreceived)
- need to keep a map of requestid -> tabid, and also prune the table so it doesn't grow unbounded

- add eslint/autoformatting/etc
- tests?
- all TODOs
- inject content script to show which account you're signed into
// TODO: handle user opening new tab from existing window
// TODO: remove rules when a hooked tab navigates away from AWS
*/

import { Cookie, CookieJar, CookieAccessInfo } from 'cookiejar';

const REQUEST_MAP = "request_map";
const COOKIE_JARS = "cookie_jars";

// Don't hook on non-https urls
const INTERCEPT_URLS = [
  "https://*.aws.amazon.com/*" 
];
const INTERCEPT_COOKIES = {
  'aws-userInfo': true,
  'aws-userInfo-signed': true,
  'aws-creds': true,
};

// TODO cleanup
const ruleIds = {}
let ruleCount = 0;
function getRuleId(tabId, domain) {
  const key = tabId + '-' + domain
  if (!(key in ruleIds)) {
    ruleIds[key] = ++ruleCount;
  }
  return ruleIds[key]
}

function marshalCookieJar(cookieJar) {
  return cookieJar.getCookies(CookieAccessInfo.All).map(cookie => {
    return {
      name: cookie.name,
      value: cookie.value,
      expiration_date: cookie.expiration_date,
      path: cookie.path,
      explicit_path: cookie.explicit_path,
      domain: cookie.domain,
      explicit_domain: cookie.explicit_domain,
      secure: cookie.secure,
      noscript: cookie.noscript
    }
  })
}

function unmarshalCookieJar(objects) {
  const cookieJar = new CookieJar()
  cookieJar.setCookies(objects.map(obj => {
    const cookie = new Cookie();
    cookie.name = obj.name
    cookie.value = obj.value
    cookie.expiration_date = obj.expiration_date
    cookie.path = obj.path
    cookie.explicit_path = obj.explicit_path
    cookie.domain = obj.domain
    cookie.explicit_domain = obj.explicit_domain
    cookie.secure = obj.secure
    cookie.noscript = obj.noscript
    return cookie
  }))
  return cookieJar
}

function getTabIdFromRequestId(requestId) {
  return new Promise(async (resolve) => {
    const requestMap = (await chrome.storage.session.get(REQUEST_MAP))[REQUEST_MAP] || {};
    return resolve(requestMap[requestId])
  })
}

function setTabIdForRequestId(requestId, tabId) {
  return new Promise(async (resolve) => {
    const requestMap = (await chrome.storage.session.get(REQUEST_MAP))[REQUEST_MAP] || {};
    requestMap[requestId] = tabId;
    chrome.storage.session.set({ [REQUEST_MAP]: requestMap }, resolve);  
    
    // Don't let the map grow unbounded
    // TODO convert to alarms api: https://developer.chrome.com/docs/extensions/reference/api/alarms
    // https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#convert-timers
    // setTimeout(function() {
    //   delete requestToTabMap[details.requestId];
    // }, 60000);
  })
}

// Keep track of what tabs are initiating which requests
chrome.webRequest.onBeforeRequest.addListener(function(details) {
  if (details.tabId === undefined || details.tabId === null) {
    console.log("XXX onBeforeRequest with undefined tabId", details)
  }
  setTabIdForRequestId(details.requestId, details.tabId)
}, {
  urls: INTERCEPT_URLS,
  // types: ["main_frame"],
})

chrome.webRequest.onHeadersReceived.addListener(async function(details) {
  // console.log('onHeadersReceived', details.url)
  // if (details.url.includes('console/tb/creds')) {
  //   console.log("ZZZZ", details);
  // }

  const url = new URL(details.url)
  const requestHostname = url.hostname;
  // const requestPath = url.pathname
  const cookies = []
  for (const header of details.responseHeaders) {
    if (header.name == 'set-cookie') {
      
      // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
      const cookie = Cookie(header.value, requestHostname)
      if (INTERCEPT_COOKIES[cookie.name] /*|| cookie.name.startsWith('aws')*/) {
        if (cookie.value == '""') {
          console.log(`Request to ${details.url} deleted cookie ${cookie.name} with domain ${cookie.domain} and path ${cookie.path}`)
        }
        else {
          console.log(`Request to ${details.url} returned cookie ${cookie.name} with domain ${cookie.domain} and path ${cookie.path}`, cookie)
        }
        
        cookies.push(cookie);
      }
    }
  }
  
  if (cookies.length == 0) {
    return
  }
  
  const tabIdPromise = getTabIdFromRequestId(details.requestId);
  const cookieJarsPromise = chrome.storage.session.get(COOKIE_JARS);
  const tabId = await tabIdPromise;
  if (tabId === undefined) {
    console.log('undefined tabid')
    return
  }
  const cookieJars = (await cookieJarsPromise)[COOKIE_JARS] || {};
  
  if (!(tabId in cookieJars)) {
    cookieJars[tabId] = []
  }
  const cookieJar = unmarshalCookieJar(cookieJars[tabId])
  // TODO is this valid if there is a redirect? Is the cookie supposed to be set on the requested domain or the redirected domain?
  
  // Hack
  // TODO Might not be necessary if I create my own cookie jar implementation and
  // create roles for cookies that respect domain names (still going to ignore paths)
  // also lets me kill the only npm module I need and hence delete webpack/etc
  for (const cookie of cookies) {
    if (cookie.value != "") {
      cookieJar.setCookie(`${cookie.name}=""; Domain=signin.aws.amazon.com; Expires=Thu, 01 Jan 1970 00:00:10 GMT; Path=/; Secure; HttpOnly`)
    }
  }
  cookieJar.setCookies(cookies, requestHostname);
  cookieJars[tabId] = marshalCookieJar(cookieJar)

  // Don't need to await on the response
  chrome.storage.session.set({[COOKIE_JARS]: cookieJars});
    
  // TODO delete cookies with blank value (maybe?) or expiry set in the past: https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side
  // TODO need to handle cookie expiry (delete from jar after expired) - this is handled inside getCookies from the cookiejar I believe
  // TODO remove old filter rules
  const ruleId = getRuleId(tabId, "aws")
  console.log('Setting cookies', cookieJar.getCookies(CookieAccessInfo.All))
  // return
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [
      {
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'cookie',
              operation: 'set',
              value: cookieJar.getCookies(CookieAccessInfo.All).map(cookie => cookie.toValueString()).join('; ')
            }
          ]
        },
        condition: {
          tabIds: [tabId],
          urlFilter: 'https://*.aws.amazon.com/*' // This url filter should match the domain restriction of the set-cookie header
          // Only send on https:// urls even if the `secure` flag is missing
        },
        id: ruleId,
        priority: 1, // Use this for order evaluation of path / domain issues
      }
    ]
  })
  // }
}, {
  urls: INTERCEPT_URLS,
  // types: ["main_frame"],
}, ["responseHeaders", "extraHeaders"])
