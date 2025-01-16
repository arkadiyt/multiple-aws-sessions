import { INTERCEPT_URL, RESOURCE_TYPES } from 'background/common.js';
import escapeStringRegexp from 'escape-string-regexp';
import psl from 'psl';

// Chrome requires the rule id / priority to be 32 bit signed integer
export const MAX_RULE_ID = 2 ** 31 - 1;

export const CLEAR_RULE = {
  action: {
    requestHeaders: [
      {
        header: 'cookie',
        operation: 'set',
        value: ' ', // Chrome allows an empty string but Firefox requires some value
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
};

const regexpForCookieAttributes = (cookie) => {
  const schemeRegex = cookie.secure ? 'https://' : 'https?://';
  const subdomainRegex = cookie.domainSpecified ? '(?:[a-z0-9-]*\\.)*' : '';
  const domainRegex = escapeStringRegexp(cookie.domain);
  const pathRegex = escapeStringRegexp(cookie.path);
  const pathSuffix = cookie.path.endsWith('/') ? '.*' : '(?:/.*)?';
  return `^${schemeRegex}${subdomainRegex}${domainRegex}${pathRegex}${pathSuffix}$`;
};

const rule = (cookie, tabIds, id, priority) => ({
  action: {
    requestHeaders: [
      {
        header: 'cookie',
        operation: 'append',
        // Browsers append a semicolon automatically
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
  // TODO Could be improved to find explicitly available rule ids
  id: id % MAX_RULE_ID,
  priority,
});

// const getUnusedRuleIds = (num, ruleIds, ruleIdsToRemove) => {
//   if (ruleIdsToRemove.length <= num) {
//     return ruleIdsToRemove.slice(0, num);
//   }

//   const start = Math.floor(Math.random() * MAX_RULE_ID);
//   for (let i = num - ruleIdsToRemove.length; i < num;) {

//   }
// }

// TODO add tests for this
export const sessionRulesFromCookieJar = (cookieJar, tabIds, ruleIdStart) => {
  const cookies = cookieJar.getCookies();
  const rules = [];

  // TODO for cookies with identical conditions (regex, samesite), collapse into a single rule

  for (const cookie of cookies) {
    rules.push(rule(cookie, tabIds, ruleIdStart + rules.length + 1, rules.length + 1));

    // TODO this breaks stuff
    // if (cookie.samesite === 'strict') {
    //   rules[rules.length - 1].condition.initiatorDomains = [psl.parse(cookie.domain).domain];
    // } else if (cookie.samesite === 'lax') {
    //   rules[rules.length - 1].condition.initiatorDomains = [psl.parse(cookie.domain).domain];
    //   rules[rules.length - 1].condition.requestMethods = ['connect', 'delete', 'patch', 'post', 'put', 'other'];
    //   rules.push(rule(cookie, tabIds, ruleIdStart + rules.length + 1, rules.length + 1));
    //   rules[rules.length - 1].condition.resourceTypes = ['main_frame'];
    //   rules[rules.length - 1].condition.requestMethods = ['get', 'head', 'options'];
    // }
  }

  return rules;
};

export const exportedForTestingOnly = {
  regexpForCookieAttributes,
};
