#!/usr/bin/env node

'use strict';

var bench = require('../lib/index.js');
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var usage = fs.readFileSync(__dirname+ '/usage').toString();
var path = require('path');
var os = require('os');

/* Set the node.js threadpool
 *
 * It is important that we set this before any async work is triggered as
 * my understanding (dane) is that the value is cached once the threadpool
 * is created inside node
 *
 * the size defaults to 4, which is quite small and we can get better performance if we
 * bump it up to something default or 1.5 times the CPU power on your machine
 *
 * recording threadpool size is important because it can have drastic
 * effects on the benchmark output
 */
if (argv.threadpool) {
  process.env.UV_THREADPOOL_SIZE = argv.threadpool;
} else {
  var size = Math.ceil(Math.max(4, os.cpus().length * 1.5));
  process.env.UV_THREADPOOL_SIZE = size;
}

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
  console.log(JSON.stringify(message));
  process.exit(code);
}