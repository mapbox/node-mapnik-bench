#!/usr/bin/env bash

TESTCASE=/Users/mapsam/mapbox/gdal-tiling-bench/testcases/geojson/*
OPTIONS=${OPTIONS:="--threadpool=8"}

for t in ${TESTCASE}
do
	if [ "${t}" != "/Users/mapsam/mapbox/gdal-tiling-bench/testcases/geojson/points-1000" ] ; then
		# echo "Testing ${f##*/} against mapnik version ${v##*/}"
		node test.js ${t}/map.xml ${OPTIONS} mapnik-versions/v2_spec --json
	fi
done