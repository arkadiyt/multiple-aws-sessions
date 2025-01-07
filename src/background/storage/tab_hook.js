// TODO document

export class TabHookStorage {
  static #tabRulesUpdated = {};

  static isHooked = (tabId) => {
    return Object.hasOwn(this.#tabRulesUpdated, tabId);
  };

  static dataForTab = (tabId) => {
    return (this.#tabRulesUpdated[tabId] || {}).data;
  };

  static setHookForTab = (tabId, data = {}) => {
    this.#tabRulesUpdated[tabId] = { ...Promise.withResolvers(), data };
    return this.#tabRulesUpdated[tabId].promise;
  };

  static resolve(tabId, url) {
    this.resolveIf(tabId, url, () => true);
  }

  static resolveIf = async (tabId, url, cond) => {
    const { resolve, data } = this.#tabRulesUpdated[tabId];
    delete this.#tabRulesUpdated[tabId];

    if (!cond(data)) {
      // console.log('resolveIf, skipping');
      return;
    }

    await chrome.tabs.update(tabId, { url: 'about:blank' });
    // console.log('resolving', url);
    resolve(url);
  };
}
