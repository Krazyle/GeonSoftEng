import {
  distance2D,
  distanceSq,
  pointSegDistSq2,
} from "../geom/mapshaper-basic-geom";
import { getHighPrecisionSnapInterval } from "../paths/mapshaper-snapping";
import { debug } from "../utils/mapshaper-logging";

export function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy, epsArg) {
  var eps =
    epsArg >= 0
      ? epsArg
      : getHighPrecisionSnapInterval([ax, ay, bx, by, cx, cy, dx, dy]);
  var epsSq = eps * eps;
  var touches, cross;

  touches = findPointSegTouches(epsSq, ax, ay, bx, by, cx, cy, dx, dy);

  if (!touches && testEndpointHit(epsSq, ax, ay, bx, by, cx, cy, dx, dy)) {
    return null;
  }

  cross = findCrossIntersection(ax, ay, bx, by, cx, cy, dx, dy, eps);
  if (cross && touches) {
  }
  return touches || cross || null;
}

function _reconcileCrossAndTouches(cross, touches, eps) {
  var hits;
  eps = eps || 0;
  if (touches.length > 2) {
    hits = touches;
  } else if (distance2D(cross[0], cross[1], touches[0], touches[1]) <= eps) {
    hits = touches;
  } else {
    hits = touches.concat(cross);
  }
  return hits;
}

function findCrossIntersection(ax, ay, bx, by, cx, cy, dx, dy, eps) {
  if (!segmentHit(ax, ay, bx, by, cx, cy, dx, dy)) return null;
  var den = determinant2D(bx - ax, by - ay, dx - cx, dy - cy);
  var m = orient2D(cx, cy, dx, dy, ax, ay) / den;
  var p = [ax + m * (bx - ax), ay + m * (by - ay)];
  if (Math.abs(den) < 1e-18) {
    return null;
  }

  if (eps > 0) {
    snapIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy, eps);
  }

  clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy);
  return p;
}

function testEndpointHit(epsSq, ax, ay, bx, by, cx, cy, dx, dy) {
  return (
    distanceSq(ax, ay, cx, cy) <= epsSq ||
    distanceSq(ax, ay, dx, dy) <= epsSq ||
    distanceSq(bx, by, cx, cy) <= epsSq ||
    distanceSq(bx, by, dx, dy) <= epsSq
  );
}

function findPointSegTouches(epsSq, ax, ay, bx, by, cx, cy, dx, dy) {
  var touches = [];
  collectPointSegTouch(touches, epsSq, ax, ay, cx, cy, dx, dy);
  collectPointSegTouch(touches, epsSq, bx, by, cx, cy, dx, dy);
  collectPointSegTouch(touches, epsSq, cx, cy, ax, ay, bx, by);
  collectPointSegTouch(touches, epsSq, dx, dy, ax, ay, bx, by);
  if (touches.length === 0) return null;
  if (touches.length > 4) {
    debug("Intersection detection error");
  }
  return touches;
}

function collectPointSegTouch(arr, epsSq, px, py, ax, ay, bx, by) {
  var pab = pointSegDistSq2(px, py, ax, ay, bx, by);
  if (pab > epsSq) return;
  var pa = distanceSq(ax, ay, px, py);
  var pb = distanceSq(bx, by, px, py);
  if (pa <= epsSq || pb <= epsSq) return;
  arr.push(px, py);
}

export function findClosestPointOnSeg(px, py, ax, ay, bx, by) {
  var dx = bx - ax,
    dy = by - ay,
    dotp = (px - ax) * dx + (py - ay) * dy,
    abSq = dx * dx + dy * dy,
    k = abSq === 0 ? -1 : dotp / abSq,
    eps = 0.1,
    p;
  if (k <= eps) {
    p = [ax, ay];
  } else if (k >= 1 - eps) {
    p = [bx, by];
  } else {
    p = [ax + k * dx, ay + k * dy];
  }
  return p;
}

function snapIfCloser(p, minDist, x, y, x2, y2) {
  var dist = distance2D(x, y, x2, y2);
  if (dist < minDist) {
    minDist = dist;
    p[0] = x2;
    p[1] = y2;
  }
  return minDist;
}

function snapIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy, eps) {
  var x = p[0],
    y = p[1],
    snapDist = eps;
  snapDist = snapIfCloser(p, snapDist, x, y, ax, ay);
  snapDist = snapIfCloser(p, snapDist, x, y, bx, by);
  snapDist = snapIfCloser(p, snapDist, x, y, cx, cy);
  snapDist = snapIfCloser(p, snapDist, x, y, dx, dy);
}

function clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy) {
  var x = p[0],
    y = p[1];

  x = clampToCloseRange(x, ax, bx);
  x = clampToCloseRange(x, cx, dx);
  y = clampToCloseRange(y, ay, by);
  y = clampToCloseRange(y, cy, dy);
  p[0] = x;
  p[1] = y;
}

function outsideRange(a, b, c) {
  var out;
  if (b < c) {
    out = a < b || a > c;
  } else if (b > c) {
    out = a > b || a < c;
  } else {
    out = a !== b;
  }
  return out;
}

function clampToCloseRange(a, b, c) {
  var lim;
  if (outsideRange(a, b, c)) {
    lim = Math.abs(a - b) < Math.abs(a - c) ? b : c;
    if (Math.abs(a - lim) > 1e-15) {
      debug("[clampToCloseRange()] large clamping interval", a, b, c);
    }
    a = lim;
  }
  return a;
}

function determinant2D(a, b, c, d) {
  return a * d - b * c;
}

export function orient2D(ax, ay, bx, by, cx, cy) {
  return determinant2D(ax - cx, ay - cy, bx - cx, by - cy);
}

export function segmentHit(ax, ay, bx, by, cx, cy, dx, dy) {
  return (
    orient2D(ax, ay, bx, by, cx, cy) * orient2D(ax, ay, bx, by, dx, dy) <= 0 &&
    orient2D(cx, cy, dx, dy, ax, ay) * orient2D(cx, cy, dx, dy, bx, by) <= 0
  );
}

export function segmentTurn(p1, p2, p3, p4) {
  var ax = p1[0],
    ay = p1[1],
    bx = p2[0],
    by = p2[1],
    dx = bx - p3[0],
    dy = by - p3[1],
    cx = p4[0] + dx,
    cy = p4[1] + dy,
    orientation = orient2D(ax, ay, bx, by, cx, cy);
  if (!orientation) return 0;
  return orientation < 0 ? 1 : -1;
}
