# Add a new `testcase`

Let's assume we are testing with a GeoJSON for now.
 
1. Create new folder under `testcases` for your feature. For the single point GeoJSON we called it `point-single` and added it to the `geojson` directory.
2. Name the new fixture something useful so we know what is unique about it. Add this to the newly created folder. How about `point.geojson`? If your file is large, follow the step below, otherwise you can move to step 4.
1. **large files only**: If you are adding a super large file (something that we don't want to version control), you can create a `setup.sh` command that grabs the file from `s3` before the test is run. Make sure your `setup.sh` script has execution permissions with `chmod +x setup.sh`. Here's what `setup.sh` looks like:
        
        #!/usr/bin/env bash

        export CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
        cd ${CURRENT_DIR}

        FILENAME=addis-abeba_ethiopia_osm_line.geojson

        if [[ ! -f ./${FILENAME} ]]; then
            wget https://s3.amazonaws.com/mapbox/playground/mapsam/${FILENAME}
        else
            echo "done: already downloaded ${FILENAME}"
        fi
 
3. Create `map.xml` using [`tilelive-omnivore`](https://github.com/mapbox/tilelive-omnivore). Copy its output and add to `map.xml` within your newly created folder.
        
        # using tilelive-omnivore bin command `mapnik-omnivore`
        mapnik-omnivore <path/to/data.geojson>
4. Update the `map.xml` file and change the local path in `<Parameter name="file">` to the data to a relative path of the folder you created.
        
        # from
        <Parameter name="file">/User/mapsam/data/point.geojson</Parameter>
        
        # to
        <Parameter name="file">point.geojson</Parameter>
5. Now you can run a benchmark test against your new data with the following command and mapnik version:

        node test.js testcases/geojson/point-single/map.xml mapnik-versions/latest
        
You should see an output something like this:

```
Config -> using node v0.10.40
Config -> using mapnik at /Users/mapsam/mapbox/gdal-tiling-bench/mapnik-versions/v3.4.9/node_modules/mapnik/lib/mapnik.js
Config -> source options: {"close":true,"minzoom":0,"maxzoom":10,"bounds":[125.6,10.1,125.6,10.1],"type":"pyramid"}
Config -> threadpool size: 6
Config -> sink: noop://

Result -> elapsed time: 0.011999845504760742s
Result -> total tiles rendered: 11
Result -> tiles per second: 916.6784685382767
Result -> tiles per second per thread: 152.77974475637944
Test is done: process will exit once map pool is automatically reaped
```