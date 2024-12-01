import { Cookie } from './cookie.mjs'

export class CookieJar {
  constructor() {
    // Might need to make a map if I ever need to access a specific cookie by name
    this.cookies = []
  }
  upsertCookie(cookie, request_url) {
    if (typeof cookie === "string") {
      cookie = new Cookie(cookie, request_url)
    }

    const url = new URL(request_url)
    
    if (cookie.secure === true && url.protocol != 'https:') {
      // Don't allow setting Secure cookies from http requests
      return;
    }
    if (cookie.explicit_domain === true && cookie.domain !== url.hostname) {
      // Cookie domain name must match the request domain or one of a higher order, excluding the public suffix list
      // TODO this needs to take suffixes/prefixes into account
      // https://www.npmjs.com/package/psl
      return;
    }
    if (cookie.partitioned && !cookie.secure) {
      // Paritioned cookies must have the Secure flag set
      return;
    }
    if (cookie.name.startsWith('__Secure-') && !cookie.secure) {
      // Cookies with the __Secure- prefix must have the Secure flag set
      return;
    }
    if (cookie.name.startsWith('__Host-') && (!cookie.secure || cookie.explicit_path != '/' || cookie.explicit_domain)) {
      // Cookies with the __Host- prefix must have the Secure flag, must have Path=/, and must not specify a domain
      return;
    }

    // No additional checks to perform here for cookies with the Partitioned, httpOnly, SameSite, or Path flags (TODO is this correct?)
    // TODO could add https://www.npmjs.com/package/testcafe tests for testing how browsers handle cookies

    // Matching rules described on step 11 here: https://www.rfc-editor.org/rfc/rfc6265#section-5.3
    const index = this.cookies.findIndex((other) => {
      console.warn('cookie', cookie, 'other', other)
      return cookie.name === other.name && 
        cookie.domain === other.domain &&
        cookie.path === other.path
    })
    const shouldDelete = cookie.value == "" || cookie.expired()
    if (index !== -1) {
      if (shouldDelete) {
        // If found an existing cookie and the new one is blank, delete the existing one
        delete this.cookies[index]
      }
      else {
        // If found an existing cookie and the new one is not blank, update the existing one
        this.cookies[index] = cookie;
      }
    }
    else if (!shouldDelete) {
      // If there was no existing cooie and the new one is not blank, add it to the jar
      this.cookies.push(cookie)
    }
  }

  upsertCookies(cookies, request_url) {
    console.warn(cookies)
    for (const cookie of cookies) {
      this.upsertCookie(cookie, request_url);
    }
  }

  removeExpired() {
    this.cookies = this.cookies.filter(cookie => !cookie.expired())
  }

  getCookies() {
    this.removeExpired()
    return this.cookies
  }
}