#!/usr/bin/env node

'use strict';

var bench = require('../lib/index.js');
var fs = require('fs');
var fixtures = require('../testcases/index.js');
var argv = require('minimist')(process.argv.slice(2));
var usage = fs.readFileSync(__dirname+ '/usage').toString();

// usage
if (argv._.length < 1) {
    console.log(usage);
    process.exit(-1);
}

var source = argv._[0];
if (!fs.existsSync(source)) {
  exit(source + ' does not exist!', 1);
}

var version = (argv._[1]) ? argv._[1] : 'latest';
if (!fs.existsSync('./mapnik-versions/' + version + '/') &&
    !fs.existsSync('./mapnik-versions/' + version + '/node_modules/')) {
  exit(version + ' does not exist or has not been setup. Run npm install in that directory.', 1);
}

var opts = {};
if (argv.threadpool) opts.threadpool = argv.threadpool;
if (argv.minzoom) opts.minzoom = argv.minzoom;
if (argv.maxzoom) opts.maxzoom = argv.maxzoom;
if (argv.bounds) opts.bounds = argv.bounds;
if (argv.scheme) opts.scheme = argv.scheme;

bench(source, version, opts, function(err, stats) {
  if (err) exit(err, 1);

  // report back based on "save" or "console"
  // probably best to default to console
  exit(stats, 0);
});

function exit(message, code) {
  console.log(message);
  process.exit(code);
}