import { WGS84 } from "../geom/mapshaper-geom-constants";
import { calcPathLen } from "../geom/mapshaper-path-geom";
import { forEachSegmentInPath } from "../paths/mapshaper-path-utils";
import { error } from "../utils/mapshaper-logging";

export function calcPolsbyPopperCompactness(area, perimeter) {
  if (perimeter <= 0) return 0;
  return (Math.abs(area) * Math.PI * 4) / (perimeter * perimeter);
}

export function calcSchwartzbergCompactness(area, perimeter) {
  if (perimeter <= 0) return 0;
  return (2 * Math.PI * Math.sqrt(Math.abs(area) / Math.PI)) / perimeter;
}

export function getPathWinding(ids, arcs) {
  var area = getPathArea(ids, arcs);
  return (area > 0 && 1) || (area < 0 && -1) || 0;
}

export function getShapeArea(shp, arcs) {
  return (shp || []).reduce(function (area, ids) {
    return area + getPathArea(ids, arcs);
  }, 0);
}

export function getPlanarShapeArea(shp, arcs) {
  return (shp || []).reduce(function (area, ids) {
    return area + getPlanarPathArea(ids, arcs);
  }, 0);
}

export function getSphericalShapeArea(shp, arcs, R) {
  if (arcs.isPlanar()) {
    error(
      "[getSphericalShapeArea()] Function requires decimal degree coordinates",
    );
  }
  return (shp || []).reduce(function (area, ids) {
    return area + getSphericalPathArea(ids, arcs, R);
  }, 0);
}

export function testPointInPolygon(x, y, shp, arcs) {
  var isIn = false,
    isOn = false;
  if (shp) {
    shp.forEach(function (ids) {
      var inRing = testPointInRing(x, y, ids, arcs);
      if (inRing === 1) {
        isIn = !isIn;
      } else if (inRing === -1) {
        isOn = true;
      }
    });
  }
  return isOn || isIn;
}

function getYIntercept(x, ax, ay, bx, by) {
  return ay + ((x - ax) * (by - ay)) / (bx - ax);
}

function _getXIntercept(y, ax, ay, bx, by) {
  return ax + ((y - ay) * (bx - ax)) / (by - ay);
}

export function testPointInRing(x, y, ids, arcs) {
  var isIn = false,
    isOn = false;
  forEachSegmentInPath(ids, arcs, function (a, b, xx, yy) {
    var result = testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    if (result === 1) {
      isIn = !isIn;
    } else if (Number.isNaN(result)) {
      isOn = true;
    }
  });
  return isOn ? -1 : isIn ? 1 : 0;
}

export function testRayIntersection(x, y, ax, ay, bx, by) {
  var val = getRayIntersection(x, y, ax, ay, bx, by);
  if (val !== val) {
    return NaN;
  }
  return val === -Infinity ? 0 : 1;
}

export function getRayIntersection(x, y, ax, ay, bx, by) {
  var hit = -Infinity,
    yInt;

  if ((x < ax && x < bx) || (x > ax && x > bx) || (y > ay && y > by)) {
  } else if (x === ax || x === bx) {
    if (x === ax && x === bx) {
      if (y === ay || y === by || y > ay !== y > by) {
        hit = NaN;
      }
    } else if (x === ax) {
      if (y === ay) {
        hit = NaN;
      } else if (bx < ax && y < ay) {
        hit = ay;
      }
    } else {
      if (y === by) {
        hit = NaN;
      } else if (ax < bx && y < by) {
        hit = by;
      }
    }
  } else {
    yInt = getYIntercept(x, ax, ay, bx, by);
    if (yInt > y) {
      hit = yInt;
    } else if (yInt === y) {
      hit = NaN;
    }
  }
  return hit;
}

export function getPathArea(ids, arcs) {
  return (arcs.isPlanar() ? getPlanarPathArea : getSphericalPathArea)(
    ids,
    arcs,
  );
}

export function getSphericalPathArea(ids, arcs, R) {
  var iter = arcs.getShapeIter(ids);
  return getSphericalPathArea2(iter, R);
}

export function getSphericalPathArea2(iter, R) {
  var sum = 0,
    started = false,
    deg2rad = Math.PI / 180,
    x,
    y,
    xp,
    yp;
  R = R || WGS84.SEMIMAJOR_AXIS;
  while (iter.hasNext()) {
    x = iter.x * deg2rad;
    y = Math.sin(iter.y * deg2rad);
    if (started) {
      sum += (x - xp) * (2 + y + yp);
    } else {
      started = true;
    }
    xp = x;
    yp = y;
  }
  return (sum / 2) * R * R;
}

export function getPlanarPathArea2(points) {
  var sum = 0,
    ax,
    ay,
    bx,
    by,
    dx,
    dy,
    p;
  for (var i = 0, n = points.length; i < n; i++) {
    p = points[i];
    if (i === 0) {
      ax = 0;
      ay = 0;
      dx = -p[0];
      dy = -p[1];
    } else {
      ax = p[0] + dx;
      ay = p[1] + dy;
      sum += ax * by - bx * ay;
    }
    bx = ax;
    by = ay;
  }
  return sum / 2;
}

export function getPlanarPathArea(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
    sum = 0,
    ax,
    ay,
    bx,
    by,
    dx,
    dy;
  if (iter.hasNext()) {
    ax = 0;
    ay = 0;
    dx = -iter.x;
    dy = -iter.y;
    while (iter.hasNext()) {
      bx = ax;
      by = ay;
      ax = iter.x + dx;
      ay = iter.y + dy;
      sum += ax * by - bx * ay;
    }
  }
  return sum / 2;
}

export function getPathPerimeter(ids, arcs) {
  return (arcs.isPlanar() ? getPlanarPathPerimeter : getSphericalPathPerimeter)(
    ids,
    arcs,
  );
}

export function getShapePerimeter(shp, arcs) {
  return (shp || []).reduce(function (len, ids) {
    return len + getPathPerimeter(ids, arcs);
  }, 0);
}

export function getSphericalShapePerimeter(shp, arcs) {
  if (arcs.isPlanar()) {
    error(
      "[getSphericalShapePerimeter()] Function requires decimal degree coordinates",
    );
  }
  return (shp || []).reduce(function (len, ids) {
    return len + getSphericalPathPerimeter(ids, arcs);
  }, 0);
}

export function getPlanarPathPerimeter(ids, arcs) {
  return calcPathLen(ids, arcs, false);
}

export function getSphericalPathPerimeter(ids, arcs) {
  return calcPathLen(ids, arcs, true);
}
