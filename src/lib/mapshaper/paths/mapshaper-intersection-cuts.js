import { getDatasetCRS } from "../crs/mapshaper-projections";
import {
  getArcPresenceTest2,
  layerHasPaths,
} from "../dataset/mapshaper-layer-utils";
import geom from "../geom/mapshaper-geom";
import { convertIntervalParam } from "../geom/mapshaper-units";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { cleanShapes } from "../paths/mapshaper-path-repair-utils";
import { findSegmentIntersections } from "../paths/mapshaper-segment-intersection";
import { editShapes } from "../paths/mapshaper-shape-utils";
import {
  getHighPrecisionSnapInterval,
  snapCoordsByInterval,
} from "../paths/mapshaper-snapping";
import { NodeCollection } from "../topology/mapshaper-nodes";
import { buildTopology } from "../topology/mapshaper-topology";
import { debug, error } from "../utils/mapshaper-logging";

export function addIntersectionCuts(dataset, _opts) {
  var opts = _opts || {};
  var arcs = dataset.arcs;
  var arcBounds = arcs?.getBounds();
  var snapDist, nodes;
  if (!arcBounds?.hasBounds()) {
    return new NodeCollection([]);
  }

  if (opts.snap_interval) {
    snapDist = convertIntervalParam(opts.snap_interval, getDatasetCRS(dataset));
  } else if (!opts.no_snap && arcBounds.hasBounds()) {
    snapDist = getHighPrecisionSnapInterval(arcBounds.toArray());
  } else {
    snapDist = 0;
  }
  debug("addIntersectionCuts() snap dist:", snapDist);

  arcs.flatten();

  var changed = snapAndCut(dataset, snapDist);

  if (changed || opts.rebuild_topology) {
    buildTopology(dataset);
  }

  dataset.layers.forEach(function (lyr) {
    if (layerHasPaths(lyr)) {
      cleanShapes(lyr.shapes, arcs, lyr.geometry_type);
    }
  });

  nodes = cleanArcReferences(dataset);
  return nodes;
}

function snapAndCut(dataset, snapDist) {
  var arcs = dataset.arcs;
  var cutOpts = snapDist > 0 ? {} : { tolerance: 0 };
  var coordsHaveChanged = false;
  var snapCount, dupeCount, cutCount;
  snapCount = snapCoordsByInterval(arcs, snapDist);
  dupeCount = arcs.dedupCoords();

  cutCount = cutPathsAtIntersections(dataset, cutOpts);
  if (cutCount > 0 || snapCount > 0 || dupeCount > 0) {
    coordsHaveChanged = true;
  }

  if (cutCount > 0) {
    cutCount = 0;
    snapCount = snapCoordsByInterval(arcs, snapDist);
    arcs.dedupCoords();
    if (snapCount > 0) {
      cutCount = cutPathsAtIntersections(dataset, cutOpts);
    }
    if (cutCount > 0) {
      arcs.dedupCoords();
      debug("Second-pass vertices added:", cutCount, "consider third pass?");
    }
  }
  return coordsHaveChanged;
}

function cleanArcReferences(dataset) {
  var nodes = new NodeCollection(dataset.arcs);
  var map = findDuplicateArcs(nodes);
  var dropCount;
  if (map) {
    replaceIndexedArcIds(dataset, map);
  }
  dropCount = deleteUnusedArcs(dataset);
  if (dropCount > 0) {
    nodes = new NodeCollection(dataset.arcs);
  }
  return nodes;
}

function replaceIndexedArcIds(dataset, map) {
  var remapPath = function (ids) {
    var arcId, absId, id2;
    for (var i = 0; i < ids.length; i++) {
      arcId = ids[i];
      absId = absArcId(arcId);
      id2 = map[absId];
      ids[i] = arcId === absId ? id2 : ~id2;
    }
    return ids;
  };
  dataset.layers.forEach(function (lyr) {
    if (layerHasPaths(lyr)) {
      editShapes(lyr.shapes, remapPath);
    }
  });
}

function findDuplicateArcs(nodes) {
  var map = new Int32Array(nodes.arcs.size()),
    count = 0,
    i2;
  for (var i = 0, n = nodes.arcs.size(); i < n; i++) {
    i2 = nodes.findDuplicateArc(i);
    map[i] = i2;
    if (i !== i2) count++;
  }
  return count > 0 ? map : null;
}

function deleteUnusedArcs(dataset) {
  var test = getArcPresenceTest2(dataset.layers, dataset.arcs);
  var count1 = dataset.arcs.size();
  var map = dataset.arcs.deleteArcs(test);
  var count2 = dataset.arcs.size();
  var deleteCount = count1 - count2;
  if (deleteCount > 0) {
    replaceIndexedArcIds(dataset, map);
  }
  return deleteCount;
}

function getDividedArcUpdater(map, arcCount) {
  return function (ids) {
    var ids2 = [];
    for (var j = 0; j < ids.length; j++) {
      remapArcId2(ids[j], ids2);
    }
    return ids2;
  };

  function remapArcId2(id, ids) {
    var rev = id < 0,
      absId = rev ? ~id : id,
      min = map[absId],
      max = (absId >= map.length - 1 ? arcCount : map[absId + 1]) - 1,
      id2;
    do {
      if (rev) {
        id2 = ~max;
        max--;
      } else {
        id2 = min;
        min++;
      }
      ids.push(id2);
    } while (max - min >= 0);
  }
}

function divideArcs(arcs, opts) {
  var points = findClippingPoints(arcs, opts);

  var map = insertCutPoints(points, arcs);

  return map;
}

function cutPathsAtIntersections(dataset, opts) {
  var n = dataset.arcs.getPointCount();
  var map = divideArcs(dataset.arcs, opts);
  var n2 = dataset.arcs.getPointCount();
  remapDividedArcs(dataset, map);
  return n2 - n;
}

export function remapDividedArcs(dataset, map) {
  var remapPath = getDividedArcUpdater(map, dataset.arcs.size());
  dataset.layers.forEach(function (lyr) {
    if (layerHasPaths(lyr)) {
      editShapes(lyr.shapes, remapPath);
    }
  });
}

export function insertCutPoints(unfilteredPoints, arcs) {
  var data = arcs.getVertexData(),
    xx0 = data.xx,
    yy0 = data.yy,
    nn0 = data.nn,
    i0 = 0,
    i1 = 0,
    nn1 = [],
    srcArcTotal = arcs.size(),
    map = new Uint32Array(srcArcTotal),
    points = filterSortedCutPoints(
      sortCutPoints(unfilteredPoints, xx0, yy0),
      arcs,
    ),
    destPointTotal = arcs.getPointCount() + points.length * 2,
    xx1 = new Float64Array(destPointTotal),
    yy1 = new Float64Array(destPointTotal),
    n0,
    n1,
    arcLen,
    p;

  points.reverse();
  p = points.pop();

  for (var srcArcId = 0, destArcId = 0; srcArcId < srcArcTotal; srcArcId++) {
    arcLen = nn0[srcArcId];
    map[srcArcId] = destArcId;
    n0 = 0;
    n1 = 0;
    while (n0 < arcLen) {
      xx1[i1] = xx0[i0];
      yy1[i1] = yy0[i0];
      i1++;
      n1++;
      while (p && p.i === i0) {
        xx1[i1] = p.x;
        yy1[i1] = p.y;
        i1++;
        n1++;
        nn1[destArcId++] = n1;
        n1 = 0;
        xx1[i1] = p.x;
        yy1[i1] = p.y;
        i1++;
        n1++;
        p = points.pop();
      }
      n0++;
      i0++;
    }
    nn1[destArcId++] = n1;
  }

  if (i1 !== destPointTotal) error("[insertCutPoints()] Counting error");
  arcs.updateVertexData(nn1, xx1, yy1, null);
  return map;
}

function convertIntersectionsToCutPoints(intersections, xx, yy) {
  var points = [],
    ix,
    a,
    b;
  for (var i = 0, n = intersections.length; i < n; i++) {
    ix = intersections[i];
    a = getCutPoint(ix.x, ix.y, ix.a[0], ix.a[1], xx, yy);
    b = getCutPoint(ix.x, ix.y, ix.b[0], ix.b[1], xx, yy);
    if (a) points.push(a);
    if (b) points.push(b);
  }
  return points;
}

export function getCutPoint(x, y, i, j, xx, yy) {
  var _ix = xx[i],
    _iy = yy[i],
    _jx = xx[j],
    _jy = yy[j];
  if (j < i || j > i + 1) {
    error("Out-of-sequence arc ids:", i, j);
  }

  return { x: x, y: y, i: i };
}

function sortCutPoints(points, xx, yy) {
  points.sort(function (a, b) {
    if (a.i !== b.i) return a.i - b.i;
    return (
      geom.distanceSq(xx[a.i], yy[a.i], a.x, a.y) -
      geom.distanceSq(xx[b.i], yy[b.i], b.x, b.y)
    );
  });
  return points;
}

function filterSortedCutPoints(points, arcs) {
  var filtered = [],
    pointId = 0;
  arcs.forEach2(function (i, n, xx, yy) {
    var j = i + n - 1,
      x0 = xx[i],
      y0 = yy[i],
      xn = xx[j],
      yn = yy[j],
      p,
      pp;

    while (pointId < points.length && points[pointId].i <= j) {
      p = points[pointId];
      pp = filtered[filtered.length - 1];
      if ((p.x === x0 && p.y === y0) || (p.x === xn && p.y === yn)) {
      } else if (pp && pp.x === p.x && pp.y === p.y && pp.i === p.i) {
      } else {
        filtered.push(p);
      }
      pointId++;
    }
  });
  return filtered;
}

function findClippingPoints(arcs, opts) {
  var intersections = findSegmentIntersections(arcs, opts),
    data = arcs.getVertexData();
  return convertIntersectionsToCutPoints(intersections, data.xx, data.yy);
}
