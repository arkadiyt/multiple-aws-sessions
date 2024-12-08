/**
 * RFCs:
 * Cookies: https://www.rfc-editor.org/rfc/rfc6265
 * Samesite attribute: https://www.ietf.org/archive/id/draft-west-first-party-cookies-07.txt
 * Partitioned attribute: https://www.ietf.org/archive/id/draft-cutler-httpbis-partitioned-cookies-01.txt
 */

export class Cookie {
  constructor(cookieStr, requestUrl) {
    this.parse(cookieStr, requestUrl);
  }

  parse(cookieStr, requestUrl) {
    // TODO make my own parsing implementation

    const parts = cookieStr.split(';').filter((value) => Boolean(value));
    let i;

    let pair = parts[0].match(/([^=]+)=([\s\S]*)/u);
    if (!pair) {
      throw new Error(`Invalid cookie header encountered. Header: '${cookieStr}'`);
    }

    let key = pair[1];
    let value = pair[2];
    if (typeof key !== 'string' || key.length === 0 || typeof value !== 'string') {
      throw new Error(`Unable to extract values from cookie header. Cookie: '${cookieStr}'`);
    }

    this.name = key;
    this.value = value;

    const url = new URL(requestUrl);
    this.domainSpecified = false;
    this.domain = url.hostname;
    this.pathSpecified = false;
    this.path =
      url.pathname === undefined || url.pathname === '/' || !url.pathname.startsWith('/')
        ? '/'
        : url.pathname.replace(/\/$/u, '');

    // TODO
    // this.httponly = false;
    // this.expires = undefined;
    // this.maxage = undefined;
    // this.expirationTimestamp = undefined;
    // this.secure = false;
    // this.samesite = 'lax'; // TODO is this correct default?
    // this.partitioned = false;

    for (i = 1; i < parts.length; i += 1) {
      pair = parts[i].match(/([^=]+)(?:=([\s\S]*))?/u);
      key = pair[1].trim().toLowerCase();
      value = pair[2];
      switch (key) {
        case 'httponly':
          this.httponly = true;
          break;
        case 'expires':
          this.expires = value;
          break;
        case 'max-age':
          this.maxage = parseInt(value, 10);
          break;
        case 'path':
          this.path = value.trim();
          this.pathSpecified = true;
          break;
        case 'domain':
          // Ignore leading dot
          value = value.trim();
          value = value[0] === '.' ? value.substring(1, value.length) : value;
          this.domain = value;
          this.domainSpecified = true;
          break;
        case 'secure':
          this.secure = true;
          break;
        case 'samesite':
          value = value ? value.toLowerCase() : value;
          if (value && ['none', 'lax', 'strict'].includes(value)) {
            this.samesite = value;
          } else {
            throw new Error('Invalid samesite flag');
          }
          break;
        case 'partitioned':
          this.partitioned = true;
          break;
      }
    }

    // TODO split out into method
    this.session = this.expires === undefined && this.maxage === undefined;
    // If both are set, maxage takes precedence
    if (this.maxage !== undefined) {
      this.expirationTimestamp = Date.now() + this.maxage;
    } else if (this.expires !== undefined) {
      this.expirationTimestamp = Date.parse(this.expires);
    }
  }

  expired() {
    return !this.session && this.expirationTimestamp <= Date.now();
  }

  toString() {
    return `${this.name}=${this.value}`;
  }

  static unmarshal(object) {
    const cookie = new Cookie('a=a', 'https://127.0.0.1');
    cookie.name = object.name;
    cookie.value = object.value;
    cookie.domainSpecified = object.domainSpecified;
    cookie.domain = object.domain;
    cookie.pathSpecified = object.pathSpecified;
    cookie.path = object.path;
    cookie.httponly = object.httponly;
    cookie.expires = object.expires;
    cookie.maxage = object.maxage;
    cookie.secure = object.secure;
    cookie.samesite = object.samesite;
    cookie.partitioned = object.partitioned;
    cookie.session = object.session;
    cookie.expirationTimestamp = object.expirationTimestamp;
    return cookie;
  }
}

export const cookieHeader = (cookies) => cookies.map((cookie) => cookie.toString()).join('; ');