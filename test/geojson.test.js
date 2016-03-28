var test = require('tape');
var path = require('path');
var bench = require('../lib/index.js');

var options = {};

test('geojson: success', function(assert) {
  
  var s = path.resolve('./test/fixtures/us-counties-polygons.geojson');
  bench(s, 'v3.5.0', options, function(err, stats) {
    if (err) throw err;
    console.log(stats);
    assert.equal(stats.version, 'v3.5.0', 'version matches');
    assert.ok(stats.time.start <= stats.time.xml, 'time: start < xml');
    assert.ok(stats.time.xml <= stats.time.bridge, 'time: xml < bridge');
    assert.ok(stats.time.bridge <= stats.time.load, 'time: bridge < load');
    assert.ok(stats.time.load <= stats.time.copy, 'time: load < copy');
    assert.end();
  });
});

test('geojson: input data does not exist', function(assert) {
  bench('/not/a/fixture', 'v3.5.0', options, function(err, stats) {
    assert.ok(err, 'source file does not exist');
    assert.end();
  });
});