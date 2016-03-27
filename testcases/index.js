var path = require('path');
var bucket = '/mapbox/playground/mapsam/data/';

module.exports = {
  geojson: {
    'osm-extract-lines': path.join(__dirname, '/osm-extract-lines.geojson'),
    'osm-extract-polygons': path.join(__dirname, '/osm-extract-polygons.geojson'),
    'osm-extract-points': path.join(__dirname, '/osm-extract-points.geojson'),
    'us-counties-polygons': path.join(__dirname, '/us-counties-polygons.geojson'),
    'osm-points': path.join(__dirname, '/osm-points.geojson'),
    'single-point': path.join(__dirname, '/single-point.geojson')
  },
  tif: {}
};