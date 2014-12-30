#!/usr/bin/env sh
find ./src ./tests -name "*.js" | xargs node_modules/.bin/js-beautify -j -r -t --good-stuff
