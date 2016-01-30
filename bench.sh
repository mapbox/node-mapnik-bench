#!/usr/bin/env bash

# defaults
NODE_VERSION=${NODE_VERSION:-"0.10"}
TESTCASE=${TESTCASE:-"./testcases/L7"}
OPTIONS=${OPTIONS:="--null-bridge --threadpool=8"}

echo "Testing '${TESTCASE}' with '${OPTIONS}'"

set -ex

if [[ ${NODE_VERSION} != "4" ]]; then
    node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.2.0/;
fi

node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.4.9/

node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/latest
