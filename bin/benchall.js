#!/usr/bin/env node

'use strict';

var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var usage = fs.readFileSync(__dirname+ '/usageall').toString();
var path = require('path');
var os = require('os');
var cp = require('child_process');

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
if (argv._.length < 1) console.log(usage);

// get fixture
if (!fs.existsSync(path.resolve(argv._[0]))) exit('Fixture module does not exist!', 1);
var fixtures = require(path.resolve(argv._[0]));

if (!fixtures[argv._[1]]) exit('Fixture group does not exist', 1);
var group = fixtures[argv._[1]];

// get versions
if (argv._.slice(2).length === 0) exit('No versions specified.', 1);
var versions = argv._.slice(2);

// date stamp for json
var now = Date.now();
var data = {
  date: now,
  group: argv._[0],
  fixtures: {},
  versions: [],
  os: {
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch()
  }
};

// loop through each fixture, testing each version of mapnik
var vcount = 0;
var fixturecount = 0;

// TODO expose options as command line params
execute(group[fixturecount].path, versions[vcount], {}, endBench);
function endBench(err, stats) {
  if (err) throw err;

  // create fixture object
  if (!data.fixtures[group[fixturecount].name]) {
    data.fixtures[group[fixturecount].name] = group[fixturecount];
    data.fixtures[group[fixturecount].name].results = [];
  }
  
  // append results
  data.fixtures[group[fixturecount].name].results.push(stats);
  fixturecount++;
  try {
    execute(group[fixturecount].path, versions[vcount], {}, endBench);
  } catch (e) {
    
    data.versions.push(versions[vcount]);
    vcount++;
    // if we have tested all versions, end it
    if (vcount >= versions.length) return finish();
    
    // otherwise reset fixtures, bump version, bench again
    fixturecount = 0;
    execute(group[fixturecount].path, versions[vcount], {}, endBench);
  }
}

// executes bench.js in it's own shell, avoiding mapnik dupes
function execute(file, version, options, callback) {
  console.log(version + ': ' + file);
  var args = [
    path.join(__dirname,'bench.js'),
    path.resolve(group[fixturecount].path),
    versions[vcount]
  ];
  cp.execFile(process.execPath, args, options, function(err, stdout, stderr) {
    if (err) {
      return callback(err);
    }
    callback(null, JSON.parse(stdout));
  });
}

function finish() {
  // write data to file
  fs.writeFile(path.join('./visual', now + '.json'), JSON.stringify(data), function(err) {
    if (err) throw err;
    exit('Success! Results are located at visual/' + now + '.json', 0);
  });
}

function exit(message, code) {
  console.log(message);
  process.exit(code);
}