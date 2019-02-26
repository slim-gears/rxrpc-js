#!/bin/bash

npm version patch -m "Updating version"
git push --tags
echo //registry.npmjs.org/:_authToken=$NPM_API_KEY > ~/.npmrc
npm publish
