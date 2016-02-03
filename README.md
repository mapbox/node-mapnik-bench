
## GDAL / Node.js tiling benchmark

[![Build Status](https://travis-ci.org/mapbox/node-mapnik-bench.svg?branch=master)](https://travis-ci.org/mapbox/node-mapnik-bench)

### Setup

To install files needed for the benchmark do:

```sh
./install.sh
```

This will install some basic node.js deps into `./node_modules` and it will install node-mapnik binaries + related tilelive modules into the `./mapnik-versions` directory.

### Running Benchmark

To run the benchmark:

1) Setup a testcase

2) Run `node test.js <path to testcase> <path to mapnik version directory>`

For example:

```sh
./testcases/tif/90-50-7/setup.sh
node test.js testcases/tif/90-50-7/map.xml mapnik-versions/v3.1.6
```