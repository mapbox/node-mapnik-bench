#!/usr/bin/env bash

set -e

# defaults
NODE_VERSION=${NODE_VERSION:-"0.10"}
TESTCASE=${TESTCASE:-"./testcases/L7"}
OPTIONS=${OPTIONS:="--null-bridge --threadpool=8"}

if [[ ${NODE_VERSION} != "4" ]]; then
    node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.2.0/;
fi

node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.4.9/

export GTIFF_DIRECT_IO=YES
node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.4.9/

export GTIFF_DIRECT_IO=NO
export GTIFF_VIRTUAL_MEM_IO=YES
node test.js ${TESTCASE}/map.xml ${OPTIONS} mapnik-versions/v3.4.9/
