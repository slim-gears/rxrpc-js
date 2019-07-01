#!/bin/bash

echo //registry.npmjs.org/:_authToken=${NPM_API_KEY} > ~/.npmrc
git stash && yarn --new-version $1 && yarn publish
