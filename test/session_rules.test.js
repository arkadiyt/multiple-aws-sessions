describe('sessionRulesFromCookieJar', () => {
  it('TODO', () => {

  })
//   const TAB_ID = 2

//   function cookieJarFromCookies(cookieStrings, request_url) {
//     const cookieJar = new CookieJar();
//     cookieJar.upsertCookies(cookieStrings, request_url);
//     return cookieJar;
//   }
  
//   it('creates 1 session rule', () => {
//     const cookieJar = cookieJarFromCookies([cs("aws-creds", "1", {domain: "us-east-1.aws.amazon.com"})], 'https://us-east-1.aws.amazon.com/')
//     const result = sessionRulesFromCookieJar(cookieJar, TAB_ID)
    
//     expect(result).toHaveLength(1)
//     expect(result[0].condition.tabIds).toEqual([TAB_ID])
//     expect(result[0].condition.urlFilter).toBe('*://us-east-1.aws.amazon.com/*')
//     expect(result[0].id).toBe(1)
//     expect(result[0].priority).toBe(1)
//     expect(result[0].action.requestHeaders[0].value).toBe('aws-creds=1')
//   })

//   it('creates 2 uncollapsed session rules', () => {
//     const cookieJar = cookieJarFromCookies([
//       cs("aws-creds", "1", {domain: "us-east-1.aws.amazon.com", secure: true}),
//       cs("aws-creds", "2", {domain: "signin.aws.amazon.com", secure: true})
//     ], 'https://us-east-1.aws.amazon.com/')
//     const result = sessionRulesFromCookieJar(cookieJar, TAB_ID)
    
//     expect(result).toHaveLength(2)
//     expect(result[0].condition.urlFilter).toBe('https://us-east-1.aws.amazon.com/*')
//     expect(result[0].id).toBe(1)
//     expect(result[0].priority).toBe(1)
//     expect(result[0].action.requestHeaders[0].value).toBe('aws-creds=1')
//     expect(result[1].condition.urlFilter).toBe('https://signin.aws.amazon.com/*')
//     expect(result[1].id).toBe(2)
//     expect(result[1].priority).toBe(2)
//     expect(result[1].action.requestHeaders[0].value).toBe('aws-creds=1')
//   })

})
