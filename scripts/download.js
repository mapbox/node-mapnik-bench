var testcases = require('../testcases/index.js');
var fs = require('fs');
var https = require('https');
var path = require('path');

for (var type in testcases) {
  testcases[type].forEach(function(t) {
    download(t);
  });
}

function download(fixture) {
  var name = path.basename(fixture.path);
  var sink = fs.createWriteStream(fixture.path, { flags : 'w' });

  https.get('https://s3.amazonaws.com/mapbox/node-mapnik-bench/geom/' + name, function(res) {
    if (res.statusCode != 200 ) {
      throw new Error('Server returned status code: '+ res.statusCode);
    }
    res.setEncoding('utf8');
    var body = '';
    res.on('data', function (chunk) {
      sink.write(chunk);
    });
    res.on('end',function(err) {
      if (err) throw err;
      console.log('wrote ' + fixture.path);
      sink.end();
    });
  });
}