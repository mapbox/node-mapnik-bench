#!/usr/bin/env node

'use strict';

var bench = require('../lib/index.js');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));
var usage = fs.readFileSync(__dirname+ '/usageall').toString();
var path = require('path');
var os = require('os');

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

bench(group[fixturecount].path, versions[vcount], {}, endBench);
function endBench(err, stats) {
  if (err) throw err;
  console.log(group[fixturecount].name, versions[vcount]);

  // create fixture object
  if (!data.fixtures[group[fixturecount].name]) {
    data.fixtures[group[fixturecount].name] = group[fixturecount];
    data.fixtures[group[fixturecount].name].results = [];
  }
  
  // append results
  data.fixtures[group[fixturecount].name].results.push(stats);
  fixturecount++;
  try {
    bench(group[fixturecount].path, versions[vcount], {}, endBench);
  } catch (e) {
    
    data.versions.push(versions[vcount]);
    vcount++;
    // if we have tested all versions, end it
    if (vcount >= versions.length) return finish();
    
    // otherwise reset fixtures, bump version, bench again
    fixturecount = 0;
    bench(group[fixturecount].path, versions[vcount], {}, endBench);
  }
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