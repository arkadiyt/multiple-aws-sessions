import { describe, expect, it } from '@jest/globals';
import { exportedForTestingOnly } from 'background/session_rules.js';
const { regexpForCookieAttributes } = exportedForTestingOnly;

describe('regexpForCookieAttributes', () => {
  it('returns correct regexes', () => {
    expect.hasAssertions();

    [
      [
        { domain: 'example.com', domainSpecified: false, path: '/', secure: true },
        ['https://example.com/', 'https://example.com/path'],
        ['http://example.com/', 'https://a.example.com/'],
      ],
      [
        { domain: 'example.com', domainSpecified: false, path: '/', secure: false },
        ['https://example.com/', 'https://example.com/path', 'http://example.com/'],
        ['https://a.example.com/'],
      ],
      [
        { domain: 'a.example.com', domainSpecified: true, path: '/', secure: true },
        ['https://a.example.com/', 'https://b.a.example.com/path'],
        [
          'https://example.com/',
          'https://com/',
          'https://aa.example.com',
          'https://test.com/#https://a.example.com/',
          'https://axexample.com/',
        ],
      ],
      [
        { domain: 'a.example.com', domainSpecified: false, path: '/path', secure: true },
        ['https://a.example.com/path', 'https://a.example.com/path/', 'https://a.example.com/path/asd'],
        ['https://a.example.com/', 'https://a.example.com/asd', 'https://a.example.com/pathblah'],
      ],
    ].forEach(([options, shouldMatch, shouldNotMatch]) => {
      const regexp = new RegExp(regexpForCookieAttributes(options), 'u');
      shouldMatch.forEach((candidate) => {
        expect(regexp.test(candidate)).toBe(true);
      });
      shouldNotMatch.forEach((candidate) => {
        expect(regexp.test(candidate)).toBe(false);
      });
    });
  });
});
