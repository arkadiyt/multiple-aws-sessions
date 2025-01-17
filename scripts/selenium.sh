#!/bin/bash
set -xe

TARGETS="${TARGETS:-chrome firefox opera edge}"

for TARGET in $TARGETS; do
    SELENIUM_BROWSER=$TARGET NODE_OPTIONS="--experimental-vm-modules" npx jest --testTimeout 180000 test/selenium
done

# merge coverage reports and output