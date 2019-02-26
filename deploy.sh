#!/bin/bash

echo //registry.npmjs.org/:_authToken=$NPM_API_KEY > ~/.npmrc
git stash && npm version $1 && npm publish
