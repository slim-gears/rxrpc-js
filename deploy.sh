#!/bin/bash

echo //registry.npmjs.org/:_authToken=${NPM_API_KEY} > ~/.npmrc
echo always-auth=true >> ~/.npmrc
git stash && yarn version --new-version $1 && yarn publish
