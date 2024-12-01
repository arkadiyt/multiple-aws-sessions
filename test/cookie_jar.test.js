import { CookieJar } from '../src/cookie_jar.mjs';
import { cs } from './utils.js'

describe('CookieJar', () => {
  it('adds and gets cookies', () => {
    const cookieJar = new CookieJar()
    cookieJar.upsertCookie(cs('a', 'b'), 'https://example.com')
    const cookies = cookieJar.getCookies()
    expect(cookies).toHaveLength(1)
    expect(cookies[0].name).toBe('a')
    expect(cookies[0].value).toBe('b')
  })

  it("doesn't insert invalid cookies", () => {
    [
      [cs('a', 'b', {secure: true}), 'http://example.com'],
      [cs('a', 'b', {domain: 'other.com'}), 'https://example.com'], // TODO also add test cases for higher level order + public suffix list
      [cs('a', 'b', {partitioned: true}), 'https://example.com'],
      [cs('a', 'b', {partitioned: true, secure: false}), 'https://example.com'],
      [cs('__Secure-a', 'b'), 'https://example.com'],
      [cs('__Host-a', 'b'), 'https://example.com'],
      [cs('__Host-a', 'b', {secure: true}), 'https://example.com'],
      [cs('__Host-a', 'b', {secure: true, path: '/path'}), 'https://example.com'],
      [cs('__Host-a', 'b', {secure: true, path: '/', domain: 'example.com'}), 'https://example.com'],
      [cs('__Host-a', 'b', {secure: true, domain: 'example.com'}), 'https://example.com'],
    ].forEach(testCase => {
      const cookieJar = new CookieJar()
      cookieJar.upsertCookie(testCase[0], testCase[1])  
      expect(cookieJar.getCookies).toHaveLength(0)
    })
  })

  it('removes expired cookies', () => {
    const cookieJar = new CookieJar()
    cookieJar.upsertCookie(cs('a', 'b', {maxage: 0}), 'https://example.com');
    expect(cookieJar.getCookies).toHaveLength(0)
  })

  it.only('upserts existing cookies', () => {
    [
      [[cs('a', 'b'), cs('a', 'c')], [cs('a', 'c')]],
      [[cs('a', 'b'), cs('a', 'c', {domain: 'example.com'})], [cs('a', 'c', {domain: 'example.com'})]],
      [[cs('a', 'b'), cs('a', 'c', {domain: 'example.com', secure: true})], [cs('a', 'c', {domain: 'example.com', secure: true})]],
      [[cs('a', 'b', {httponly: true}), cs('a', 'c', {domain: 'example.com'})], [cs('a', 'c', {domain: 'example.com'})]],
      [[cs('a', 'a'), cs('b', 'b')], [cs('a', 'a'), cs('b', 'b')]],
      // tests for diff domain
      [[cs('a', 'b', {domain: 'example.com'}), cs('a', 'c', {domain: 'sub.example.com'})], []],
      [[cs('a', 'b', {path: '/'}), cs('a', 'c', {path: '/path'})], [cs('a', 'b', {path: '/'}), cs('a', 'c', {path: '/path'})]],
      [[cs('a', 'b'), cs('a', '')], []],
      [[cs('a', 'b'), cs('a', 'b', {maxage: -1})], []],
      [[cs('a', 'b'), cs('a', 'b', {expires: new Date().toUTCString()})], []],
      [[cs('a', 'b', {path: '/'}), cs('a', 'b', {path: '/path', expires: new Date().toUTCString()})], [cs('a', 'b', {path: '/'})]]
    ].forEach(([cookies, expectedResult]) => {
      const cookieJar = new CookieJar()
      cookieJar.upsertCookies(cookies, 'https://sub.example.com')
      const result = cookieJar.getCookies()
      const expectedCookieJar = new CookieJar();
      expectedCookieJar.upsertCookies(expectedResult, 'https://sub.example.com');
      expect(result).toEqual(expectedCookieJar.getCookies())        
    })
  })
})
