#!/usr/bin/env bash

set -e

# install basic node deps
npm install

# now we install mapnik+tilelive-bridge+tilelive pairs that work(ed) together in the past
# we're interested in when the mapnik version major or minor was bumped
# https://github.com/mapbox/tilelive-bridge/releases

# https://github.com/mapbox/tilelive-bridge/blob/v1.2.5/package.json#L16
if [[ ${NODE_VERSION} != "4" ]]; then
    #(cd mapnik-versions/v3.1.6 && npm install && npm ls mapnik tilelive-bridge)

    # https://github.com/mapbox/tilelive-bridge/blob/v1.2.7/package.json#L16
    (cd mapnik-versions/v3.2.0 && npm install && npm ls mapnik tilelive-bridge)

    # https://github.com/mapbox/tilelive-bridge/blob/v1.4.0/package.json#L16
    #(cd mapnik-versions/v3.4.0 && npm install && npm ls mapnik tilelive-bridge)

    # https://github.com/mapbox/tilelive-bridge/blob/v1.4.1/package.json#L16
    #(cd mapnik-versions/v3.4.1 && npm install && npm ls mapnik tilelive-bridge)

fi

# https://github.com/mapbox/tilelive-bridge/blob/v2.1.0/package.json#L16
(cd mapnik-versions/v3.4.9 && npm install && npm ls mapnik tilelive-bridge)

(cd mapnik-versions/latest && npm install && npm ls mapnik tilelive-bridge)

(cd mapnik-versions/v2_spec && npm install && npm ls mapnik tilelive-bridge)
