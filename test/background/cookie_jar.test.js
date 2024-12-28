import { describe, expect, it } from '@jest/globals';
import { CookieJar } from 'background/cookie_jar.js';
import { cs } from './utils.js';

describe('cookiejar', () => {
  it('adds and gets cookies', () => {
    expect.hasAssertions();

    const cookieJar = new CookieJar();
    cookieJar.upsertCookie(cs('a', 'b'), 'https://example.com');
    const cookies = cookieJar.getCookies();

    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('a');
    expect(cookies[0].value).toBe('b');
  });

  it("doesn't insert invalid cookies", () => {
    expect.hasAssertions();

    [
      [cs('a', 'b', { secure: true }), 'http://example.com'],
      [cs('a', 'b', { domain: 'other.com' }), 'https://example.com'],
      [cs('a', 'b', { domain: 'com' }), 'https://example.com'],
      [cs('a', 'b', { partitioned: true }), 'https://example.com'],
      [cs('__Secure-a', 'b'), 'https://example.com'],
      [cs('__Host-a', 'b'), 'https://example.com'],
      [cs('__Host-a', 'b', { secure: true }), 'https://example.com'],
      [cs('__Host-a', 'b', { path: '/path', secure: true }), 'https://example.com'],
      [cs('__Host-a', 'b', { domain: 'example.com', path: '/', secure: true }), 'https://example.com'],
      [cs('__Host-a', 'b', { domain: 'example.com', secure: true }), 'https://example.com'],
    ].forEach((testCase) => {
      const cookieJar = new CookieJar();
      cookieJar.upsertCookie(testCase[0], testCase[1]);

      expect(cookieJar.getCookies()).toHaveLength(0);
    });
  });

  it('does not insert expired cookies', () => {
    expect.hasAssertions();

    const cookieJar = new CookieJar();
    cookieJar.upsertCookie(cs('a', 'b', { maxage: 0 }), 'https://example.com');

    expect(cookieJar.getCookies()).toHaveLength(0);
  });

  it('removes expired cookies', () => {
    expect.hasAssertions();

    const cookieJar = new CookieJar();
    cookieJar.upsertCookie(cs('a', 'b'), 'https://example.com');
    cookieJar.upsertCookie(cs('a', 'b', { maxage: 0 }), 'https://example.com');

    expect(cookieJar.cookies).toHaveLength(0);
  });

  it('upserts existing cookies', () => {
    expect.hasAssertions();

    [
      [[cs('a', 'b'), cs('a', 'c')], [cs('a', 'c')]],
      [[cs('a', 'b'), cs('a', 'c', { domain: 'sub.example.com' })], [cs('a', 'c', { domain: 'sub.example.com' })]],
      [
        [cs('a', 'b'), cs('a', 'c', { domain: 'sub.example.com', secure: true })],
        [cs('a', 'c', { domain: 'sub.example.com', secure: true })],
      ],
      [
        [cs('a', 'b', { httponly: true }), cs('a', 'c', { domain: 'sub.example.com' })],
        [cs('a', 'c', { domain: 'sub.example.com' })],
      ],
      [
        [cs('a', 'a'), cs('b', 'b')],
        [cs('a', 'a'), cs('b', 'b')],
      ],
      [
        [cs('a', 'b', { domain: 'example.com' }), cs('a', 'c', { domain: 'sub.example.com' })],
        [cs('a', 'b', { domain: 'example.com' }), cs('a', 'c', { domain: 'sub.example.com' })],
      ],
      [
        [cs('a', 'b', { path: '/' }), cs('a', 'c', { path: '/path' })],
        [cs('a', 'b', { path: '/' }), cs('a', 'c', { path: '/path' })],
      ],
      [[cs('a', 'b'), cs('a', '')], []],
      [[cs('a', 'b'), cs('a', 'b', { maxage: -1 })], []],
      [[cs('a', 'b'), cs('a', 'b', { expires: new Date().toUTCString() })], []],
      [
        [cs('a', 'b', { path: '/' }), cs('a', 'b', { expires: new Date().toUTCString(), path: '/path' })],
        [cs('a', 'b', { path: '/' })],
      ],
    ].forEach(([cookies, expectedResult]) => {
      const cookieJar = new CookieJar();
      cookieJar.upsertCookies(cookies, 'https://sub.example.com');
      const result = cookieJar.getCookies();
      const expectedCookieJar = new CookieJar();
      expectedCookieJar.upsertCookies(expectedResult, 'https://sub.example.com');

      expect(result).toStrictEqual(expectedCookieJar.getCookies());
    });
  });

  it('returns matching cookies', () => {
    expect.hasAssertions();

    const cookieJar = new CookieJar();
    cookieJar.upsertCookies(
      [
        cs('a', '1'),
        cs('b', '1', { domain: 'sub2.example.com' }),
        cs('c', '1', { domain: 'example.com' }),
        cs('d', '1', { secure: true }),
        cs('e', '1', { samesite: 'none' }),
        cs('f', '1', { samesite: 'lax' }),
        cs('g', '1', { samesite: 'strict' }),
        cs('h', '1', { path: '/path1' }),
        cs('i', '1', { path: '/path3/' }),
        cs('j', '1', { httponly: true, path: '/path4' }),
      ],
      'https://sub1.sub2.example.com/path2',
    );

    [
      [{ secure: true }, ['d']],
      [{ domain: 'example.com', secure: false }, ['c']],
      [{ domain: 'example.com' }, ['c']],
      [{ domain: 'sub2.example.com' }, ['b', 'c']],
      [{ samesite: 'lax' }, ['a', 'b', 'c', 'd', 'f', 'h', 'i', 'j']],
      [{ samesite: ['lax', 'strict'] }, ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'i', 'j']],
      [{ path: '/path2' }, ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
      [{ path: '/path1test' }, []],
      [{ path: '/path1/test' }, ['h']],
      [{ path: '/path3/asd' }, ['i']],
      [{ domain: 'sub2.example.com', httponly: false }, ['b', 'c']],
      [{ httponly: true }, ['j']],
    ].forEach(([conditions, expected]) => {
      const all = cookieJar.getCookies();
      const matched = cookieJar.matching(conditions);

      expect(matched).toHaveLength(expected.length);
      expect(matched).toStrictEqual(expected.map((name) => all.find((cookie) => cookie.name === name)));
    });
  });

  it('marshals and unmarshals', () => {
    expect.hasAssertions();

    const cookieJar = new CookieJar();
    cookieJar.upsertCookies(
      [cs('a', '1'), cs('b', '1', { domain: 'sub2.example.com' }), cs('h', '1', { path: '/path1' })],
      'https://sub1.sub2.example.com/path2',
    );

    expect(cookieJar).toStrictEqual(CookieJar.unmarshal(JSON.parse(JSON.stringify(cookieJar))));
  });
});
