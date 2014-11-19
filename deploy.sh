#!/usr/bin/env sh
./node_modules/urequire-cli/build/code/urequire-cli.js combined ./src -o ./deploy/jet.js
./node_modules/urequire-cli/build/code/urequire-cli.js combined ./src -O -o ./deploy/jet.min.js
