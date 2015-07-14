
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
        '  --threadpool=N',
        '  --minzoom=N',
        '  --maxzoom=N',       
        '  --bounds=minx,miny,maxx,maxy',
        '  --write-to (write tiles to directory)',
        '  --verbose (print tiles as they are finished rendering)'
        ].join('\n'));
    process.exit(1);
}

var argv = minimist(process.argv.slice(2));

if (argv._.length < 2) {
    return usage();
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
var Bridge = require(path.join(submodules_directory,'tilelive-bridge'));

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
      throw err;
    }
    var options = { close: true };
    if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
    options.minzoom = argv.minzoom || info.minzoom;
    options.maxzoom = argv.maxzoom || info.maxzoom;
    options.bounds = argv.bounds || info.bounds;
    options.type = argv.scheme || 'pyramid';
    console.log('')
    console.log('Config -> source options:',JSON.stringify(options));
    console.log('Config -> threadpool size:',process.env.UV_THREADPOOL_SIZE);
    console.log('Config -> sink:',sink);

    var stats = {
        max_rss:0,
        max_heap:0
    }

    var memcheck = setInterval(function() {
        var mem = process.memoryUsage();
        if (mem.rss > stats.max_rss) stats.max_rss = mem.rss;
        if (mem.heapUsed > stats.max_heap) stats.max_heap = mem.heapUsed;
        process.stdout.write('\r\033[KMemory -> peak rss: ' + bytes(stats.max_rss) + ' / peak heap: ' + bytes(stats.max_heap));
    },1000);

    var start = new Date().getTime() / 1000;
    tilelive.copy(source, sink, options, function(err) {
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
        }       
    });
});