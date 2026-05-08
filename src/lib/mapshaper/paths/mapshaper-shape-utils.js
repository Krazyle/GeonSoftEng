import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

function cloneShape(shp) {
  if (!shp) return null;
  return shp.map(function (part) {
    return part.concat();
  });
}

export function cloneShapes(arr) {
  return utils.isArray(arr) ? arr.map(cloneShape) : null;
}

export function forEachShapePart(paths, cb) {
  editShapeParts(paths, cb);
}

export function editShapes(shapes, editPart) {
  for (var i = 0, n = shapes.length; i < n; i++) {
    shapes[i] = editShapeParts(shapes[i], editPart);
  }
}

export function editShapeParts(parts, cb) {
  if (!parts) return null;
  if (!utils.isArray(parts)) error("Expected an array, received:", parts);
  var nulls = 0,
    n = parts.length,
    retn;

  for (var i = 0; i < n; i++) {
    retn = cb(parts[i], i, parts);
    if (retn === null) {
      nulls++;
      parts[i] = null;
    } else if (utils.isArray(retn)) {
      parts[i] = retn;
    }
  }
  if (nulls === n) {
    return null;
  } else if (nulls > 0) {
    return parts.filter(function (part) {
      return !!part;
    });
  } else {
    return parts;
  }
}

export function findMaxPartCount(shapes) {
  var maxCount = 0,
    shp;
  for (var i = 0, n = shapes.length; i < n; i++) {
    shp = shapes[i];
    if (shp && shp.length > maxCount) {
      maxCount = shp.length;
    }
  }
  return maxCount;
}
