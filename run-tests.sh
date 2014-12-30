#!/usr/bin/env sh
./node_modules/.bin/jetd.js &
sleep 2
./node_modules/.bin/some-service.js &
sleep 2
./node_modules/karma/bin/karma start --browsers Firefox --single-run
