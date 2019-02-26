#!/bin/bash

npm version patch -m "Updating version to %s" --git-tag-version
echo //registry.npmjs.org/:_authToken=$NPM_API_KEY > ~/.npmrc
npm publish
