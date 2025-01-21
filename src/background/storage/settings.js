export class SettingsStorage {
  static #loadColors = async () => {
    const key = 'colors';
    return (await chrome.storage.sync.get(key))[key] || {};
  };

  static getColorForAccount = async (accountId) => (await this.#loadColors())[accountId];

  static saveColorForAccount = async (accountId, color) => {
    const colors = await this.#loadColors();
    colors[accountId] = color;
    return chrome.storage.sync.set({ colors });
  };
}
