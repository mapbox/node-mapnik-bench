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

  console.log(src);
  if (!fs.existsSync(src)) return callback('Source file does not exist', src);

  // if the source is an array (from testcases), loop through
  // each and rerun this function with a single string
  if (typeof src === 'object') {
    for (var s in src) {
      console.log(src[s]);
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
  if (!fs.existsSync(submodulesDir)) callback('No node_modules directory, try npm install');
  submodulesDir = path.resolve(submodulesDir);

  // Set up tilelive-bridge using the proper tilelive-bridge module
  var Bridge = require(path.join(submodulesDir ,'tilelive-bridge'));

  // checking for mapnik dupes
  var mapnik_modules = Object.keys(require.cache).filter(function(p) {
    return (p.indexOf('mapnik.js') > -1);
  });
  // if (mapnik_modules.length > 1) 
  //   return callback('Too many mapnik modules!\n' + mapnik_modules.join('\n'));

  // register protocols
  Bridge.registerProtocols(tilelive); // source
  File.registerProtocols(tilelive); // sink

  /*
   * Set our file saving protocol based on user input
   * Defaults to noop://
   */
  var sink;
  if (options.output) {
      mkdirp.sync(argv.output);
      sink = 'file://' + path.join(__dirname,argv.output+'?filetype=webp');
  } else {
      // add the NO OPeration protocol to tilelive so we can use it
      tilelive.protocols['noop:'] = NOOP({verbose: options.verbose});
      sink = 'noop://';
  }
  stats.sink = sink;

  var urisink = tilelive.auto(sink);

  generateXML(src, function(err, xml) {
    if (err) return callback('Error generating XML');
    stats.time.xml = Date.now();
    
    // create new bridge, which is a tilelive instance
    var bridge = new Bridge({ xml: xml }, function(err, source) {
      if (err) return callback('Error in bridge');
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
            stats.tile_count = NOOP.tile_count;
            clearInterval(memcheck);
            // if (stats.tile_count > 0) {
              return callback(null, stats);
            // }
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







// // get the map.xml path from arguments
// var xml_map_path = argv._[0];

// if (!fs.existsSync(xml_map_path)) {
//     console.log('file does not exist',xml_map_path);
//     process.exit(1);
// }

// xml_map_path = path.resolve(xml_map_path);

// // path concat to import the proper node-mapnik version based ont he mapnik-version we've passed in
// var submodules_directory = path.join(argv._[1],'node_modules');

// if (!fs.existsSync(submodules_directory)) {
//     console.log('file does not exist',submodules_directory);
//     process.exit(1);
// }

// submodules_directory = path.resolve(submodules_directory);

// // Set up tilelive-bridge using the proper tilelive-bridge module
// var Bridge = require(path.join(submodules_directory,'tilelive-bridge'));

// // checking for mapnik dupes
// var mapnik_modules = Object.keys(require.cache).filter(function(p) {
//     return (p.indexOf('mapnik.js') > -1);
// });

// if (mapnik_modules.length > 1) {
//     console.log('duplicate mapnik modules encountered',mapnik_modules);
//     process.exit(1);
// }


// /*
//  * registering tilelive backends
//  * https://github.com/mapbox/tilelive/blob/master/API.md
//  */

// // sink puts tiles into the filesystem in the format they were 
// // given (either .webp or .mvt)
// File.registerProtocols(tilelive);
// // source will output a .mvt or .webp based on input data
// // (geojson > .mvt for example)
// Bridge.registerProtocols(tilelive);
// var source = 'bridge://'+xml_map_path;
// var sink;



// /*
//  * Loading the instance of the source, which will gather
//  * information and execute tilelive.copy where the benchmarks
//  * are located
//  */
// tilelive.load(urisrc, function(err, sourceInstance) {
//     if (err) throw err;

//     /*
//      * Get metadata for the source of tiles, all generated from
//      * the map.xml file
//     */
//     sourceInstance.getInfo(function(err, info) {
//         if (err) {
//           throw err;
//         }

//         // define options to pass in tilelive.copy
//         var options = { close: true };
//         if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
//         options.minzoom = argv.minzoom || info.minzoom;
//         options.maxzoom = argv.maxzoom || info.maxzoom;
//         options.bounds = argv.bounds || info.bounds;
//         options.type = argv.scheme || 'pyramid';
        
//         // add benchmark info to json if the object exists
//         if (json) {

//             var versionarray = mapnik_modules.join('').split('/');
//             var version = versionarray[versionarray.indexOf('mapnik-versions')+1];
//             mapnik_version = version;

//             // create version in body.versions if it doesn't exist
//             if (!body.versions[mapnik_version]) body.versions[mapnik_version] = {};

//             // create geometry object with current file
//             var geomarray = source.split('/');
//             geom = geomarray[geomarray.indexOf('map.xml')-1];
//             body.versions[mapnik_version][geom] = {};

//             // start packing json to add as updated geometry file info
//             json.config = {
//                 mapnik_version: mapnik_version,
//                 node_version: process.version,
//                 source_options: options,
//                 threadpool_size: process.env.UV_THREADPOOL_SIZE,
//                 sink: sink
//             };
//         } else {
//             console.log('');
//             console.log('Config -> using node ' + process.version);
//             console.log('Config -> using mapnik at ' + mapnik_modules.join(''));
//             console.log('Config -> source options:', JSON.stringify(options));
//             console.log('Config -> threadpool size:', process.env.UV_THREADPOOL_SIZE);
//             console.log('Config -> sink:', sink);
//         }

//         var memstats = {
//             max_rss:0,
//             max_heap:0,
//             max_heap_total:0
//         };

//         // gives us a snapshot of what the peak usage was during the tilelive.copy process
//         var memcheck = setInterval(function() {
//            stats.memory = Memcheck(stats.memory);
//         },1000);

//         // loading the instance of the sink, which points to the NOOP protocol
//         // function by default
//         tilelive.load(urisink, function(err, sinkInstance) {
//             if (err) throw err;
            
//             // how long does it take to create tiles from now until they are complete?
//             var start = new Date().getTime() / 1000;
            
//             // run tilelive.copy, when callback is run it assumes all tiles have been rendered
//             tilelive.copy(sourceInstance, sinkInstance, options, function(err) {
//                 if (err) {
//                     console.log(err);
//                     process.exit(1);
//                 } else {
//                     clearInterval(memcheck);
//                     var tile_count = NOOP.tile_count;
//                     var end = new Date().getTime() / 1000;
//                     var elapsed = end - start;
//                     if (!json) {
//                         console.log('');
//                         console.log('Result -> elapsed time: ' + elapsed + 's');
//                     }
//                     if (tile_count > 0) {
//                         if (json) {
//                             json.result = {
//                                 time: elapsed,
//                                 tiles_rendered: tile_count,
//                                 tiles_per_second: tile_count/elapsed,
//                                 tiles_per_second_per_thread: tile_count/elapsed/process.env.UV_THREADPOOL_SIZE,
//                                 mem_rss: bytes(stats.max_rss),
//                                 mem_heap: bytes(stats.max_heap)
//                             };

//                             // write to file
//                             body.versions[mapnik_version][geom] = json;
//                             fs.writeFile(file, JSON.stringify(body), function(err) {
//                                 if (err) throw err;
//                                 process.exit(0);
//                             });
//                         } else {
//                             console.log('Result -> total tiles rendered: ' + tile_count);
//                             console.log('Result -> tiles per second: ' + tile_count/elapsed);
//                             console.log('Result -> tiles per second per thread: ' + tile_count/elapsed/process.env.UV_THREADPOOL_SIZE);
//                             process.exit(0); // if profiling, we don't want to include the time it takes to reap the pool
//                         }
//                     }
                    
//                 } 
//             });
//         });
//     });
// });