export function cs(name, value, {domain, path, secure, httponly, samesite, partitioned, expires, maxage} = {}) {
  let val = `${name}=${value};`
  if (domain !== undefined) {
    val += `Domain=${domain};`
  }
  if (path !== undefined) {
    val += `Path=${path};`
  }
  if (expires !== undefined) {
    val += `Expires=${expires};`
  }
  if (maxage !== undefined) {
    val += `Max-Age=${maxage};`
  }
  if (secure !== undefined) {
    val += 'Secure;'
  }
  if (httponly !== undefined) {
    val += 'httpOnly;'
  }
  if (samesite !== undefined) {
    val += `SameSite=${samesite};`
  }
  if (partitioned !== undefined) {
    val += 'Partitioned;'
  }

  return val
}