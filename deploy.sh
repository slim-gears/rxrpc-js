#!/bin/bash

npm version $1
echo //registry.npmjs.org/:_authToken=$NPM_API_KEY > ~/.npmrc
npm publish
