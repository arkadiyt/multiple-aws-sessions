import { describe, expect, it } from '@jest/globals';
import { exportedForTestingOnly } from 'background/session_rules.js';
const { regexpForCookieAttributes, sorted } = exportedForTestingOnly;

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

describe('sorted', () => {
  const addIdsAndStringify = (arr) => arr.map((elm, id) => JSON.stringify(Object.assign(elm, { id })));

  it('sorts specific domains before wildcards', () => {
    expect.hasAssertions();

    const result = sorted(addIdsAndStringify([{ domainSpecified: false }, { domainSpecified: true }]));

    expect(result.map((item) => JSON.parse(item).id)).toStrictEqual([1, 0]);
  });

  it('sorts domains with more parts first', () => {
    expect.hasAssertions();

    const result = sorted(
      addIdsAndStringify([{ domain: 'a.example.com' }, { domain: 'example.com' }, { domain: 'a.b.example.com' }]),
    );

    expect(result.map((item) => JSON.parse(item).id)).toStrictEqual([1, 0, 2]);
  });

  it('sorts secure cookies first', () => {
    expect.hasAssertions();

    const result = sorted(addIdsAndStringify([{ secure: true }, { secure: false }]));

    expect(result.map((item) => JSON.parse(item).id)).toStrictEqual([1, 0]);
  });

  it('sorts paths with more parts first', () => {
    expect.hasAssertions();

    const result = sorted(addIdsAndStringify([{ path: '/a/b/c' }, { path: '/' }, { path: '/a/b' }]));

    expect(result.map((item) => JSON.parse(item).id)).toStrictEqual([1, 2, 0]);
  });

  it('sorts samesite cookies first', () => {
    expect.hasAssertions();

    const result = sorted(addIdsAndStringify([{ samesite: true }, { samesite: false }]));

    expect(result.map((item) => JSON.parse(item).id)).toStrictEqual([1, 0]);
  });
});
