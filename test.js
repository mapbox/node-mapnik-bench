
var minimist = require('minimist')
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');

function usage() {
    console.log([
        '',
        'usage:',
        '',
        '  Write tiles to directory:',
        '    node test.js <path to tiff> <path to output tile directory>',
        '',
        '  Write tiles to nowhere (just generate them):',
        '    node test.js <path to tiff> --noop',
        '',
        'options:',
        '  --threadpool=N',
        '  --minzoom=N',
        '  --maxzoom=N',       
        '  --bounds=minx,miny,maxx,maxy',
        '  --noop (write to nothing)',
        '  --verbose (when using --noop print tiles as they are finished rendering)'
        ].join('\n'));
    process.exit(1);
}

var argv = minimist(process.argv.slice(2));

if ((argv._.length == 1 && !argv.noop) && argv._.length < 2) {
    return usage();
}

if (argv.threadpool) {
    process.env.UV_THREADPOOL_SIZE = argv.threadpool;
} else {
    // increase the libuv threadpool size to 1.5x the number of logical CPUs.
    process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, require('os').cpus().length * 1.5));
}

var tiff = argv._[0];

if (!fs.existsSync(tiff)) {
    console.log('file does not exist',tiff);
    process.exit(1)
}


var tilelive = require('tilelive');
var Bridge = require('tilelive-bridge');
var File = require('tilelive-file');
var mercator = new(require('sphericalmercator'))()

Bridge.registerProtocols(tilelive);
File.registerProtocols(tilelive);

var xml_template_path = path.join(__dirname,'map-template.xml');
var xml_map_path = path.join(__dirname,'map.xml');
var xml = fs.writeFileSync(xml_map_path,fs.readFileSync(xml_template_path).toString("utf-8").replace('{{file}}',tiff));

var source = 'bridge://'+xml_map_path;

var sink;


if (!argv.noop) {
    var output = argv._[1];
    if (!output) {
        console.log("please pass a directory to write tiles to (or pass --noop flag to write to nowhere)");
    }
    mkdirp.sync(output)
    sink = 'file://' + path.join(__dirname,output+'?filetype=webp');
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
    var options = {};
    if (argv.bounds) argv.bounds = argv.bounds.split(',').map(Number);
    options.minzoom = argv.minzoom || info.minzoom;
    options.maxzoom = argv.maxzoom || info.maxzoom;
    options.bounds = argv.bounds || info.bounds;
    options.type = argv.scheme || 'pyramid';
    console.log('Config -> source options:',JSON.stringify(options));
    console.log('Config -> threadpool size:',process.env.UV_THREADPOOL_SIZE);
    console.log('Config -> sink:',sink);

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
            process.exit(0);
        }       
    });
});