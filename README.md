# multiple-aws-sessions

### Table of Contents

- [What's it for](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#whats-it-for)
- [Installation](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#installation)
- [How it works](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#how-it-works)
- [Permissions](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#permissions)
- [Security](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#security)

### What's it for

Engineers often have a need to sign into multiple AWS accounts (or even a single account with multiple roles), which AWS doesn't allow - when you sign into another account you're signed out of the first one.

This extension removes this restriction, and allows you to transparently sign into as many accounts as you want in a single browser window.

### Installation

#### From webstores:

- [Chrome](https://chromewebstore.google.com/detail/multiple-aws-sessions/ehffbdpahpebdgpmnecccpfmbokeohop)
- [Firefox](TODO)
- [Edge](TODO)
- [Opera](TODO confirm https://addons.opera.com/en/extensions/details/multiple-aws-sessions/)

#### From source:

1. Run these commands:

```
git clone https://github.com/arkadiyt/multiple-aws-sessions
cd multiple-aws-sessions
npm install
npx webpack
```

2. Enable loading unpacked extensions in your browser. In Google Chrome this can be done by going into your extension settings (`chrome://extensions/`) and checking the "Developer mode" slider in the upper right corner

3. Click the "Load unpacked" button that appeared in the upper left corner and select the folder you cloned this repo into

### How it works

See this blog post:

### Permissions

Here are the permissions used by multiple-aws-sessions and why it requests them. See also [PRIVACY.md](https://github.com/arkadiyt/multiple-aws-sessions/blob/main/PRIVACY.md).

- `declarativeNetRequest`: This is used to write rules that determine which cookies get sent with requests from different AWS tabs. It is the heart of this extension
- `storage`: This is used to store cookies and various bookkeeping settings
- `webRequest`: This is used to keep track of which requests are coming from which tabs
- Host permissions for `*://*.aws.amazon.com/*`: This is needed to receive access to Set-Cookie response headers from AWS

### Security

See [SECURITY.md](https://github.com/arkadiyt/multiple-aws-sessions/blob/main/SECURITY.md)
