// Split request id writes into 30 buckets to reduce lock contention
// The original approach actually wrote every request to a separate key (so no locking was necessary at all),
// but I'd like to clean up / reap the keys after they're no longer needed, and that requires getting a list of all
// keys in storage. Chrome supports listing all keys in storage, but Firefox doesn't
export class RequestIdStorage {
  static #buckets = 30;

  static setTabIdForRequestId = (requestId, tabId) => {
    const bucket = requestId % this.#buckets;
    const key = `request_${bucket}`;
    return navigator.locks.request(key, async () => {
      const requests = (await chrome.storage.session.get(key))[key] || {};
      requests[requestId] = {
        tabId,
        timestamp: Date.now(),
      };
      await chrome.storage.session.set({
        [key]: requests,
      });
    });
  };

  static getTabIdFromRequestId = async (requestId) => {
    const bucket = requestId % this.#buckets;
    const key = `request_${bucket}`;
    const requests = (await chrome.storage.session.get(key))[key] || {};
    const { tabId } = requests[requestId] || {};
    return tabId;
  };

  static clearOldRequestKeys = (expiration) => {
    const now = Date.now();
    const promises = new Array(this.buckets).fill().map((_item, bucket) => {
      const key = `request_${bucket}`;
      return navigator.locks.request(key, async () => {
        const requests = (await chrome.storage.session.get(key))[key] || {};
        const filteredRequests = Object.fromEntries(
          Object.entries(requests).filter(([_requestId, val]) => now - val.timestamp >= expiration),
        );
        await chrome.storage.session.set({
          [key]: filteredRequests,
        });
      });
    });
    return Promise.all(promises);
  };
}
