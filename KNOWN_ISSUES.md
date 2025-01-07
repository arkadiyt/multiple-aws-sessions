All browsers:

-

Chrome:

- Opening a tab in a new window (right click a link -> "Open Link in New Window") will not carry over cookies from the tab you're on. To work around this, open the link in a new tab first (e.g. by cmd+clicking it), and then move the tab out into a new window

Firefox:

-

Edge:

-

Opera:

-

Safari:

- Safari is not supported due to incompatibilities with the WebExtension api (they do not support declarativeNetRequest `RuleCondition.initiatorDomains`): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest#browser_compatibility
