
var minimist = require('minimist');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var bytes = require('bytes');

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
        '  --json (outputs benchmark stats into a JSON file)'
        ].join('\n'));
    process.exit(1);
}

var argv = minimist(process.argv.slice(2));

if (argv._.length < 2) {
    return usage();
}

if (argv.json) {
    var json = {};
}

if (argv.threadpool) {
    process.env.UV_THREADPOOL_SIZE = argv.threadpool;
} else {
    // increase the libuv threadpool size to 1.5x the number of logical CPUs.
    process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, require('os').cpus().length * 1.5));
}

var xml_map_path = argv._[0];

if (!fs.existsSync(xml_map_path)) {
    console.log('file does not exist',xml_map_path);
    process.exit(1)
}

xml_map_path = path.resolve(xml_map_path);

var submodules_directory = path.join(argv._[1],'node_modules');

if (!fs.existsSync(submodules_directory)) {
    console.log('file does not exist',submodules_directory);
    process.exit(1)
}

submodules_directory = path.resolve(submodules_directory);

var tilelive = require('tilelive');
var File = require('tilelive-file');

if (argv['null-bridge']) {
    // fake bridge that loads XML, but only renders and does not encode to image
    var Bridge = require('./null-bridge')(submodules_directory);
} else {
    // normal tilelive-bridge that defaults to encoding rasters as webp (which is expensive)
    var Bridge = require(path.join(submodules_directory,'tilelive-bridge'));
}

var mapnik_modules = Object.keys(require.cache).filter(function(p) {
    return (p.indexOf('mapnik.js') > -1);
});

if (mapnik_modules.length > 1) {
    console.log('duplicate mapnik modules encountered',mapnik_modules);
    process.exit(1);
}

File.registerProtocols(tilelive);
Bridge.registerProtocols(tilelive);
var source = 'bridge://'+xml_map_path;

var mercator = new(require('sphericalmercator'))()

var sink;

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

    tilelive.protocols['noop:'] = NOOP;
}

tilelive.info(source, function(err, info) {
    if (err) {
        // throw err;
        console.log(err);
    }
    var options = { close: true };
    if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
    options.minzoom = argv.minzoom || info.minzoom;
    options.maxzoom = argv.maxzoom || info.maxzoom;
    options.bounds = argv.bounds || info.bounds;
    options.type = argv.scheme || 'pyramid';

    // add benchmark info to json if the object exists
    if (json) {
        var urlarray = mapnik_modules.join('').split('/');
        var mapnik_version = urlarray[urlarray.indexOf('mapnik-versions')+1];
        json[mapnik_version] = {};
        json[mapnik_version].config = {
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
        max_rss: 0,
        max_heap: 0
    }

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

    var start = new Date().getTime() / 1000;
    tilelive.copy(source, sink, options, function(err) {
        if (err) {
            console.log(err);
            console.log("THERE WAS AN ERROR :(");
            // process.exit(1);
        } else {
            var end = new Date().getTime() / 1000;
            var elapsed = end - start;
            if (!json) {
                console.log('')
                console.log('Result -> elapsed time: ' + elapsed + 's');
            }
            if (tile_count > 0) {
                if (json) {
                    json[mapnik_version].result = {
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
            
        }       
        if (json) console.log(json);
    });
});