import { DatasetEditor } from "../dataset/mapshaper-dataset-editor";
import geom from "../geom/mapshaper-geom";
import { editArcs } from "../paths/mapshaper-arc-editor";
import { getAvgSegment2 } from "../paths/mapshaper-path-utils";
import { error } from "../utils/mapshaper-logging";

export function densifyDataset(dataset, opts) {
  var interval = opts.interval;
  if (interval > 0 === false) {
    error("Expected a valid interval parameter");
  }
  var editor = new DatasetEditor(dataset);
  dataset.layers.forEach(function (lyr) {
    var type = lyr.geometry_type;
    editor.editLayer(lyr, function (coords, _i, _shape) {
      if (type === "point") return coords;
      return [densifyPathByInterval(coords, interval)];
    });
  });
  editor.done();
}

export function densifyPathByInterval(coords, interval, interpolate) {
  if (findMaxPathInterval(coords) < interval) return coords;
  if (!interpolate) {
    interpolate = getIntervalInterpolator(interval);
  }
  var coords2 = [coords[0]],
    a,
    b;
  for (var i = 1, n = coords.length; i < n; i++) {
    a = coords[i - 1];
    b = coords[i];
    if (geom.distance2D(a[0], a[1], b[0], b[1]) > interval + 1e-4) {
      appendArr(coords2, interpolate(a, b));
    }
    coords2.push(b);
  }
  return coords2;
}

export function getIntervalInterpolator(interval) {
  return function (a, b) {
    var points = [];

    var dist = geom.distance2D(a[0], a[1], b[0], b[1]);
    var n = Math.round(dist / interval) - 1;
    var dx = (b[0] - a[0]) / (n + 1),
      dy = (b[1] - a[1]) / (n + 1);
    for (var i = 1; i <= n; i++) {
      points.push([a[0] + dx * i, a[1] + dy * i]);
    }
    return points;
  };
}

export function densifyAntimeridianSegment(a, b, interval) {
  var y1, y2;
  var coords = [];
  var ascending = a[1] < b[1];
  if (a[0] !== b[0]) error("Expected an edge segment");
  if (interval > 0 === false) error("Expected a positive interval");
  if (ascending) {
    y1 = a[1];
    y2 = b[1];
  } else {
    y1 = b[1];
    y2 = a[1];
  }
  var y = Math.floor(y1 / interval) * interval + interval;
  while (y < y2) {
    coords.push([a[0], y]);
    y += interval;
  }
  if (!ascending) coords.reverse();
  return coords;
}

function appendArr(dest, src) {
  for (var i = 0; i < src.length; i++) dest.push(src[i]);
}

function findMaxPathInterval(coords) {
  var maxSq = 0,
    intSq,
    a,
    b;
  for (var i = 1, n = coords.length; i < n; i++) {
    a = coords[i - 1];
    b = coords[i];
    intSq = geom.distanceSq(a[0], a[1], b[0], b[1]);
    if (intSq > maxSq) maxSq = intSq;
  }
  return Math.sqrt(maxSq);
}

function _densifyUnprojectedPathByDistance(_coords, _meters) {}

export function projectAndDensifyArcs(arcs, proj) {
  var interval = getDefaultDensifyInterval(arcs, proj);
  var minIntervalSq = interval * interval * 25;
  var p;
  return editArcs(arcs, onPoint);

  function onPoint(append, lng, lat, prevLng, prevLat, i) {
    var pp = p;
    p = proj(lng, lat);
    if (!p) return false;

    if (i > 0 && geom.distanceSq(p[0], p[1], pp[0], pp[1]) > minIntervalSq) {
      densifySegment(
        prevLng,
        prevLat,
        pp[0],
        pp[1],
        lng,
        lat,
        p[0],
        p[1],
        proj,
        interval,
      ).forEach(append);
    }
    append(p);
  }
}

function getDefaultDensifyInterval(arcs, proj) {
  var xy = getAvgSegment2(arcs),
    bb = arcs.getBounds(),
    a = proj(bb.centerX(), bb.centerY()),
    b = proj(bb.centerX() + xy[0], bb.centerY() + xy[1]),
    c = proj(bb.centerX(), bb.ymin),
    d = proj(bb.xmax, bb.centerY());

  var intervalA = a && b ? geom.distance2D(a[0], a[1], b[0], b[1]) : Infinity;

  var intervalB =
    c && d
      ? (geom.distance2D(a[0], a[1], c[0], c[1]) +
          geom.distance2D(a[0], a[1], d[0], d[1])) /
        5000
      : Infinity;
  var interval = Math.min(intervalA, intervalB);
  if (interval === Infinity) {
    error("Densification error");
  }
  return interval;
}

function densifySegment(
  lng0,
  lat0,
  x0,
  y0,
  lng2,
  lat2,
  x2,
  y2,
  proj,
  interval,
  points,
) {
  var lng1 = (lng0 + lng2) / 2,
    lat1 = (lat0 + lat2) / 2,
    p = proj(lng1, lat1),
    distSq;
  if (!p) return;
  distSq = geom.pointSegDistSq2(p[0], p[1], x0, y0, x2, y2);
  points = points || [];

  if (
    distSq > interval * interval * 0.25 &&
    geom.distance2D(lng0, lat0, lng2, lat2) > 0.01
  ) {
    densifySegment(
      lng0,
      lat0,
      x0,
      y0,
      lng1,
      lat1,
      p[0],
      p[1],
      proj,
      interval,
      points,
    );
    points.push(p);
    densifySegment(
      lng1,
      lat1,
      p[0],
      p[1],
      lng2,
      lat2,
      x2,
      y2,
      proj,
      interval,
      points,
    );
  }
  return points;
}
