import geom from "../geom/mapshaper-geom";
import { IdTestIndex } from "../indexing/mapshaper-id-test-index";
import { editShapeParts } from "../paths/mapshaper-shape-utils";
import utils from "../utils/mapshaper-utils";

export function cleanShapes(shapes, arcs, type) {
  for (var i = 0, n = shapes.length; i < n; i++) {
    shapes[i] = cleanShape(shapes[i], arcs, type);
  }
}

function cleanShape(shape, arcs, type) {
  return editShapeParts(shape, function (path) {
    var cleaned = cleanPath(path, arcs);
    if (type === "polygon" && cleaned) {
      removeSpikesInPath(cleaned);
      if (geom.getPlanarPathArea(cleaned, arcs) === 0) {
        cleaned = null;
      }
    }
    return cleaned;
  });
}

function cleanPath(path, arcs) {
  var nulls = 0;
  for (var i = 0, n = path.length; i < n; i++) {
    if (arcs.arcIsDegenerate(path[i])) {
      nulls++;
      path[i] = null;
    }
  }
  return nulls > 0
    ? path.filter(function (id) {
        return id !== null;
      })
    : path;
}

function removeSpikesInPath(ids) {
  var n = ids.length;
  if (n >= 2) {
    if (ids[0] === ~ids[n - 1]) {
      ids.pop();
      ids.shift();
    } else {
      for (var i = 1; i < n; i++) {
        if (ids[i - 1] === ~ids[i]) {
          ids.splice(i - 1, 2);
          break;
        }
      }
    }
    if (ids.length < n) {
      removeSpikesInPath(ids);
    }
  }
}

export function getSelfIntersectionSplitter(nodes) {
  var pathIndex = new IdTestIndex(nodes.arcs.size(), true);
  var filter = function (arcId) {
    return pathIndex.hasId(~arcId);
  };
  return function (path) {
    pathIndex.setIds(path);
    var paths = dividePath(path);
    pathIndex.clear();
    return paths;
  };

  function dividePath(path) {
    var subPaths = null;
    for (var i = 0, n = path.length; i < n - 1; i++) {
      subPaths = dividePathAtNode(path, path[i]);
      if (subPaths !== null) {
        return subPaths;
      }
    }

    removeSpikesInPath(path);
    return path.length > 0 ? [path] : [];
  }

  function dividePathAtNode(path, enterId) {
    var nodeIds = nodes.getConnectedArcs(enterId, filter),
      exitArcIndexes,
      exitArcId,
      idx;
    if (nodeIds.length < 2) return null;
    exitArcIndexes = [];
    for (var i = 0; i < nodeIds.length; i++) {
      exitArcId = ~nodeIds[i];
      idx = indexOf(path, exitArcId);
      if (idx > -1) {
        pathIndex.clearId(exitArcId);
        exitArcIndexes.push(idx);
      } else {
      }
    }
    if (exitArcIndexes.length < 2) {
      return null;
    }

    var subPaths = splitPathByIds(path, exitArcIndexes);
    return subPaths.reduce(accumulatePaths, null);
  }

  function accumulatePaths(memo, path) {
    var subPaths = dividePath(path);
    if (memo === null) {
      return subPaths;
    }
    memo.push.apply(memo, subPaths);
    return memo;
  }

  function indexOf(arr, el) {
    for (var i = 0, n = arr.length; i < n; i++) {
      if (arr[i] === el) return i;
    }
    return -1;
  }
}

function splitPathByIds(path, indexes) {
  var subPaths = [];
  utils.genericSort(indexes, true);
  if (indexes[0] > 0) {
    subPaths.push(path.slice(0, indexes[0]));
  }
  for (var i = 0, n = indexes.length; i < n; i++) {
    if (i < n - 1) {
      subPaths.push(path.slice(indexes[i], indexes[i + 1]));
    } else {
      subPaths.push(path.slice(indexes[i]));
    }
  }

  if (subPaths.length > indexes.length) {
    utils.merge(subPaths[0], subPaths.pop());
  }
  return subPaths;
}
