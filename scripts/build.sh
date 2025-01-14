#!/bin/bash
set -xe

make clean
npx webpack
mkdir -p build

TARGETS="${TARGETS:-chrome firefox opera edge}"

for TARGET in $TARGETS; do
  WORK_DIR=$(mktemp -d)
  cp -r _locales img dist "$WORK_DIR"
  npx ejs manifest.json.ejs --data-input "{\"target\":\"$TARGET\"}" --output-file "$WORK_DIR/manifest.json"
  VERSION=$(jq -r .version "$WORK_DIR/manifest.json")

  if [ "$TARGET" = "firefox" ]; then  
    npx web-ext lint -s "$WORK_DIR"
    npx web-ext build -s "$WORK_DIR" -a build/
    mv "build/multiple_aws_sessions-$VERSION.zip" "build/$TARGET-$VERSION.zip"
    npx web-ext run  -s "$WORK_DIR" --devtools
  else
    CWD=$(pwd)
    cd "$WORK_DIR"
    zip -r "$CWD/build/$TARGET-$VERSION.zip" .
    cd "$CWD"
  fi

  rm -rf "$WORK_DIR"
done


