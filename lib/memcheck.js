var bytes = require('bytes');

/*
 * Check memory stats and update
 * Requires a custom memstats object
 */
module.exports = function(memory, logger) {
  var membase = {
    max_rss:0,
    max_heap:0,
    max_heap_total:0
  };

  var memstats = (memory) ? memory : membase;

  var mem = process.memoryUsage();
  if (mem.rss > memstats.max_rss) memstats.max_rss = mem.rss;
  if (mem.heapTotal > memstats.max_heap_total) memstats.max_heap_total = mem.heapTotal;
  if (mem.heapUsed > memstats.max_heap) memstats.max_heap = mem.heapUsed;
  return memstats;
};

module.exports.byteConvert = function(memstats) {
  for (var m in memstats) {
    memstats[m] = bytes(memstats[m]);
  }
  return memstats;
};