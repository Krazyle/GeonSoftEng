import geom from "../geom/mapshaper-geom";
import { forEachSegmentInPath } from "../paths/mapshaper-path-utils";
import { simplifyPolygonFast } from "../simplify/mapshaper-simplify-fast";
import { verbose } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function findAnchorPoint(shp, arcs) {
  var maxPath = shp && geom.getMaxPath(shp, arcs),
    pathBounds = maxPath && arcs.getSimpleShapeBounds(maxPath),
    thresh,
    simple;
  if (!pathBounds?.hasBounds() || pathBounds.area() === 0) {
    return null;
  }

  thresh = Math.sqrt(pathBounds.area()) * 0.01;
  simple = simplifyPolygonFast(shp, arcs, thresh);
  if (!simple.shape) {
    return null;
  }
  return findAnchorPoint2(simple.shape, simple.arcs);
}

function findAnchorPoint2(shp, arcs) {
  var maxPath = geom.getMaxPath(shp, arcs);
  var pathBounds = arcs.getSimpleShapeBounds(maxPath);
  var centroid = geom.getPathCentroid(maxPath, arcs);
  var weight = getPointWeightingFunction(centroid, pathBounds);
  var area = geom.getPlanarPathArea(maxPath, arcs);
  var hrange, lbound, rbound, focus, htics, hstep, p, p2;

  if (shp.length === 1 && area * 1.2 > pathBounds.area()) {
    htics = 5;
    focus = 0.2;
  } else if (shp.length === 1 && area * 1.7 > pathBounds.area()) {
    htics = 7;
    focus = 0.4;
  } else {
    htics = 11;
    focus = 0.5;
  }
  hrange = pathBounds.width() * focus;
  lbound = centroid.x - hrange / 2;
  rbound = lbound + hrange;
  hstep = hrange / htics;

  p = probeForBestAnchorPoint(shp, arcs, lbound, rbound, htics, weight);
  if (!p) {
    verbose("[points inner] failed, falling back to centroid");
    p = centroid;
  } else {
    p2 = probeForBestAnchorPoint(
      shp,
      arcs,
      p.x - hstep / 2,
      p.x + hstep / 2,
      2,
      weight,
    );
    if (p2.distance > p.distance) {
      p = p2;
    }
  }
  return p;
}

function getPointWeightingFunction(centroid, pathBounds) {
  var referenceDist = Math.max(pathBounds.width(), pathBounds.height()) / 2;
  return function (x, y) {
    var offset = geom.distance2D(centroid.x, centroid.y, x, y);
    return 1 - Math.min((0.6 * offset) / referenceDist, 0.25);
  };
}

function findAnchorPointCandidates(shp, arcs, xx) {
  var ymin = arcs.getBounds().ymin - 1;
  return xx.reduce(function (memo, x) {
    var cands = findHitCandidates(x, ymin, shp, arcs);
    return memo.concat(cands);
  }, []);
}

function probeForBestAnchorPoint(shp, arcs, lbound, rbound, htics, weight) {
  var tics = getInnerTics(lbound, rbound, htics);
  var interval = (rbound - lbound) / htics;

  var candidates = findAnchorPointCandidates(shp, arcs, tics);
  var bestP, adjustedP, candP;

  candidates.forEach(function (p) {
    p.interval *= weight(p.x, p.y);
  });
  candidates.sort(function (a, b) {
    return b.interval - a.interval;
  });

  for (var i = 0; i < candidates.length; i++) {
    candP = candidates[i];

    if (bestP && bestP.distance > candP.interval) {
      break;
    }
    adjustedP = getAdjustedPoint(candP.x, candP.y, shp, arcs, interval, weight);

    if (!bestP || adjustedP.distance > bestP.distance) {
      bestP = adjustedP;
    }
  }
  return bestP;
}

function getAdjustedPoint(x, y, shp, arcs, vstep, weight) {
  var p = {
    x: x,
    y: y,
    distance: geom.getPointToShapeDistance(x, y, shp, arcs) * weight(x, y),
  };
  scanForBetterPoint(p, shp, arcs, vstep, weight);
  scanForBetterPoint(p, shp, arcs, -vstep, weight);
  return p;
}

function scanForBetterPoint(p, shp, arcs, vstep, weight) {
  var x = p.x,
    y = p.y,
    dmax = p.distance,
    d;

  while (true) {
    y += vstep;
    d = geom.getPointToShapeDistance(x, y, shp, arcs) * weight(x, y);

    if (d > dmax * 0.9 && geom.testPointInPolygon(x, y, shp, arcs)) {
      if (d > dmax) {
        p.distance = dmax = d;
        p.y = y;
      }
    } else {
      break;
    }
  }
}

function findHitCandidates(x, y, shp, arcs) {
  var yy = findRayShapeIntersections(x, y, shp, arcs);
  var cands = [],
    y1,
    y2,
    interval;

  utils.genericSort(yy);
  for (var i = 0; i < yy.length; i += 2) {
    y1 = yy[i];
    y2 = yy[i + 1];
    interval = (y2 - y1) / 2;
    if (interval > 0) {
      cands.push({
        y: (y1 + y2) / 2,
        x: x,
        interval: interval,
      });
    }
  }
  return cands;
}

function findRayShapeIntersections(x, y, shp, arcs) {
  if (!shp) return [];
  return shp.reduce(function (memo, path) {
    var yy = findRayRingIntersections(x, y, path, arcs);
    return memo.concat(yy);
  }, []);
}

function findRayRingIntersections(x, y, path, arcs) {
  var yints = [];
  forEachSegmentInPath(path, arcs, function (a, b, xx, yy) {
    var result = geom.getRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    if (result > -Infinity) {
      yints.push(result);
    }
  });

  if (yints.length % 2 === 1) {
    yints = [];
  }
  return yints;
}

function getInnerTics(min, max, steps) {
  var range = max - min,
    step = range / (steps + 1),
    arr = [];
  for (var i = 1; i <= steps; i++) {
    arr.push(min + step * i);
  }
  return arr;
}
