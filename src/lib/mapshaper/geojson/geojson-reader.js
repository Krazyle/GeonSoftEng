import { parseObjects } from "../geojson/json-parser";
import { debug } from "../utils/mapshaper-logging";
import { T } from "../utils/mapshaper-timing";

export function GeoJSONReader(reader) {
  this.readObjects = function (onObject) {
    var bytesToSearch = 5000;
    var start =
      reader.findString('"features"', bytesToSearch) ||
      reader.findString('"geometries"', bytesToSearch);

    var offset = start ? start.offset : 0;
    T.start();
    parseObjects(reader, offset, onObject);

    debug("Parse GeoJSON", T.stop());
  };
}

function _parseObjects_native(reader, _offset, cb) {
  var obj = JSON.parse(reader.toString());
  var arr = obj.features || obj.geometries || [obj];
  arr.forEach((o) => cb(o));
}
