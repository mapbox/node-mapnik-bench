#!/usr/bin/env bash

export CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd ${CURRENT_DIR}

FILENAME=nativeres.tif

if [[ ! -f ./${FILENAME} ]]; then
    wget https://s3.amazonaws.com/mapbox/playground/dnomadb/gdal-tiling-bench/${FILENAME}
else
    echo "done: already downloaded ${FILENAME}"
fi