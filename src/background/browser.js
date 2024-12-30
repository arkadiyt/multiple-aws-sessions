/**
 * Browser compatibility/polyfill to support Chrome/Firefox/etc
 */

/**
 * In Chrome when calling chrome.webRequest.onHeadersReceived.addListener, the last option specifies whether or not response
 * headers should be included. In Firefox and others just specifying "responseHeaders" is sufficient. For Chrome it used to be,
 * but starting in Chrome 72 you need to specify "extraHeaders" to receive the Cookie header and some other sensitive headers.
 * Specifying this option unconditionally causes an error in Firefox, so the value below contains the right options to include
 * depending on whether the current browser needs it or not.
 */
export const onHeadersReceivedOptions = [
  'responseHeaders',
  chrome.webRequest.OnHeadersReceivedOptions.EXTRA_HEADERS,
].filter((opt) => typeof opt !== 'undefined');

/**
 * To not have a memory leak / clean up after ourselves, we remove storage keys we don't need. Chrome lets you get a list of existing
 * keys with chrome.storage.session.getKeys(), but Firefox doesn't have that method
 */
export const supportsListingSessionStorageKeys = typeof chrome.storage.session.getKeys !== 'undefined';
