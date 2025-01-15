All browsers:

-

Chrome/Edge/Opera (TODO if these apply to firefox also):

- Opening an AWS tab in a new window (right click a link -> "Open Link in New Window") will not carry over cookies from the tab you're opening from (you'll be signed out in the new window). To work around this, open the link in a new tab in the same window first (e.g. by cmd+clicking it), and then move the tab out into a new window
- Closing a tab and undo-closing it (cmd+shift+t) will not restore the original cookies to that tab
- You can no longer "View Page Source" for AWS pages

Safari:

- Safari is not supported due to incompatibilities with the WebExtension api (they do not support declarativeNetRequest `RuleCondition.initiatorDomains`): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest#browser_compatibility
