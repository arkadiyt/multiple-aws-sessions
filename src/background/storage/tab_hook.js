// // TODO document

// /**
//  * pauseTabNavigation(tabId)
// - stores value (used by webNavigation)

// resumeTabNavigation(tabId)
// - delete entry
// - returns value if there was one

// migrate one case at a time:
// - onHeaderReceived redirects (remove redirect logic, just apply always)
// - onTab created
//  */
// export class TabHookStorage {
//   static #tabRulesUpdated = {};

//   static pauseTabNavigation = (tabId, cookieTabId) => {
//     if (Object.hasOwn(this.#tabRulesUpdated, tabId)) {
//       return;
//     }
//     this.#tabRulesUpdated[tabId] = { tabId: cookieTabId };
//     console.log('pauseTabNavigation', this.#tabRulesUpdated)
//   };

//   // static isPaused = (tabId) => {
//   //   return 
//   // }

//   static cookieTabForTabId = (tabId) => {
//     return (this.#tabRulesUpdated[tabId] || {}).tabId
//   }

//   static updateValue = (tabId, value) => {
//     if (!Object.hasOwn(this.#tabRulesUpdated, tabId)) {
//       console.log('updateValue not updating because tab is not hooked')
//       return void 0;
//     }
//     console.log('updateValue updating to ', value)
//     this.#tabRulesUpdated[tabId].value = value;
//     return this.#tabRulesUpdated[tabId].tabId;
//   };

//   static resumeTabNavigation = (tabId) => {
//     const result = (this.#tabRulesUpdated[tabId] || {}).value;
//     delete this.#tabRulesUpdated[tabId];
//     console.log('resumeTabNavigation', this.#tabRulesUpdated)
//     return result;
//   };
// }

// // export class TabHookStorage {
// //   static #tabRulesUpdated = {};

// //   static isHooked = (tabId) => {
// //     return Object.hasOwn(this.#tabRulesUpdated, tabId);
// //   };

// //   static dataForTab = (tabId) => {
// //     return (this.#tabRulesUpdated[tabId] || {}).data;
// //   };

// //   static setHookForTab = (tabId, data = {}) => {
// //     this.#tabRulesUpdated[tabId] = { ...Promise.withResolvers(), data };
// //     return this.#tabRulesUpdated[tabId].promise;
// //   };

// //   static resolve(tabId, url) {
// //     this.resolveIf(tabId, url, () => true);
// //   }

// //   static resolveIf = async (tabId, url, cond) => {
// //     const { resolve, data } = this.#tabRulesUpdated[tabId];
// //     delete this.#tabRulesUpdated[tabId];

// //     if (!cond(data)) {
// //       // console.log('resolveIf, skipping');
// //       return;
// //     }

// //     await chrome.tabs.update(tabId, { url: 'about:blank' });
// //     // console.log('resolving', url);
// //     resolve(url);
// //   };
// // }
