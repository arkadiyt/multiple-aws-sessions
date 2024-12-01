import { jest } from '@jest/globals';
import { Cookie } from '../src/cookie.mjs';
import { cs } from './utils.js'

describe('Cookie', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());
  })

  afterAll(() => {
    jest.useRealTimers();
  })

  it('parses valid set-cookie headers', () => {
    [
      {name: 'a', value: 'b'},
      {name: 'a', value: 'b', secure: true},
      {name: 'a', value: 'b', secure: true, httponly: true, samesite: 'lax', partitioned: true},
      {name: 'a', value: 'b', expires: 'Tue, 29 Oct 2024 16:56:32 GMT'},
      {name: 'a', value: 'b', maxage: 10},
      {name: 'a', value: 'b', domain: 'example.com'},
      {name: 'a', value: 'b', path: '/'},
      {name: 'a', value: 'b', domain: 'sub.example.com', path: '/path'}
    ].forEach(header => {
      const cookie = new Cookie(cs(header.name, header.value, header), 'https://example.com')
      expect(cookie.name).toBe(header.name)
      expect(cookie.value).toBe(header.value)
      expect(cookie.domain).toBe(header.domain !== undefined ? header.domain : 'example.com')      
      expect(cookie.path).toBe(header.path)
      expect(cookie.expires).toBe(header.expires)
      expect(cookie.maxage).toBe(header.maxage)
      expect(cookie.secure).toBe(header.secure)
      expect(cookie.httponly).toBe(header.httponly)
      expect(cookie.samesite).toBe(header.samesite)
      expect(cookie.partitioned).toBe(header.partitioned)

      expect(cookie.session).toBe(header.expires === undefined && header.maxage === undefined)
      expect(cookie.expiration_timestamp).toBe(header.maxage ? Date.now() + header.maxage : (header.expires ? Date.parse(header.expires) : undefined))
      expect(cookie.domain_specified).toBe(header.domain !== undefined)
      expect(cookie.path_specified).toBe(header.path !== undefined)
    })
  })

  it('throws an error for malformed set-cookie headers', () => {
    [
      // TODO add more once I rework the parsing to be my own
      ['asd', 'Invalid cookie header encountered']
    ].forEach(testCase => {
      expect(() => {new Cookie(testCase[0], 'https://example.com')}).toThrowError(testCase[1])
    })
  })

  it('expires cookies', () => {
    [
      {expires: new Date().toUTCString()},
      {expires: new Date(Date.now() - 999999).toUTCString()},
      {maxage: 0},
      {maxage: -1},
      {maxage: -99999}
    ].forEach(testCase => {
      const cookie = new Cookie(cs('a', 'b', testCase), 'https://example.com')
      expect(cookie.expired()).toBe(true)
    })
  })

  it("doesn't expire cookies", () => {
    [
      {expires: (new Date(Date.now() + 1000)).toUTCString()},
      {maxage: 1},
      {maxage: 99999},
      {}, // Session cookie
    ].forEach(testCase => {
      const cookie = new Cookie(cs('a', 'b', testCase), 'https://example.com')
      expect(cookie.expired()).toBe(false)
    })
  })
})


