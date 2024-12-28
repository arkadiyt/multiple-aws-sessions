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
    const parts = cookieStr.split(';').filter((str) => str !== '');
    try {
      [, this.name, this.value] = parts.shift().match(/([^=]+)=(.*)/u);
    } catch {
      throw new Error('Invalid cookie header');
    }
    const url = new URL(requestUrl);

    this.httponly = false;
    this.expires = void 0;
    this.maxage = void 0;
    this.path =
      typeof url.pathname === 'undefined' || url.pathname === '/' || !url.pathname.startsWith('/')
        ? '/'
        : url.pathname.replace(/\/$/u, '');
    this.pathSpecified = false;
    this.domain = url.hostname;
    this.domainSpecified = false;
    this.secure = false;
    this.samesite = 'lax';
    this.partitioned = false;
    this.expirationTimestamp = void 0;

    for (const part of parts) {
      const [, key, val] = part.match(/([^=]+)(?:=(.*))?/u);
      switch (key.trim().toLowerCase()) {
        case 'httponly':
          this.httponly = true;
          break;
        case 'expires':
          this.expires = val;
          break;
        case 'max-age':
          this.maxage = parseInt(val, 10);
          break;
        case 'path':
          this.path = val.trim();
          this.pathSpecified = true;
          break;
        case 'domain':
          this.domain = val.trim().replace(/^\./u, '');
          this.domainSpecified = true;
          break;
        case 'secure':
          this.secure = true;
          break;
        case 'samesite':
          this.samesite = val.toLowerCase();
          if (!['none', 'lax', 'strict'].includes(this.samesite)) {
            throw new Error(`Invalid samesite flag ${this.samesite}`);
          }
          break;
        case 'partitioned':
          this.partitioned = true;
          break;
        default:
          throw new Error(`Unknown cookie flag ${key}`);
      }
    }

    // If both are set, maxage takes precedence
    if (typeof this.maxage !== 'undefined') {
      this.expirationTimestamp = Date.now() + this.maxage;
    } else if (typeof this.expires !== 'undefined') {
      this.expirationTimestamp = Date.parse(this.expires);
    }

    if (Number.isNaN(this.expirationTimestamp)) {
      throw new Error('Invalid expires or max-age');
    }
  }

  session() {
    return typeof this.expires === 'undefined' && typeof this.maxage === 'undefined';
  }

  expired() {
    return !this.session() && this.expirationTimestamp <= Date.now();
  }

  toString() {
    return `${this.name}=${this.value}`;
  }

  static unmarshal(object) {
    // Ugly but the values will be overwritten below
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
    cookie.expirationTimestamp = object.expirationTimestamp;
    return cookie;
  }
}

export const cookieHeader = (cookies) => cookies.map((cookie) => cookie.toString()).join('; ');
