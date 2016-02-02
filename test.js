var minimist = require('minimist');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var bytes = require('bytes');
var mercator = new(require('sphericalmercator'))()

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
        '  --output (write tiles to directory)',
        '  --verbose (print tiles as they are finished rendering)'
        ].join('\n'));
    process.exit(1);
}

var argv = minimist(process.argv.slice(2));

if (argv._.length < 2) {
    return usage();
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
    process.exit(1)
}

xml_map_path = path.resolve(xml_map_path);

// path concat to import the proper node-mapnik version based ont he mapnik-version we've passed in
var submodules_directory = path.join(argv._[1],'node_modules');

if (!fs.existsSync(submodules_directory)) {
    console.log('file does not exist',submodules_directory);
    process.exit(1)
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
 * Create a No Operation (NOOP) protocol for tilelive that mimicks the API
 * 
 * For the purpose of this benchmark suite we want to save time
 * by notsaving to file system so this removes a layer of 
 * complexity for benching unless you pass an output directory
 */
if (argv.output) {
    mkdirp.sync(argv.output)
    sink = 'file://' + path.join(__dirname,argv.output+'?filetype=webp');
} else {
    sink = 'noop://';

    function NOOP(uri, callback) {
        return callback(null,this);
    }

    var tile_count = 0;
    NOOP.prototype.putTile = function(z, x, y, tile, callback) {
        if (argv.verbose) {
            var bbox = mercator.bbox(x,y,z, false, '900913');
            console.log('no-op putTile',z,x,y,JSON.stringify(bbox));
        }
        tile_count++;
        return callback(null);
    }

    NOOP.prototype.putInfo = function(info, callback) {
        if (argv.verbose) {
            console.log('no-op putInfo',info);
        }
        return callback(null);
    }

    NOOP.prototype.startWriting = function(callback) {
        if (argv.verbose) {
            console.log('no-op startWriting');
        }
        return callback(null);
    }

    NOOP.prototype.stopWriting = function(callback) {
        if (argv.verbose) {
            console.log('no-op stopWriting');
        }
        return callback(null);
    }

    // register NOOP into tilelive so we can use later
    tilelive.protocols['noop:'] = NOOP;
}


var urisrc = tilelive.auto(source);
var urisink = tilelive.auto(sink);

/*
 * Loading the instance of the source, which will gather
 * information and execute tilelive.copy where the benchmarks
 * are located
 */
tilelive.load(urisrc, function(err, sourceInstance) {
    if (err) return next(err);

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
        console.log('')
        console.log('Config -> using node ' + process.version);
        console.log('Config -> using mapnik at ' + mapnik_modules.join(''));
        console.log('Config -> source options:',JSON.stringify(options));
        console.log('Config -> threadpool size:',process.env.UV_THREADPOOL_SIZE);
        console.log('Config -> sink:',sink);

        var stats = {
            max_rss:0,
            max_heap:0
        };

        // gives us a snapshot of what the peak usage was during the tilelive.copy process
        var memcheck = setInterval(function() {
            var mem = process.memoryUsage();
            if (mem.rss > stats.max_rss) stats.max_rss = mem.rss;
            if (mem.heapUsed > stats.max_heap) stats.max_heap = mem.heapUsed;
            var line = 'Memory -> peak rss: ' + bytes(stats.max_rss) + ' / peak heap: ' + bytes(stats.max_heap);
            if (process.platform === 'win32') {
                process.stdout.write('\033[0G'+line);
            } else {
                process.stdout.write('\r'+line);
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
                    console.log('')
                    console.log('Result -> elapsed time: ' + elapsed + 's');
                    if (tile_count > 0) {
                        console.log('Result -> total tiles rendered: ' + tile_count);
                        console.log('Result -> tiles per second: ' + tile_count/elapsed);
                        console.log('Result -> tiles per second per thread: ' + tile_count/elapsed/process.env.UV_THREADPOOL_SIZE);
                    }
                    clearInterval(memcheck);
                    console.log('Test is done: process will exit once map pool is automatically reaped');
                    process.exit(0); // if profiling, we don't want to include the time it takes to reap the pool
                }       
            });
        });
    });
});