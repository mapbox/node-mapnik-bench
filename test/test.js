var test = require('tape');
var path = require('path');
var bench = require('../lib/index.js');

var options = {};

test('fails: invalid parameters', function(assert) {
  var s = path.resolve('./test/fixtures/us-counties-polygons.geojson');
  assert.throws(function() { bench(); }, 'no parameters');
  assert.throws(function() { bench('/not/a/fixture', 'latest', options, function(err, stats) {}); }, 'source file does not exist');
  assert.throws(function() { bench(s, 'v0.0.0', options, function(err, stats) {}); }, 'version does not exist');
  assert.throws(function() { bench(s, 'latest', 'options', function(err, stats) {}); }, 'options is not an object');
  assert.throws(function() { bench(s, 'latest', options); }, 'no callback');
  assert.end();
});

test('bench: success', function(assert) {
  var s = path.resolve('./test/fixtures/us-counties-polygons.geojson');
  bench(s, 'latest', options, function(err, stats) {
    if (err) throw err;

    // assert time order is correct
    assert.equal(stats.version, 'latest', 'version matches');
    assert.ok(stats.time.start <= stats.time.xml, 'time: start < xml');
    assert.ok(stats.time.xml <= stats.time.bridge, 'time: xml < bridge');
    assert.ok(stats.time.bridge <= stats.time.load, 'time: bridge < load');
    assert.ok(stats.time.load <= stats.time.copy, 'time: load < copy');
    assert.end();
  });
});