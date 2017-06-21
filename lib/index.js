var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var os = require('os');
var NOOP = require('./noop');
var Memcheck = require('./memcheck');
var byteConvert = require('./memcheck').byteConvert;
var tilelive = require('tilelive');
var File = require('tilelive-file');
var cp = require('child_process');

function checkDupes(name) {
  var num_modules = Object.keys(require.cache).filter(function(p) {
    return (p.indexOf(name) > -1);
  });
  return num_modules;
}

module.exports = bench;

/*
 * Run a benchmark operation
 * @param {string | array} source file path uri
 * options.threadpool
 */
function bench(src, version, options, callback) {

  if (!src) throw new Error('No options provided');
  if (!version) throw new Error('No version provided!');
  if (typeof options !== 'object') throw new Error('Options is not an object');
  if (!callback) throw new Error('No callback provided');

  src = path.resolve(src);
  if (!fs.existsSync(src)) throw new Error('Source file does not exist', src);

  if (!fs.existsSync('./mapnik-versions/' + version + '/') &&
      !fs.existsSync('./mapnik-versions/' + version + '/node_modules/')) {
    throw new Error(version + ' does not exist or has not been setup. Run npm install in that directory.');
  }

  // if the source is an array (from testcases), loop through
  // each and rerun this function with a single string
  if (typeof src === 'object') {
    for (var s in src) {
      bench(src[s], options, callback);
    }
  }

  // stats object is what we use to store information about
  // the process along the way so we can report back
  var stats = {
    source: src,
    version: version,
    options: options || {},
    time: {
      start: Date.now()
    }
  };

  /*
   * Prepare Node Mapnik version
   */
  if (!version) return callback('No mapnik version supplied');
  
  // get path of node mapnik version based on version supplied (assumes mapnik-version dir)
  var submodulesDir = path.join('mapnik-versions', version, 'node_modules');
  if (!fs.existsSync(submodulesDir)) callback('No node_modules directory for "'+version+'", try npm install');
  submodulesDir = path.resolve(submodulesDir);

  // Set up tilelive-bridge using the proper tilelive-bridge module
  try {
      var Bridge = require(path.join(submodulesDir ,'tilelive-bridge'));
  } catch (e) {
      var Bridge = require(path.join(submodulesDir ,'@mapbox/tilelive-bridge'));
  }

  // banning dupes in key modules
  ['mapnik.js',
   'tilelive.js',
   'tilelive-bridge/index.js',
   'mapnik-pool/index.js'
  ].forEach(function(name) {
    var modules_list = checkDupes('mapnik.js');
    if (modules_list.length > 1) {
      return callback('Illegal dupes detected for "'+ name + '":\n' + modules_list.join('\n'));
    }
  });

  // register protocols
  Bridge.registerProtocols(tilelive); // source
  File.registerProtocols(tilelive); // sink

  // prepare sink using fillSink()
  var Sink = fillSink(options),
      sink = (Array.isArray(Sink)) ? Sink[0] : Sink,
      protocol = (Array.isArray(Sink)) ? Sink[1] : false,
      urisink = tilelive.auto(sink);
  stats.sink = sink;

  generateXML(src, function(err, xml) {
    if (err) {
        console.log(err);
        return callback('Error generating XML');
    }
    stats.time.xml = Date.now();
    
    // create new bridge, which is a tilelive instance
    var bridge = new Bridge({ xml: xml }, function(err, source) {
      if (err) return callback(err);
      stats.time.bridge = Date.now();

      // get info for preparing tilelive
      source.getInfo(function(err, info){
        if (err) return callback('Cannot get source information');
        stats.time.info = Date.now();

        // define options to pass in tilelive.copy
        var tilelive_options = { close: true };
        if (options.bounds) tilelive_options.bounds = options.bounds.split(',').map(Number);
        tilelive_options.minzoom = options.minzoom || info.minzoom;
        tilelive_options.maxzoom = options.maxzoom || info.maxzoom;
        tilelive_options.bounds = options.bounds || info.bounds;
        tilelive_options.type = options.scheme || 'pyramid';

        stats.memory = Memcheck(stats.memory);
        var memcheck = setInterval(function() {
          stats.memory = Memcheck(stats.memory);
        }, 1000);
        
        tilelive.load(urisink, function(err, sinkInstance) {
          if (err) return callback('Error loading sink ' + sink);
          stats.time.load = Date.now();

          tilelive.copy(source, sinkInstance, tilelive_options, function(err) {
            if (err) return callback('Cannot copy: ' + err);
            stats.time.copy = Date.now();
            stats.memory = byteConvert(stats.memory);
            stats.tile_count = protocol.tile_count;
            clearInterval(memcheck);
            if (protocol.tile_count > 0) {
              return callback(null, stats);
            } else {
              return callback('No tiles were produced');
            }
          });
        });
      });      
    });
  });
}

/*
 * Use mapnik-omnivore and tilelive-omnivore for
 * generating XML
 *
 */
function generateXML(filepath, callback) {
  var args = [
    path.join(path.dirname(require.resolve('tilelive-omnivore')),'bin/mapnik-omnivore'),
    path.resolve(filepath)
  ];
  var options = {};
  cp.execFile(process.execPath, args, options, function(err, stdout, stderr) {
    if (err) {
        return callback(err);
    }
    return callback(null,stdout.toString());
  });
}

/*
 * Set our file saving protocol based on user input
 * Defaults to noop:// since we don't usually want to
 * calculate file system operation time in our benchmark
 */
function fillSink(options) {
  var sink;
  var protocol;
  if (options.output) {
    mkdirp.sync(options.output);
    sink = 'file://' + path.join(__dirname, options.output+'?filetype=webp');
    return sink;
  } else {
    tilelive.protocols['noop:'] = new NOOP({verbose: options.verbose});
    sink = 'noop://';
    protocol = tilelive.protocols['noop:'];
    return [sink, protocol];
  }
}
