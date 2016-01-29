#!/usr/bin/env bash

export CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd ${CURRENT_DIR}

FILENAME=kathmandu_nepal_osm_point.geojson

if [[ ! -f ./${FILENAME} ]]; then
    wget https://s3.amazonaws.com/mapbox/playground/mapsam/${FILENAME}
else
    echo "done: already downloaded ${FILENAME}"
fi