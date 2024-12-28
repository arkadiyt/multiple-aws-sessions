import { Cookie } from './cookie.js';
import psl from 'psl';

// Function domainMatchesCookieDomain(cookie, domain) {
//   // TODO, DRY up the code below
// }

export class CookieJar {
  constructor() {
    this.cookies = [];
  }
  upsertCookie(cookie, requestUrl) {
    if (typeof cookie === 'string') {
      this.upsertCookie(new Cookie(cookie, requestUrl), requestUrl);
      return;
    }

    const url = new URL(requestUrl);

    if (cookie.secure === true && url.protocol !== 'https:') {
      // Don't allow setting Secure cookies from http requests
      return;
    }

    if (
      cookie.domainSpecified === true &&
      !(
        url.hostname === cookie.domain ||
        (url.hostname.endsWith(`.${cookie.domain}`) && cookie.domain !== psl.parse(url.hostname).tld)
      )
    ) {
      // Cookie domain name must match the request domain or one of a higher order, excluding the public suffix list
      return;
    }

    if (cookie.partitioned === true && cookie.secure !== true) {
      // Paritioned cookies must have the Secure flag set
      return;
    }

    if (cookie.name.startsWith('__Secure-') && cookie.secure !== true) {
      // Cookies with the __Secure- prefix must have the Secure flag set
      return;
    }

    if (
      cookie.name.startsWith('__Host-') &&
      (cookie.secure !== true ||
        cookie.path !== '/' ||
        cookie.pathSpecified !== true ||
        cookie.domainSpecified !== false)
    ) {
      // Cookies with the __Host- prefix must have the Secure flag, must have Path=/, and must not specify a domain
      return;
    }

    // No additional checks to perform here for cookies with the Partitioned, httpOnly, SameSite, or Path flags (TODO is this correct?)

    // Matching rules described on step 11 here: https://www.rfc-editor.org/rfc/rfc6265#section-5.3
    const index = this.cookies.findIndex(
      (other) => cookie.name === other.name && cookie.domain === other.domain && cookie.path === other.path,
    );
    const shouldDelete = cookie.value === '' || cookie.expired();
    if (index !== -1) {
      if (shouldDelete) {
        // If found an existing cookie and the new one is blank, delete the existing one
        this.cookies.splice(index, 1);
      } else {
        // If found an existing cookie and the new one is not blank, update the existing one
        this.cookies[index] = cookie;
      }
    } else if (!shouldDelete) {
      // If there was no existing cooie and the new one is not blank, add it to the jar
      this.cookies.push(cookie);
    }
  }

  upsertCookies(cookies, requestUrl) {
    for (const cookie of cookies) {
      this.upsertCookie(cookie, requestUrl);
    }
  }

  removeExpired() {
    this.cookies = this.cookies.filter((cookie) => !cookie.expired());
  }

  getCookies() {
    this.removeExpired();
    return this.cookies;
  }

  length() {
    return this.cookies.length;
  }

  matching({ domain, path, secure, samesite, httponly } = {}) {
    return this.getCookies().filter((cookie) => {
      if (typeof domain !== 'undefined') {
        if (
          !(
            domain === cookie.domain ||
            (cookie.domainSpecified === true &&
              domain.endsWith(`.${cookie.domain}`) &&
              domain !== psl.parse(cookie.domain).tld)
          )
        ) {
          return false;
        }
      }

      if (typeof path !== 'undefined') {
        // https://www.rfc-editor.org/rfc/rfc6265#section-5.1.4
        if (
          !(
            path === cookie.path ||
            (path.startsWith(cookie.path) && (cookie.path.slice(-1) === '/' || path[cookie.path.length] === '/'))
          )
        ) {
          return false;
        }
      }

      // This handles the case where secure === false and cookie.secure === undefined
      // TODO consider giving defaults in Cookie (e.g. secure is false instead of undefined)
      if (typeof secure !== 'undefined') {
        if (!((secure === true && cookie.secure === true) || (secure === false && cookie.secure !== true))) {
          return false;
        }
      }

      if (typeof samesite !== 'undefined') {
        if (samesite instanceof Array && !samesite.includes(cookie.samesite)) {
          return false;
        } else if (typeof samesite === 'string' && samesite !== cookie.samesite) {
          return false;
        }
      }

      // This handles the case where httpOnly === false and cookie.secure === undefined
      // TODO consider giving defaults in Cookie (e.g. secure is false instead of undefined)
      if (typeof httponly !== 'undefined') {
        if (!((httponly === true && cookie.httponly === true) || (httponly === false && cookie.httponly !== true))) {
          return false;
        }
      }

      return true;
    });
  }

  static unmarshal(object) {
    const cookieJar = new CookieJar();
    cookieJar.cookies = object.cookies.map((item) => Cookie.unmarshal(item));
    cookieJar.removeExpired();
    return cookieJar;
  }
}
