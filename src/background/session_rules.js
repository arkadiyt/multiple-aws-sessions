import { cookieHeader } from './cookie_jar.js';

const sorted = (groups) =>
  groups.sort((key1, key2) => {
    // -1 means key1 comes before key2
    // 0 means equal
    // 1 means key1 comes after key2
    const json1 = JSON.parse(key1);
    const json2 = JSON.parse(key2);

    // Secure, no domain specified, descending by path, if there are 2 equal paths then by samesite
    // https://sub.specific.domain

    // https://specific.domain/path1/path2 (no domainSpecified) (samesite = true)
    // https://specific.domain/path1/path2 (no domainSpecified)  (no samesite)
    // https://specific.domain/ (no domainSpecified)

    // No secure, no domain specified, descending by path
    // *://specific.domain/path1/path2 (no domainSpecified)
    // *://specific.domain/ (no domainSpecified)

    // Secure, domain specified, descending by path
    // https://*.domain/path1/path2 (domain specified)
    // https://*.domain/ (domain specified)

    // No secure, domain specified, descending by path
    // *://*.domain/path1/path2 (domain specified)
    // *://*.domain/ (domain specified)

    // First go through all specific domains; wildcards go last
    if (json1.domainSpecified !== json2.domainSpecified) {
      return json1.domainSpecified ? 1 : -1;
    }

    // When both or neither cookie had the domain explicitly set
    // Choose the one with more parts (the more specific one) to go first, or if they have equal length
    // then choose based on lexigraphic comparison
    if (json1.domain !== json2.domain) {
      const json1Count = json1.domain.split('.').length - 1;
      const json2Count = json2.domain.split('.').length - 1;
      if (json1Count !== json2Count) {
        return json2Count - json1Count;
      }
      return json1.domain.localeCompare(json2.domain);
    }

    if (json1.secure !== json2.secure) {
      return json1.secure ? -1 : 1;
    }

    // TODO need to handle cases like /path1 and /path1/
    if (json1.path !== json2.path) {
      const json1Count = json1.domain.split('/').length - 1;
      const json2Count = json2.domain.split('/').length - 1;
      if (json1Count !== json2Count) {
        return json2Count - json1Count;
      }
      return json1.path.localeCompare(json2.path);
    }

    if (json1.samesite !== json2.samesite) {
      return json1.samesite ? -1 : 1;
    }

    return 0;
  });

export const sessionRulesFromCookieJar = (cookieJar, tabId, ruleIdStart) => {
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

  // TODO reverse sorting above and remove reverse here
  const sortedGroups = sorted(Object.keys(grouped)).reverse();

  return sortedGroups.map((sortedGroup, index) => {
    const json = JSON.parse(sortedGroup);
    const matchingCookies = cookieJar.matching(json);
    const scheme = json.secure ? 'https' : '*';
    const anchor = json.domainSpecified ? '*' : '';
    const path = json.path.slice(-1) === '/' ? json.path : `${json.path}/`;

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
        // TODO set this for filters elsewhere too
        resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'],
        tabIds: [tabId],
        // TODO injection from set-cookie header domain/path/etc value?
        // TODO switch to regex filter for more precise control, e.g. should match aws.amazon.com and its subdomains but *aws.amazon.com matches blahaws.amazon.com
        urlFilter: `|${scheme}://${anchor}${json.domain}${path}*`,
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
  sorted,
};
