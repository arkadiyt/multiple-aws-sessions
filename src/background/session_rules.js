import { RESOURCE_TYPES } from 'background/common.js';
import { cookieHeader } from 'background/cookie.js';
import escapeStringRegexp from 'escape-string-regexp';

const sorted = (groups) =>
  groups.sort((key1, key2) => {
    const json1 = JSON.parse(key1);
    const json2 = JSON.parse(key2);

    // Sorts json cookie attributes in the order to be applied. Top of the list is _lower_ priority and
    // bottom of the list is _higher_ priority. E.g.:
    // [
    //   'rule1', <-- applied last
    //   'rule2',
    //   'rule3', <-- applied first
    // ]

    // First go through all specific domains (wildcards go last)
    if (json1.domainSpecified !== json2.domainSpecified) {
      return json1.domainSpecified ? -1 : 1;
    }

    // If they're both or neither wildcards, choose the domain with more parts first
    if (json1.domain !== json2.domain) {
      return json1.domain.split('.').length - json2.domain.split('.').length;
    }

    // If the domains are the same, choose the one with `secure` first
    if (json1.secure !== json2.secure) {
      return json1.secure ? 1 : -1;
    }

    // If both or neither have `secure`, choose the path with more parts first
    if (json1.path !== json2.path) {
      // TODO need to handle cases like /path1 and /path1/
      return json1.path.split('/').length - json2.path.split('/').length;
    }

    // If the paths are the same, choose the one with `samesite` first
    if (json1.samesite !== json2.samesite) {
      // TODO need to handle lax, strict?
      return json1.samesite ? 1 : -1;
    }

    return 0;
  });

const regexpForCookieAttributes = (json) => {
  const schemeRegex = json.secure ? 'https://' : 'https?://';
  const subdomainRegex = json.domainSpecified ? '(?:(?:[a-z0-9-]*\\.)*)?' : '';
  const domainRegex = escapeStringRegexp(json.domain);
  const pathRegex = `${escapeStringRegexp(json.path)}`;
  const pathSuffix = json.path.endsWith('/') ? '.*' : '(?:/.*)?';
  return `^${schemeRegex}${subdomainRegex}${domainRegex}${pathRegex}${pathSuffix}$`;
};

export const sessionRulesFromCookieJar = (cookieJar, tabIds, ruleIdStart) => {
  const cookies = cookieJar.getCookies();
  const grouped = Object.groupBy(cookies, (cookie) =>
    JSON.stringify({
      domain: cookie.domain,
      domainSpecified: cookie.domainSpecified,
      path: cookie.path,
      samesite: cookie.samesite !== 'none',
      secure: cookie.secure,
    }),
  );
  const sortedGroups = sorted(Object.keys(grouped));

  return sortedGroups.map((sortedGroup, index) => {
    const json = JSON.parse(sortedGroup);
    const matchingCookies = cookieJar.matching(json);
    const rule = {
      action: {
        requestHeaders: [
          {
            header: 'cookie',
            operation: 'set',
            value: cookieHeader(matchingCookies),
          },
        ],
        type: 'modifyHeaders',
      },
      condition: {
        regexFilter: regexpForCookieAttributes(json),
        resourceTypes: RESOURCE_TYPES,
        tabIds,
      },
      id: ruleIdStart + index,
      priority: index + 1,
    };

    // TODO think through this
    if (json.samesite === true) {
      rule.condition.domainType = 'firstParty';
    }

    return rule;
  });
};

export const exportedForTestingOnly = {
  regexpForCookieAttributes,
  sorted,
};
