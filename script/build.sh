#!/bin/bash
set -xe

rm -rf dist/*
npx webpack

WORK_DIR=$(mktemp -d)
mkdir -p build
CWD=$(pwd)
cp -r _locales img manifest.json dist $WORK_DIR
cd $WORK_DIR
zip -r $CWD/build/chrome.zip .
cd $CWD
rm -rf $WORK_DIR