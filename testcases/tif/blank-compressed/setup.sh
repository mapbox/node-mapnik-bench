#!/usr/bin/env bash

export CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd ${CURRENT_DIR}

FILENAME=hires.tif

if [[ ! -f ./${FILENAME} ]]; then
    wget https://springmeyer.s3.amazonaws.com/${FILENAME}
else
    echo "done: already downloaded ${FILENAME}"
fi