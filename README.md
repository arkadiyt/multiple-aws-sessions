- get linter down to 0
- setup github CI/CD pipeline

TODO Bugs:

TODO features:

- remove rules when a hooked tab navigates away from AWS, or the tab closes. also delete the cookie jar. maybe with some grace window in case someone navigates away, then clicks back

Maybe:

- console also uses localStorage, sessionStorage, and indexedDB that might require per-tab mocking
- maybe some bugs would be fixed if I hook earlier, sometimes cookies/localstorage are read before I hook them (but got some errors if I hook _too_ early, like document is not defined)

# multiple-aws-profiles

### TOC

- installation
- how it works
- permissions
- security

### Installation

link to all webstores

from source:

1. Clone this repo

2. Go into your chrome extension settings (`chrome://extensions/`) and check the "Developer mode" slider in the upper right corner

3. Click the "Load unpacked" button that appeared in the upper left corner and select the folder you cloned this repo into

building:

- npm install
- npx webpack
-

### how it works

see this blog post:

### permissions

explanation of permissions

### security
