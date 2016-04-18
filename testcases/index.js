var path = require('path');

module.exports = {
  geojson: [
    {
      name: 'osm-extract-lines',
      path: path.join(__dirname, 'geojson', '/osm-extract-lines.geojson')
    },
    {
      name: 'osm-extract-polygons',
      path: path.join(__dirname, 'geojson', '/osm-extract-polygons.geojson') 
    },
    {
      name: 'osm-extract-points',
      path: path.join(__dirname, 'geojson', '/osm-extract-points.geojson')
    },
    {
      name: 'us-counties-polygons',
      path: path.join(__dirname, 'geojson', '/us-counties-polygons.geojson')
    },
    {
      name: 'osm-points',
      path: path.join(__dirname, 'geojson', '/osm-points.geojson')
    },
    {
      name: 'single-point',
      path: path.join(__dirname, 'geojson', '/single-point.geojson') 
    }
  ],
  tif: []
};