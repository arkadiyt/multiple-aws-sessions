TODO Bugs:

- switching regions logs you out
- helper tooltips are reset on every login (noflush_awscnm javascript cookie)

TODO features:

- handle user opening new tab from existing window (incl. "view source" if possible)
- remove rules when a hooked tab navigates away from AWS, or the tab closes. also delete the cookie jar. maybe with some grace window in case someone navigates away, then clicks back

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
