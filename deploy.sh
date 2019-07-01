#!/bin/bash

echo //registry.npmjs.org/:_authToken=${NPM_API_KEY} > ~/.yarnrc
git stash && yarn version --new-version $1 && yarn publish
