import geom from "../geom/mapshaper-geom";
import { forEachSegmentInShape } from "../paths/mapshaper-path-utils";
import { sortSegmentIds } from "../paths/mapshaper-segment-sorting";
import { error } from "../utils/mapshaper-logging";

export function PolygonIndex(shape, arcs, _opts) {
  var data = arcs.getVertexData(),
    polygonBounds = arcs.getMultiShapeBounds(shape),
    boundsLeft,
    xminIds,
    xmaxIds,
    bucketCount,
    bucketOffsets,
    bucketWidth;

  init();

  this.pointInPolygon = function (x, y) {
    if (!polygonBounds.containsPoint(x, y)) {
      return false;
    }
    var bucketId = getBucketId(x);
    var count = countCrosses(x, y, bucketId);
    if (bucketId > 0) {
      count += countCrosses(x, y, bucketId - 1);
    }
    count += countCrosses(x, y, bucketCount);
    if (Number.isNaN(count)) return -1;
    return count % 2 === 1 ? 1 : 0;
  };

  function countCrosses(x, y, bucketId) {
    var offs = bucketOffsets[bucketId],
      count = 0,
      xx = data.xx,
      yy = data.yy,
      n,
      a,
      b;
    if (bucketId === bucketCount) {
      n = xminIds.length - offs;
    } else {
      n = bucketOffsets[bucketId + 1] - offs;
    }
    for (var i = 0; i < n; i++) {
      a = xminIds[i + offs];
      b = xmaxIds[i + offs];
      count += geom.testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    }
    return count;
  }

  function getBucketId(x) {
    var i = Math.floor((x - boundsLeft) / bucketWidth);
    if (i < 0) i = 0;
    if (i >= bucketCount) i = bucketCount - 1;
    return i;
  }

  function getBucketCount(segCount) {
    var buckets = segCount ** 0.75 / 10;
    return Math.ceil(buckets);
  }

  function init() {
    var xx = data.xx,
      segCount = 0,
      segId = 0,
      bucketId = -1,
      prevBucketId,
      segments,
      head,
      tail,
      a,
      b,
      i,
      j,
      xmin,
      xmax;

    forEachSegmentInShape(shape, arcs, function () {
      segCount++;
    });
    segments = new Uint32Array(segCount * 2);
    i = 0;
    forEachSegmentInShape(shape, arcs, function (a, b, _xx, _yy) {
      segments[i++] = a;
      segments[i++] = b;
    });
    sortSegmentIds(xx, segments);

    xminIds = new Uint32Array(segCount);
    xmaxIds = new Uint32Array(segCount);
    bucketCount = getBucketCount(segCount);
    bucketOffsets = new Uint32Array(bucketCount + 1);
    boundsLeft = xx[segments[0]];
    bucketWidth =
      (xx[segments[segments.length - 2]] - boundsLeft) / bucketCount;
    head = 0;
    tail = segCount - 1;

    while (segId < segCount) {
      j = segId * 2;
      a = segments[j];
      b = segments[j + 1];
      xmin = xx[a];
      xmax = xx[b];
      prevBucketId = bucketId;
      bucketId = getBucketId(xmin);

      while (bucketId > prevBucketId) {
        prevBucketId++;
        bucketOffsets[prevBucketId] = head;
      }

      if (xmax - xmin >= 0 === false) error("Invalid segment");
      if (getBucketId(xmax) - bucketId > 1) {
        xminIds[tail] = a;
        xmaxIds[tail] = b;
        tail--;
      } else {
        xminIds[head] = a;
        xmaxIds[head] = b;
        head++;
      }
      segId++;
    }
    bucketOffsets[bucketCount] = head;
    if (head !== tail + 1) error("Segment indexing error");
  }
}
