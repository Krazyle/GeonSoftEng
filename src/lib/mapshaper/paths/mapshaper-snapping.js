import { getAvgSegment } from "../paths/mapshaper-path-utils";
import { message } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function getHighPrecisionSnapInterval(coords) {
  var maxCoord = Math.max.apply(null, coords.map(Math.abs));
  return maxCoord * 1e-14;
}

export function snapCoords(arcs, threshold) {
  var avgDist = getAvgSegment(arcs),
    autoSnapDist = avgDist * 0.0025,
    snapDist = autoSnapDist;

  if (threshold > 0) {
    snapDist = threshold;
    message(
      utils.format(
        "Applying snapping threshold of %s -- %.6f times avg. segment length",
        threshold,
        threshold / avgDist,
      ),
    );
  }
  var snapCount = snapCoordsByInterval(arcs, snapDist);
  if (snapCount > 0) arcs.dedupCoords();
  message(
    utils.format(
      "Snapped %s point%s",
      snapCount,
      utils.pluralSuffix(snapCount),
    ),
  );
}

export function snapCoordsByInterval(arcs, snapDist) {
  var snapCount = 0,
    data = arcs.getVertexData(),
    ids;

  if (snapDist > 0) {
    ids = sortCoordinateIds(data.xx);
    for (var i = 0, n = ids.length; i < n; i++) {
      snapCount += snapPoint(i, snapDist, ids, data.xx, data.yy);
    }
  }
  return snapCount;

  function snapPoint(i, limit, ids, xx, yy) {
    var j = i,
      n = ids.length,
      x = xx[ids[i]],
      y = yy[ids[i]],
      snaps = 0,
      id2,
      dx,
      dy;

    while (++j < n) {
      id2 = ids[j];
      dx = xx[id2] - x;
      if (dx > limit) break;
      dy = yy[id2] - y;
      if ((dx === 0 && dy === 0) || dx * dx + dy * dy > limit * limit) continue;
      xx[id2] = x;
      yy[id2] = y;
      snaps++;
    }
    return snaps;
  }
}

function sortCoordinateIds(a) {
  var n = a.length,
    ids = new Uint32Array(n);
  for (var i = 0; i < n; i++) {
    ids[i] = i;
  }
  quicksortIds(a, ids, 0, ids.length - 1);
  return ids;
}

function quicksortIds(a, ids, lo, hi) {
  if (hi - lo > 24) {
    var pivot = a[ids[(lo + hi) >> 1]],
      i = lo,
      j = hi,
      tmp;
    while (i <= j) {
      while (a[ids[i]] < pivot) i++;
      while (a[ids[j]] > pivot) j--;
      if (i <= j) {
        tmp = ids[i];
        ids[i] = ids[j];
        ids[j] = tmp;
        i++;
        j--;
      }
    }
    if (j > lo) quicksortIds(a, ids, lo, j);
    if (i < hi) quicksortIds(a, ids, i, hi);
  } else {
    insertionSortIds(a, ids, lo, hi);
  }
}

function insertionSortIds(arr, ids, start, end) {
  var id, i, j;
  for (j = start + 1; j <= end; j++) {
    id = ids[j];
    for (i = j - 1; i >= start && arr[id] < arr[ids[i]]; i--) {
      ids[i + 1] = ids[i];
    }
    ids[i + 1] = id;
  }
}
