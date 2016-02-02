var minimist = require('minimist');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var bytes = require('bytes');
var fs = require('fs');
var argv = minimist(process.argv.slice(2));
var NOOP = require('./src/NOOP')(argv);

function usage() {
    console.log([
        '',
        'usage:',
        '',
        '  Write tiles to directory:',
        '    node test.js <path to xml> <path to dir with mapnik+tilelive-bridge>',
        '',
        'options:',
        '  --null-bridge',
        '  --threadpool=N',
        '  --minzoom=N',
        '  --maxzoom=N',       
        '  --bounds=minx,miny,maxx,maxy',
        '  --write-to (write tiles to directory)',
        '  --verbose (print tiles as they are finished rendering)',
        '  --json (outputs benchmark stats into a timestamped JSON file)'
        ].join('\n'));
    process.exit(1);
}

if (argv._.length < 2) {
    return usage();
}

/*
 * Grab data.json file to prepare for writing out data
 * only if `--json` flag is passed
 */
if (argv.json) {
    var body,
        json = {},
        mapnik_version = null,
        geom = null,
        file = __dirname+'/visual/data.json';

    // read visual/data.json to start appending
    fs.readFile(file, function(err, res) {
        if (err) throw err;
        body = JSON.parse(res);
    });
}

/* Set the node.js threadpool
 *
 * the size defaults to 4, which is quite small and we can get better performance if we
 * bump it up to something default or 1.5 times the CPU power on your machine
 * 
 * we should always list threadpool this in the report because it can have drastic
 * effects on the benchmark output
**/
if (argv.threadpool) {
    // take user input
    process.env.UV_THREADPOOL_SIZE = argv.threadpool;
} else {
    // increase the libuv threadpool size to 1.5x the number of logical CPUs.
    process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, require('os').cpus().length * 1.5));
}

// get the map.xml path from arguments
var xml_map_path = argv._[0];

if (!fs.existsSync(xml_map_path)) {
    console.log('file does not exist',xml_map_path);
    process.exit(1);
}

xml_map_path = path.resolve(xml_map_path);

// path concat to import the proper node-mapnik version based ont he mapnik-version we've passed in
var submodules_directory = path.join(argv._[1],'node_modules');

if (!fs.existsSync(submodules_directory)) {
    console.log('file does not exist',submodules_directory);
    process.exit(1);
}

submodules_directory = path.resolve(submodules_directory);

var tilelive = require('tilelive');
var File = require('tilelive-file');

// Set up tilelive-bridge using the proper tilelive-bridge module
var Bridge = require(path.join(submodules_directory,'tilelive-bridge'));

// checking for mapnik dupes
var mapnik_modules = Object.keys(require.cache).filter(function(p) {
    return (p.indexOf('mapnik.js') > -1);
});

if (mapnik_modules.length > 1) {
    console.log('duplicate mapnik modules encountered',mapnik_modules);
    process.exit(1);
}


/*
 * registering tilelive backends
 * https://github.com/mapbox/tilelive/blob/master/API.md
 */

// sink puts tiles into the filesystem in the format they were 
// given (either .webp or .mvt)
File.registerProtocols(tilelive);
// source will output a .mvt or .webp based on input data
// (geojson > .mvt for example)
Bridge.registerProtocols(tilelive);
var source = 'bridge://'+xml_map_path;
var sink;

/*
 * Set our file saving protocol based on user input
 * Defaults to noop://
 */
if (argv.output) {
    mkdirp.sync(argv.output);
    sink = 'file://' + path.join(__dirname,argv.output+'?filetype=webp');
} else {
    // add the NO OPeration protocol to tilelive so we can use it
    tilelive.protocols['noop:'] = NOOP;
    sink = 'noop://';
}

var urisrc = tilelive.auto(source);
var urisink = tilelive.auto(sink);

/*
 * Loading the instance of the source, which will gather
 * information and execute tilelive.copy where the benchmarks
 * are located
 */
tilelive.load(urisrc, function(err, sourceInstance) {
    if (err) throw err;

    /*
     * Get metadata for the source of tiles, all generated from
     * the map.xml file
    */
    sourceInstance.getInfo(function(err, info) {
        if (err) {
          throw err;
        }

        // define options to pass in tilelive.copy
        var options = { close: true };
        if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
        options.minzoom = argv.minzoom || info.minzoom;
        options.maxzoom = argv.maxzoom || info.maxzoom;
        options.bounds = argv.bounds || info.bounds;
        options.type = argv.scheme || 'pyramid';
        
        // add benchmark info to json if the object exists
        if (json) {
            var versionarray = mapnik_modules.join('').split('/');
            var version = versionarray[versionarray.indexOf('mapnik-versions')+1];
            mapnik_version = version;

            // create version in body.versions if it doesn't exist
            if (!body.versions[mapnik_version]) body.versions[mapnik_version] = {};

            // create geometry object with current file
            var geomarray = source.split('/');
            geom = geomarray[geomarray.indexOf('map.xml')-1];
            body.versions[mapnik_version][geom] = {};        

            // start packing json to add as updated geometry file info
            json.config = {
                mapnik_version: mapnik_version,
                node_version: process.version,
                source_options: options,
                threadpool_size: process.env.UV_THREADPOOL_SIZE,
                sink: sink
            };
        } else {
            console.log('');
            console.log('Config -> using node ' + process.version);
            console.log('Config -> using mapnik at ' + mapnik_modules.join(''));
            console.log('Config -> source options:', JSON.stringify(options));
            console.log('Config -> threadpool size:', process.env.UV_THREADPOOL_SIZE);
            console.log('Config -> sink:', sink);
        }

        var stats = {
            max_rss:0,
            max_heap:0
        };

        // gives us a snapshot of what the peak usage was during the tilelive.copy process
        var memcheck = setInterval(function() {
            var mem = process.memoryUsage();
            if (mem.rss > stats.max_rss) stats.max_rss = mem.rss;
            if (mem.heapUsed > stats.max_heap) stats.max_heap = mem.heapUsed;
            if (!json) {
                var line = 'Memory -> peak rss: ' + bytes(stats.max_rss) + ' / peak heap: ' + bytes(stats.max_heap);
                if (process.platform === 'win32') {
                    process.stdout.write('\033[0G'+line);
                } else {
                    process.stdout.write('\r'+line);
                }
            }
        },1000);

        // loading the instance of the sink, which points to the NOOP protocol
        // function by default
        tilelive.load(urisink, function(err, sinkInstance) {
            if (err) throw err;
            
            // how long does it take to create tiles from now until they are complete?
            var start = new Date().getTime() / 1000;
            
            // run tilelive.copy, when callback is run it assumes all tiles have been rendered
            tilelive.copy(sourceInstance, sinkInstance, options, function(err) {
                if (err) {
                    console.log(err);
                    process.exit(1);
                } else {
                    var end = new Date().getTime() / 1000;
                    var elapsed = end - start;
                    if (!json) {
                        console.log('')
                        console.log('Result -> elapsed time: ' + elapsed + 's');
                    }
                    if (tile_count > 0) {
                        if (json) {
                            json.result = {
                                time: elapsed,
                                tiles_rendered: tile_count,
                                tiles_per_second: tile_count/elapsed,
                                tiles_per_second_per_thread: tile_count/elapsed/process.env.UV_THREADPOOL_SIZE,
                                mem_rss: bytes(stats.max_rss),
                                mem_heap: bytes(stats.max_heap)
                            };
                        } else {
                            console.log('Result -> total tiles rendered: ' + tile_count);
                            console.log('Result -> tiles per second: ' + tile_count/elapsed);
                            console.log('Result -> tiles per second per thread: ' + tile_count/elapsed/process.env.UV_THREADPOOL_SIZE);
                            console.log('Test is done: process will exit once map pool is automatically reaped');
                        }
                    }
                    clearInterval(memcheck);
                    process.exit(0); // if profiling, we don't want to include the time it takes to reap the pool
                }       
            });
        });
    });
});