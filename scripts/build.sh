#!/bin/bash
set -xe

rm -rf build/*

TARGETS="${TARGETS:-chrome firefox opera edge}"
for TARGET in $TARGETS; do
  TARGET=$TARGET ZIP=1 npx webpack

  if [ "$TARGET" = "firefox" ]; then  
    npx web-ext lint -s dist
    if [ -n "$RUN" ]; then
      npx web-ext run -s dist --devtools
    fi
  fi
done
