import { Cookie, cookieHeader } from 'background/cookie.js';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { cs } from './utils.js';

describe('cookie', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('parses valid set-cookie headers', () => {
    expect.hasAssertions();

    [
      ['a', 'b', {}],
      ['a', 'b', { secure: true }],
      ['a', 'b', { httponly: true, partitioned: true, samesite: 'lax', secure: true }],
      ['a', 'b', { expires: 'Tue, 29 Oct 2024 16:56:32 GMT' }],
      ['a', 'b', { maxage: 10 }],
      ['a', 'b', { domain: 'example.com' }],
      ['a', 'b', { domain: '.example.com' }],
      ['a', 'b', { path: '/' }],
      ['a', 'b', { domain: 'sub.example.com', path: '/path' }],
      ['a', 'b', { domain: 'sub.example.com', path: '/path/' }],
    ].forEach(([name, value, options]) => {
      const cookie = new Cookie(cs(name, value, options), 'https://example.com');

      expect(cookie.name).toBe(name);
      expect(cookie.value).toBe(value);
      expect(cookie.domain).toBe(
        typeof options.domain === 'undefined' ? 'example.com' : options.domain.replace(/^\./v, ''),
      );
      expect(cookie.path).toBe(typeof options.path === 'undefined' ? '/' : options.path);
      expect(cookie.expires).toBe(options.expires);
      expect(cookie.maxage).toBe(options.maxage);
      expect(cookie.secure).toBe(typeof options.secure === 'undefined' ? false : options.secure);
      expect(cookie.httponly).toBe(typeof options.httponly === 'undefined' ? false : options.httponly);
      expect(cookie.samesite).toBe(typeof options.samesite === 'undefined' ? 'lax' : options.samesite);
      expect(cookie.partitioned).toBe(typeof options.partitioned === 'undefined' ? false : options.partitioned);
      expect(cookie.expirationTimestamp).toBe(
        // eslint-disable-next-line no-nested-ternary
        options.maxage ? Date.now() + options.maxage : options.expires ? Date.parse(options.expires) : void 0,
      );
      expect(cookie.domainSpecified).toBe(typeof options.domain !== 'undefined');
      expect(cookie.pathSpecified).toBe(typeof options.path !== 'undefined');
    });
  });

  it('has a correct default path', () => {
    expect.hasAssertions();

    const httpCookie = new Cookie(cs('a', 'b', {}), 'https://example.com/path', false);

    expect(httpCookie.path).toBe('/path');

    const javascriptCookie = new Cookie(cs('a', 'b', {}), 'https://example.com/path', true);

    expect(javascriptCookie.path).toBe('/');
  });

  it('treats session cookies correctly', () => {
    expect.hasAssertions();

    [
      ['a', 'b', {}, true],
      ['a', 'b', { httponly: true }, true],
      ['a', 'b', { maxage: 1 }, false],
      ['a', 'b', { expires: 'Tue, 29 Oct 2024 16:56:32 GMT' }, false],
      ['a', 'b', { expires: 'Tue, 29 Oct 2024 16:56:32 GMT', maxage: 1 }, false],
    ].forEach(([name, value, options, expected]) => {
      const cookie = new Cookie(cs(name, value, options), 'https://example.com');

      expect(cookie.session()).toBe(expected);
    });
  });

  it('throws an error for malformed set-cookie headers', () => {
    expect.hasAssertions();

    [
      ['asd', 'Invalid cookie header'],
      ['', 'Invalid cookie header'],
      ['a=1; max-age=a', 'Invalid expires or max-age'],
      ['a=1; samesite=blah', 'Invalid samesite flag blah'],
    ].forEach((testCase) => {
      expect(() => {
        // eslint-disable-next-line no-new
        new Cookie(testCase[0], 'https://example.com');
      }).toThrow(testCase[1]);
    });
  });

  it('expires expired cookies', () => {
    expect.hasAssertions();

    [
      { expires: new Date().toUTCString() },
      { expires: new Date(Date.now() - 999999).toUTCString() },
      { maxage: 0 },
      { maxage: -1 },
      { maxage: -99999 },
    ].forEach((testCase) => {
      const cookie = new Cookie(cs('a', 'b', testCase), 'https://example.com');

      expect(cookie.expired()).toBe(true);
    });
  });

  it("doesn't expire unexpired cookies", () => {
    expect.hasAssertions();

    [{ expires: new Date(Date.now() + 1000).toUTCString() }, { maxage: 1 }, { maxage: 99999 }, {}].forEach(
      (testCase) => {
        const cookie = new Cookie(cs('a', 'b', testCase), 'https://example.com');

        expect(cookie.expired()).toBe(false);
      },
    );
  });

  it('has a string representation', () => {
    expect.hasAssertions();

    const cookie = new Cookie(cs('a', 'b', { secure: true }), 'https://example.com');

    expect(cookie.toString()).toBe('a=b');
  });

  it('marshals and unmarshals', () => {
    expect.hasAssertions();

    [
      ['a', 'b', {}],
      ['a', 'b', { secure: true }],
      ['a', 'b', { httponly: true, partitioned: true, samesite: 'lax', secure: true }],
      ['a', 'b', { expires: 'Tue, 29 Oct 2024 16:56:32 GMT' }],
      ['a', 'b', { maxage: 10 }],
      ['a', 'b', { domain: 'example.com' }],
      ['a', 'b', { domain: '.example.com' }],
      ['a', 'b', { path: '/' }],
      ['a', 'b', { domain: 'sub.example.com', path: '/path' }],
      ['a', 'b', { domain: 'sub.example.com', path: '/path/' }],
    ].forEach(([name, value, options]) => {
      const cookie = new Cookie(cs(name, value, options), 'https://example.com');

      expect(cookie).toStrictEqual(Cookie.unmarshal(JSON.parse(JSON.stringify(cookie))));
    });
  });
});

describe('cookieHeader', () => {
  it('outputs the correct header', () => {
    expect.hasAssertions();

    expect(
      cookieHeader([
        new Cookie(cs('a', 1, { secure: true }), 'https://example.com'),
        new Cookie(cs('b', 2, { httponly: true, path: '/path' }), 'https://example.com'),
      ]),
    ).toBe('a=1; b=2');
  });
});
