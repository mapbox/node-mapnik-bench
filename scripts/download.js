#!/usr/bin/env node

var testcases = require('../testcases/index.js');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var path = require('path');

for (var type in testcases) {
  testcases[type].forEach(function(t) {
    download(t);
  });
}

function download(fixture) {
  var name = path.basename(fixture.path);
  var sink = fs.createWriteStream(fixture.path);
  
  s3.getObject({
    Bucket: 'mapbox/node-mapnik-bench/geom', 
    Key: name
  })
    .on('httpData', function(chunk) {
      sink.write(chunk);
    })
    .on('httpDone', function() {
      sink.end();
    })
    .send();
}