/*
A amazon.com (1)
B aws.amazon.com (2)
C us-east-1.aws.amazon.com/ec2 (3)
F us-east-1.aws.amazon.com/ec2/asd (3)
D us-east-1.aws.amazon.com (3)
E signin.aws.amazon.com (3)




signin.aws.amazon.com -> E, B, A
us-east-1.aws.amazon.com/ec2/asd -> A, B, C, F, D
us-east-1.aws.amazon.com/ec2
us-east-1.aws.amazon.com

sort domains by 1) number of segments, 2) domain name, 3) number of path segments


*/

// Cookie RFC: https://www.rfc-editor.org/rfc/rfc6265
// TODO handle multiple cookies in single set-cookie header
export class Cookie {
  constructor(cookieStr, request_url) {
    this.parse(cookieStr, request_url)
  }

  parse(cookieStr, request_url) {
    // TODO make my own
    // TODO path should default to request path (see https://www.rfc-editor.org/rfc/rfc6265#section-4.1.2.4)
    var parts = cookieStr.split(";").filter(function (value) {
      return !!value;
    });
    var i;
    
    var pair = parts[0].match(/([^=]+)=([\s\S]*)/);
    if (!pair) {
      throw new Error(`Invalid cookie header encountered. Header: '${cookieStr}'`);
    }
    
    var key = pair[1];
    var value = pair[2];
    if ( typeof key !== 'string' || key.length === 0 || typeof value !== 'string' ) {
      throw new Error(`Unable to extract values from cookie header. Cookie: '${cookieStr}'`)
    }
    
    this.name = key;
    this.value = value;
    
    const url = new URL(request_url)
    this.domain_specified = false
    this.domain = url.hostname
    this.path_specified = false
    // this.path = url.pathname // TODO more complex directory rules for this

    for (i = 1; i < parts.length; i += 1) {
      pair = parts[i].match(/([^=]+)(?:=([\s\S]*))?/);
      key = pair[1].trim().toLowerCase();
      value = pair[2];
      switch (key) {
        case "httponly":
        this.httponly = true;
        break;
        case "expires":
        this.expires = value
        break;
        case "max-age":
        this.maxage = parseInt(value);
        break;
        case "path":
        this.path = value ?
        value.trim() :
        "";
        this.path_specified = true;
        break;
        case "domain":
        this.domain = value ?
        value.trim() :
        new URL(request_url).hostname;
        this.domain_specified = true;
        break;
        case "secure":
        this.secure = true;
        break;
        case "samesite":
        value = value ? value.toLowerCase() : value
        if (value && ["none", "lax", "strict"].includes(value)) {
          this.samesite = value
        }
        else {
          throw new Error('Invalid samesite flag')
        }
        break;
        case "partitioned":
        this.partitioned = true
        break;
      }
    }
    
    this.session = this.expires === undefined && this.maxage === undefined
    // If both are set, maxage takes precedence
    if (this.maxage !== undefined) {
      this.expiration_timestamp = Date.now() + this.maxage
    }
    else if (this.expires !== undefined) {
      this.expiration_timestamp = Date.parse(this.expires)
    }
  }

  expired() {
    return !this.session && this.expiration_timestamp <= Date.now()
  }
}



