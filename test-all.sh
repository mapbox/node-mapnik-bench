#!/usr/bin/env bash

# this tests all geojson files against all mapnik versions specified

# get system info for data file
# todo: this is unix specific right now
DATE=`date +%s`
echo ${DATE}
PLATFORM=`uname`
RELEASE=`uname -r`
ARCHITECTURE=`uname -m`
DATA_FILE=visual/${DATE}.json
touch ${DATA_FILE}
BODY="{ \"versions\": {}, \"date\": \"${DATE}\", \"platform\": \"${PLATFORM}\", \"release\": \"${RELEASE}\", \"architecture\": \"${ARCHITECTURE}\" }"
echo ${BODY} >> ${DATA_FILE}

TESTCASE=testcases/geojson/*
OPTIONS=${OPTIONS:="--threadpool=8"}

for v in v2_spec latest v3.4.9 v3.4.0
do
	echo "RUNNING ${v}"
	for t in ${TESTCASE}
	do
		echo "> against ${t##*/map.xml}"
		FILE=${DATA_FILE} node test.js ${t}/map.xml ${OPTIONS} mapnik-versions/${v} --json
	done
done