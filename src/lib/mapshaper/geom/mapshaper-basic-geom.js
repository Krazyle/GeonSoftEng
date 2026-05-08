import { WGS84 } from "./mapshaper-geom-constants";

export var R = WGS84.SEMIMAJOR_AXIS;
export var D2R = Math.PI / 180;
export var R2D = 180 / Math.PI;

export function degreesToMeters(deg) {
  return deg * D2R * R;
}

export function distance3D(ax, ay, az, bx, by, bz) {
  var dx = ax - bx,
    dy = ay - by,
    dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distanceSq(ax, ay, bx, by) {
  var dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
}

export function distance2D(ax, ay, bx, by) {
  var dx = ax - bx,
    dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq3D(ax, ay, az, bx, by, bz) {
  var dx = ax - bx,
    dy = ay - by,
    dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

export function innerAngle2(ax, ay, bx, by, cx, cy) {
  var a1 = Math.atan2(ay - by, ax - bx),
    a2 = Math.atan2(cy - by, cx - bx),
    a3 = Math.abs(a1 - a2);
  if (a3 > Math.PI) {
    a3 = 2 * Math.PI - a3;
  }
  return a3;
}

export function standardAngle(a) {
  var twoPI = Math.PI * 2;
  while (a < 0) {
    a += twoPI;
  }
  while (a >= twoPI) {
    a -= twoPI;
  }
  return a;
}

export function signedAngle(ax, ay, bx, by, cx, cy) {
  if ((ax === bx && ay === by) || (bx === cx && by === cy)) {
    return NaN;
  }
  var abx = ax - bx,
    aby = ay - by,
    cbx = cx - bx,
    cby = cy - by,
    dotp = abx * cbx + aby * cby,
    crossp = abx * cby - aby * cbx,
    a = Math.atan2(crossp, dotp);
  return standardAngle(a);
}

export function bearing2D(x1, y1, x2, y2) {
  var val = Math.PI / 2 - Math.atan2(y2 - y1, x2 - x1);
  return val > Math.PI ? val - 2 * Math.PI : val;
}

export function bearing(lng1, lat1, lng2, lat2) {
  var D2R = Math.PI / 180;
  lng1 *= D2R;
  lng2 *= D2R;
  lat1 *= D2R;
  lat2 *= D2R;
  var y = Math.sin(lng2 - lng1) * Math.cos(lat2),
    x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return Math.atan2(y, x);
}

export function signedAngleSph(alng, alat, blng, blat, clng, clat) {
  if ((alng === blng && alat === blat) || (blng === clng && blat === clat)) {
    return NaN;
  }
  var b1 = bearing(blng, blat, alng, alat),
    b2 = bearing(blng, blat, clng, clat),
    a = Math.PI * 2 + b1 - b2;
  return standardAngle(a);
}

export function convLngLatToSph(xsrc, ysrc, xbuf, ybuf, zbuf) {
  var p = [];
  for (var i = 0, len = xsrc.length; i < len; i++) {
    lngLatToXYZ(xsrc[i], ysrc[i], p);
    xbuf[i] = p[0];
    ybuf[i] = p[1];
    zbuf[i] = p[2];
  }
}

export function xyzToLngLat(x, y, z, p) {
  var d = distance3D(0, 0, 0, x, y, z);
  var lat = Math.asin(z / d) / D2R;
  var lng = Math.atan2(y / d, x / d) / D2R;
  p[0] = lng;
  p[1] = lat;
}

export function lngLatToXYZ(lng, lat, p) {
  var cosLat;
  lng *= D2R;
  lat *= D2R;
  cosLat = Math.cos(lat);
  p[0] = Math.cos(lng) * cosLat * R;
  p[1] = Math.sin(lng) * cosLat * R;
  p[2] = Math.sin(lat) * R;
}

export function sphericalDistance(lam1, phi1, lam2, phi2) {
  var dlam = lam2 - lam1,
    dphi = phi2 - phi1,
    a =
      Math.sin(dphi / 2) * Math.sin(dphi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) * Math.sin(dlam / 2),
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c;
}

export function greatCircleDistance(lng1, lat1, lng2, lat2) {
  var D2R = Math.PI / 180,
    dist = sphericalDistance(lng1 * D2R, lat1 * D2R, lng2 * D2R, lat2 * D2R);
  return dist * R;
}

export function innerAngle(ax, ay, bx, by, cx, cy) {
  var ab = distance2D(ax, ay, bx, by),
    bc = distance2D(bx, by, cx, cy),
    theta,
    dotp;
  if (ab === 0 || bc === 0) {
    theta = 0;
  } else {
    dotp = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / (ab * bc);
    if (dotp >= 1 - 1e-14) {
      theta = 0;
    } else if (dotp <= -1 + 1e-14) {
      theta = Math.PI;
    } else {
      theta = Math.acos(dotp);
    }
  }
  return theta;
}

export function innerAngle3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var ab = distance3D(ax, ay, az, bx, by, bz),
    bc = distance3D(bx, by, bz, cx, cy, cz),
    theta,
    dotp;
  if (ab === 0 || bc === 0) {
    theta = 0;
  } else {
    dotp =
      ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) /
      (ab * bc);
    if (dotp >= 1) {
      theta = 0;
    } else if (dotp <= -1) {
      theta = Math.PI;
    } else {
      theta = Math.acos(dotp);
    }
  }
  return theta;
}

export function triangleArea(ax, ay, bx, by, cx, cy) {
  var area = Math.abs(((ay - cy) * (bx - cx) + (by - cy) * (cx - ax)) / 2);
  return area;
}

function detSq(ax, ay, bx, by, cx, cy) {
  var det = ax * by - ax * cy + bx * cy - bx * ay + cx * ay - cx * by;
  return det * det;
}

export function cosine(ax, ay, bx, by, cx, cy) {
  var den = distance2D(ax, ay, bx, by) * distance2D(bx, by, cx, cy),
    cos = 0;
  if (den > 0) {
    cos = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / den;
    if (cos > 1) cos = 1;
    else if (cos < -1) cos = -1;
  }
  return cos;
}

export function cosine3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var den =
      distance3D(ax, ay, az, bx, by, bz) * distance3D(bx, by, bz, cx, cy, cz),
    cos = 0;
  if (den > 0) {
    cos =
      ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) /
      den;
    if (cos > 1) cos = 1;
    else if (cos < -1) cos = -1;
  }
  return cos;
}

export function triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var area =
    0.5 *
    Math.sqrt(
      detSq(ax, ay, bx, by, cx, cy) +
        detSq(ax, az, bx, bz, cx, cz) +
        detSq(ay, az, by, bz, cy, cz),
    );
  return area;
}

function apexDistSq(ab2, bc2, ac2) {
  var dist2;
  if (ac2 === 0) {
    dist2 = ab2;
  } else if (ab2 >= bc2 + ac2) {
    dist2 = bc2;
  } else if (bc2 >= ab2 + ac2) {
    dist2 = ab2;
  } else {
    var dval = ab2 + ac2 - bc2;
    dist2 = ab2 - ((dval * dval) / ac2) * 0.25;
  }
  if (dist2 < 0) {
    dist2 = 0;
  }
  return dist2;
}

export function pointSegDistSq(ax, ay, bx, by, cx, cy) {
  var ab2 = distanceSq(ax, ay, bx, by),
    ac2 = distanceSq(ax, ay, cx, cy),
    bc2 = distanceSq(bx, by, cx, cy);
  return apexDistSq(ab2, ac2, bc2);
}

export function pointSegDistSq3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var ab2 = distanceSq3D(ax, ay, az, bx, by, bz),
    ac2 = distanceSq3D(ax, ay, az, cx, cy, cz),
    bc2 = distanceSq3D(bx, by, bz, cx, cy, cz);
  return apexDistSq(ab2, ac2, bc2);
}

export function pointSegDistSq2(px, py, ax, ay, bx, by) {
  var ab2 = distanceSq(ax, ay, bx, by);
  var t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ab2;
  if (ab2 === 0) return distanceSq(px, py, ax, ay);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return distanceSq(px, py, ax + t * (bx - ax), ay + t * (by - ay));
}

export function containsBounds(a, b) {
  return a[0] <= b[0] && a[2] >= b[2] && a[1] <= b[1] && a[3] >= b[3];
}
