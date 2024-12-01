export function sessionRulesFromCookieJar(cookieJar, tabId) {
  const cookies = cookieJar.getCookies();
  console.log(cookies)
  return cookies.map((cookie, index) => {
    const scheme = cookie.secure ? 'https' : '*'
    return {
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {
            header: 'cookie',
            operation: 'set',
            value: cookie.toValueString()
          }
        ]
      },
      condition: {
        tabIds: [tabId],
        urlFilter: `${scheme}://${cookie.domain}${cookie.path}*` // TODO injection from set-cookie header domain/path/etc value?
      },
      id: index + 1,
      priority: index + 1,
    }
  })
}