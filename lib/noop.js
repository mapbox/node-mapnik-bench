/*
 * Create a No Operation (NOOP) protocol for tilelive that mimicks the API
 * 
 * For the purpose of this benchmark suite we want to save time
 * by notsaving to file system so this removes a layer of 
 * complexity for benching unless you pass an output directory
 */
var mercator = new(require('sphericalmercator'))();

module.exports = function(options) {
	
	function NOOP(uri, callback) {
    return callback(null,this);
	}

	NOOP.tile_count = 0;
  console.log(NOOP.tile_count);
	NOOP.prototype.putTile = function(z, x, y, tile, callback) {
    if (options.verbose) {
      var bbox = mercator.bbox(x,y,z, false, '900913');
      console.log('no-op putTile',z,x,y,JSON.stringify(bbox));
    }
    NOOP.tile_count++;
    return callback(null);
	};

	NOOP.prototype.putInfo = function(info, callback) {
    if (options.verbose) console.log('no-op putInfo',info);
    return callback(null);
	};

	NOOP.prototype.startWriting = function(callback) {
    if (options.verbose) console.log('no-op startWriting');
    return callback(null);
	};

	NOOP.prototype.stopWriting = function(callback) {
    if (options.verbose) console.log('no-op stopWriting');
    return callback(null);
	};

	return NOOP;
};