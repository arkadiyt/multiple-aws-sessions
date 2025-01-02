import { RESOURCE_TYPES } from 'background/common.js';
import escapeStringRegexp from 'escape-string-regexp';

// Chrome requires the rule id / priority to be 32 bit signed integer
export const MAX_RULE_ID = 2 ** 31 - 1;

const regexpForCookieAttributes = (cookie) => {
  const schemeRegex = cookie.secure ? 'https://' : 'https?://';
  const subdomainRegex = cookie.domainSpecified ? '(?:(?:[a-z0-9-]*\\.)*)?' : '';
  const domainRegex = escapeStringRegexp(cookie.domain);
  const pathRegex = escapeStringRegexp(cookie.path);
  const pathSuffix = cookie.path.endsWith('/') ? '.*' : '(?:/.*)?';
  return `^${schemeRegex}${subdomainRegex}${domainRegex}${pathRegex}${pathSuffix}$`;
};

export const sessionRulesFromCookieJar = (cookieJar, tabIds, ruleIdStart) => {
  const cookies = cookieJar.getCookies();
  return cookies.map((cookie, index) => {
    const rule = {
      action: {
        requestHeaders: [
          {
            header: 'cookie',
            operation: 'append',
            // Chrome seems to inject a semicolon automatically
            value: cookie.toString(),
          },
        ],
        type: 'modifyHeaders',
      },
      condition: {
        regexFilter: regexpForCookieAttributes(cookie),
        resourceTypes: RESOURCE_TYPES,
        tabIds,
      },
      // Wrap back around if we ever get too high, the rules at the beginning of the range will have probably been cleared by now
      // Could be improved to find explicitly available rule ids
      id: (ruleIdStart + index + 1) % MAX_RULE_ID,
      priority: index + 1,
    };

    // This treats both strict _and_ lax cookies as if they were strict
    if (['strict', 'lax'].includes(cookie.samesite)) {
      rule.condition.domainType = 'firstParty';
    }

    return rule;
  });
};

export const exportedForTestingOnly = {
  regexpForCookieAttributes,
};
