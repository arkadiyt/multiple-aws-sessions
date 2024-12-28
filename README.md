- get linter down to 0
- setup github CI/CD pipeline, add dependabot config
- submit to all web stores
- add to bug bounty program

# multiple-aws-sessions

### TOC

- [What's it for](https://github.com/arkadiyt/multiple-aws-sessions#whats-it-for)
- [Installation](https://github.com/arkadiyt/multiple-aws-sessions#installation)
- [How it works](https://github.com/arkadiyt/multiple-aws-sessions#how-it-works)
- [Permissions](https://github.com/arkadiyt/multiple-aws-sessions#permissions)
- [Security](https://github.com/arkadiyt/multiple-aws-sessions#security)

### What's it for

Engineers often have a need to sign into multiple AWS accounts (or even a single account with multiple roles), which AWS doesn't allow - when you sign into the 2nd account you're signed out of the 1st.

This extension removes this restriction, and allows you to be signed into as many accounts as you want in a single browser window.

### Installation

#### Webstores

- Chrome: https://chrome.google.com/webstore/detail/xoom-redirector/ocabkmapohekeifbkoelpmppmfbcibna
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/zoom-redirector/
- Edge: https://microsoftedge.microsoft.com/addons/detail/dkhjempaiackknhjkkaidppoepkdamen
- Opera: https://addons.opera.com/en/extensions/details/zoom-redirector/

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

If you think you've found a security issue, please report it to me either on my hackerone program (link) or message me on Signal (@arkadiyt.01)
