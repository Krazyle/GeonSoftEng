import { cleanLayers } from "../commands/mapshaper-clean";
import { replaceLayers } from "../dataset/mapshaper-dataset-utils";
import {
  getFeatureCount,
  requirePolygonLayer,
} from "../dataset/mapshaper-layer-utils";
import { DataTable } from "../datatable/mapshaper-data-table";
import {
  fixInconsistentFields,
  getColumnType,
} from "../datatable/mapshaper-data-utils";
import cmd from "../mapshaper-cmd";
import { error, message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

cmd.mergeAndFlattenLayers = function (layers, dataset, opts) {
  if (!opts.flatten) return cmd.mergeLayers(layers, opts);
  layers.forEach(function (lyr) {
    requirePolygonLayer(lyr, "the flatten option requires polygon layers");
  });
  var output = cmd.mergeLayers(layers, opts);
  replaceLayers(dataset, layers, output);
  cleanLayers(output, dataset, {
    overlap_rule: "max-id",
  });
  replaceLayers(dataset, output, layers);
  return output;
};

cmd.mergeLayers = function (layersArg, opts) {
  var layers = layersArg.filter(getFeatureCount);
  var merged = {};
  opts = opts || {};
  if (!layers.length) return null;
  if (layers.length === 1) {
    message("Use the target= option to specify multiple layers for merging");
    return layers.concat();
  }
  merged.data = mergeDataFromLayers(layers, opts);
  merged.name = mergeLayerNames(layers);
  merged.geometry_type = getMergedLayersGeometryType(layers);
  if (merged.geometry_type) {
    merged.shapes = mergeShapesFromLayers(layers);
  }
  if (
    merged.shapes &&
    merged.data &&
    merged.shapes.length !== merged.data.size()
  ) {
    error("Mismatch between geometry and attribute data");
  }
  return [merged];
};

function getMergedLayersGeometryType(layers) {
  var geoTypes = utils
    .uniq(utils.pluck(layers, "geometry_type"))
    .filter(function (type) {
      return !!type;
    });
  if (geoTypes.length > 1) {
    stop("Incompatible geometry types:", geoTypes.join(", "));
  }
  return geoTypes[0] || null;
}

function mergeShapesFromLayers(layers) {
  return layers.reduce(function (memo, lyr) {
    var shapes = lyr.shapes || [];
    var n = getFeatureCount(lyr);
    var i = -1;
    while (++i < n) memo.push(shapes[i] || null);
    return memo;
  }, []);
}

function mergeDataFromLayers(layers, opts) {
  var allFields = utils.uniq(
    layers.reduce(function (memo, lyr) {
      return memo.concat(lyr.data ? lyr.data.getFields() : []);
    }, []),
  );
  if (allFields.length === 0) return null;
  var mergedRecords = layers.reduce(function (memo, lyr) {
    var records = lyr.data
      ? lyr.data.getRecords()
      : new DataTable(getFeatureCount(lyr)).getRecords();
    return memo.concat(records);
  }, []);
  var missingFields = findInconsistentFields(allFields, layers);
  handleMissingFields(missingFields, opts);
  checkInconsistentFieldTypes(allFields, layers);
  if (missingFields.length > 0) {
    fixInconsistentFields(mergedRecords);
  }
  return new DataTable(mergedRecords);
}

function handleMissingFields(missingFields, opts) {
  var msg;
  if (missingFields.length > 0) {
    msg = `[${missingFields.join(", ")}]`;
    msg = `${
      missingFields.length === 1
        ? `Field ${msg} is missing`
        : `Fields ${msg} are missing`
    } from one or more layers`;
    if (!opts.force) {
      stop(msg);
    } else if (opts.verbose !== false) {
      message(`Warning: ${msg}`);
    }
  }
}

function findInconsistentFields(allFields, layers) {
  var missingFields = utils.uniq(
    layers.reduce(function (memo, lyr) {
      return memo.concat(
        utils.difference(allFields, lyr.data ? lyr.data.getFields() : []),
      );
    }, []),
  );
  return missingFields;
}

function checkInconsistentFieldTypes(fields, layers) {
  fields.forEach(function (key) {
    var types = findFieldTypes(key, layers);
    if (types.length > 1) {
      stop(`Inconsistent data types in "${key}" field:`, types.join(", "));
    }
  });
}

function findFieldTypes(key, layers) {
  return layers.reduce(function (memo, lyr) {
    var type = lyr.data ? getColumnType(key, lyr.data.getRecords()) : null;
    if (type && memo.indexOf(type) === -1) {
      memo.push(type);
    }
    return memo;
  }, []);
}

export function mergeLayerNames(layers) {
  return (
    layers.reduce(function (memo, lyr) {
      if (memo === null) {
        memo = lyr.name || null;
      } else if (memo && lyr.name) {
        memo = utils.mergeNames(memo, lyr.name);
      }
      return memo;
    }, null) || ""
  );
}
