#!/usr/bin/env bash

# this tests all geojson files against all mapnik versions specified

# remove previous visual/data.json to make way for a new one
DATA_FILE=visual/data.json
rm -rf ${DATA_FILE}
touch ${DATA_FILE}
echo '{ "versions": {} }' >> ${DATA_FILE}

TESTCASE=/Users/mapsam/mapbox/gdal-tiling-bench/testcases/geojson/*
OPTIONS=${OPTIONS:="--threadpool=8"}

for v in v2_spec latest v3.4.9 v3.4.0
do
	echo "RUNNING ${v}"
	for t in ${TESTCASE}
	do
		echo "> against ${t##*/map.xml}"
		node test.js ${t}/map.xml ${OPTIONS} mapnik-versions/${v} --json
	done
done