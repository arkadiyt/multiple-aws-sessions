// Import { describe, expect, it } from '@jest/globals';
// Import { exportedForTestingOnly, sessionRulesFromCookieJar } from 'background/session_rules.js';
// Import { CookieJar } from 'background/cookie_jar.js';
// Import { cs } from './utils.js';
// Const { sorted } = exportedForTestingOnly;

import { describe, it } from '@jest/globals';

describe('sorted', () => {
  it.todo('todo');
  //   // it('sorts the groups correctly', () => {
  //   //   [
  //   //     [
  //   //       {
  //   //         secure: false,
  //   //         samesite: 'none',
  //   //         domain: 'aws.amazon.com',
  //   //         domainSpecified: true,
  //   //         path: '/',
  //   //       },
  //   //       {
  //   //         secure: false,
  //   //         samesite: 'none',
  //   //         domain: 'us-east-1.aws.amazon.com',
  //   //         domainSpecified: false,
  //   //         path: '/',
  //   //       },
  //   //     ],
  //   //     [
  //   //       {
  //   //         secure: false,
  //   //         samesite: 'none',
  //   //         domain: 'us-east-1.aws.amazon.com',
  //   //         domainSpecified: false,
  //   //         path: '/',
  //   //       },
  //   //       {
  //   //         secure: false,
  //   //         samesite: 'none',
  //   //         domain: 'aws.amazon.com',
  //   //         domainSpecified: true,
  //   //         path: '/',
  //   //       },
  //   //     ],
  //   //   ].forEach(([pre, post]) => {
  //   //     expect(sorted(pre)).toStrictEqual(post);
  //   //   });
  //   // });
  // });

  // Describe('sessionRulesFromCookieJar', () => {
  //   Const TAB_ID = 2;

  //   It('creates 1 session rule', () => {
  //     Const cookieJar = new CookieJar();
  //     CookieJar.upsertCookies(
  //       [cs('aws-creds', '1', { domain: 'us-east-1.aws.amazon.com' })],
  //       'https://us-east-1.aws.amazon.com/',
  //     );
  //     Const result = sessionRulesFromCookieJar(cookieJar, TAB_ID);

  //     Expect(result).toHaveLength(1);
  //     Expect(result[0].condition.tabIds).toStrictEqual([TAB_ID]);
  //     expect(result[0].condition.urlFilter).toBe('|*://||us-east-1.aws.amazon.com/*');
  //     Expect(result[0].id).toBe(1);
  //     Expect(result[0].priority).toBe(1);
  //     Expect(result[0].action.requestHeaders[0].value).toBe('aws-creds=1');
  //   });

  //   It('creates 2 uncollapsed session rules', () => {
  //     Const cookieJar = new CookieJar();
  //     CookieJar.upsertCookie(
  //       Cs('aws-creds', '1', { domain: 'us-east-1.aws.amazon.com', secure: true }),
  //       'https://us-east-1.aws.amazon.com',
  //     );
  //     CookieJar.upsertCookie(
  //       Cs('aws-creds', '2', { domain: 'signin.aws.amazon.com', secure: true }),
  //       'https://signin.aws.amazon.com/',
  //     );
  //     Const result = sessionRulesFromCookieJar(cookieJar, TAB_ID);

  //     Expect(result).toHaveLength(2);
  //     expect(result[0].condition.urlFilter).toBe('|https://||signin.aws.amazon.com/*');
  //     Expect(result[0].id).toBe(1);
  //     Expect(result[0].priority).toBe(1);
  //     Expect(result[0].action.requestHeaders[0].value).toBe('aws-creds=2');
  //     expect(result[1].condition.urlFilter).toBe('|https://||us-east-1.aws.amazon.com/*');
  //     Expect(result[1].id).toBe(2);
  //     Expect(result[1].priority).toBe(2);
  //     Expect(result[1].action.requestHeaders[0].value).toBe('aws-creds=1');
  //   });

  //   // it('collapses like cookies into 1 session rule', () => {
  //   //   const cookieJar = new CookieJar();
  //   //   cookieJar.upsertCookies([
  //   //     cs("aws-creds", "1", {secure: true}),
  //   //     cs("aws-userInfo", "2", {secure: true})
  //   //   ], 'https://us-east-1.aws.amazon.com')
  //   //   const result = sessionRulesFromCookieJar(cookieJar, TAB_ID)
  //   // })
});
