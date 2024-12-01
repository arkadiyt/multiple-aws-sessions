export const cs = (name, value, { domain, path, secure, httponly, samesite, partitioned, expires, maxage } = {}) => {
  let val = `${name}=${value};`;
  if (typeof domain !== 'undefined') {
    val += `Domain=${domain};`;
  }
  if (typeof path !== 'undefined') {
    val += `Path=${path};`;
  }
  if (typeof expires !== 'undefined') {
    val += `Expires=${expires};`;
  }
  if (typeof maxage !== 'undefined') {
    val += `Max-Age=${maxage};`;
  }
  if (secure === true) {
    val += 'Secure;';
  }
  if (httponly === true) {
    val += 'httpOnly;';
  }
  if (typeof samesite !== 'undefined') {
    val += `SameSite=${samesite};`;
  }
  if (partitioned === true) {
    val += 'Partitioned;';
  }

  return val;
};
