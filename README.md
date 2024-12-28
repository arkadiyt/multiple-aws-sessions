- get linter down to 0
- setup github CI/CD pipeline, add dependabot config
- submit to all web stores, update links below and in blog post
- add to bug bounty program

# multiple-aws-sessions

### Table of Contents

- [What's it for](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#whats-it-for)
- [Installation](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#installation)
- [How it works](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#how-it-works)
- [Permissions](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#permissions)
- [Security](https://github.com/arkadiyt/multiple-aws-sessions?tab=readme-ov-file#security)

### What's it for

Engineers often have a need to sign into multiple AWS accounts (or even a single account with multiple roles), which AWS doesn't allow - when you sign into the 2nd account you're signed out of the 1st.

This extension removes this restriction, and allows you to be signed into as many accounts as you want in a single browser window.

### Installation

#### From webstores

- [Chrome](https://chrome.google.com/webstore/detail/xoom-redirector/ocabkmapohekeifbkoelpmppmfbcibna)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/zoom-redirector/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/dkhjempaiackknhjkkaidppoepkdamen)
- [Opera](https://addons.opera.com/en/extensions/details/zoom-redirector/)

#### From source

1. Run these commands:

```
git clone https://github.com/arkadiyt/multiple-aws-sessions
cd multiple-aws-sessions
npm install
npx webpack --no-watch
```

2. Go into your chrome extension settings (`chrome://extensions/`) and check the "Developer mode" slider in the upper right corner

3. Click the "Load unpacked" button that appeared in the upper left corner and select the folder you cloned this repo into

### How it works

See this blog post: #TODO

### Permissions

explanation of permissions

### Security

See [SECURITY.md](https://github.com/arkadiyt/multiple-aws-sessions/blob/main/SECURITY.md)
