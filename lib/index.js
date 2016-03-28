var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var os = require('os');
var NOOP = require('./noop');
var Memcheck = require('./memcheck');
var byteConvert = require('./memcheck').byteConvert;
var tilelive = require('tilelive');
var File = require('tilelive-file');
var omnivore = require('tilelive-omnivore');
var getMetadata = require('mapnik-omnivore').digest;

module.exports = bench;

/*
 * Run a benchmark operation
 * @param {string | array} source file path uri
 * options.threadpool
 */
function bench(src, version, options, callback) {

  src = path.resolve(src);
  if (!fs.existsSync(src)) return callback('Source file does not exist', src);

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
    options: options,
    time: {
      start: Date.now()
    }
  };

  /* Set the node.js threadpool
   *
   * the size defaults to 4, which is quite small and we can get better performance if we
   * bump it up to something default or 1.5 times the CPU power on your machine
   * 
   * recording threadpool size is important beacuse it can have drastic
   * effects on the benchmark output
   */
  if (options.threadpool) {
    process.env.UV_THREADPOOL_SIZE = options.threadpool;
  } else {
    var size = Math.ceil(Math.max(4, os.cpus().length * 1.5));
    process.env.UV_THREADPOOL_SIZE = options.threadpool = size;
  }

  /*
   * Prepare Node Mapnik version
   */
  if (!version) return callback('No mapnik version supplied');
  
  // get path of node mapnik version based on version supplied (assumes mapnik-version dir)
  var submodulesDir = path.join('mapnik-versions', version, 'node_modules');
  if (!fs.existsSync(submodulesDir)) callback('No node_modules directory for "'+version+'", try npm install');
  submodulesDir = path.resolve(submodulesDir);

  // Set up tilelive-bridge using the proper tilelive-bridge module
  var Bridge = require(path.join(submodulesDir ,'tilelive-bridge'));

  // checking for mapnik dupes
  var mapnik_modules = Object.keys(require.cache).filter(function(p) {
    // we are using tilelive-omnivore & mapnik-omnivore for utiliy functions
    // and never touch their mapnik instance
    return (p.indexOf('mapnik.js') > -1 && 
            p.indexOf('tilelive-omnivore') === -1 && 
            p.indexOf('mapnik-omnivore') === -1);
  });
  // if (mapnik_modules.length > 1) 
  //   console.log(mapnik_modules);
  //   return callback('Too many mapnik modules!\n' + mapnik_modules.join('\n'));

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
    if (err) return callback('Error generating XML');
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
            if (err) return callback('Cannot copy\nSource: ' + source + '\nSink: ' + sink);
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
  getMetadata(filepath, function(err, metadata) {
    if (err) return callback(err);
    metadata.filepath = filepath;
    return callback(null, omnivore.getXml(metadata));
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