import { getBoundsSearchFunction } from "../geom/mapshaper-bounds-search";
import geom from "../geom/mapshaper-geom";
import { PathIndex } from "../paths/mapshaper-path-index";
import { getPathMetadata, reversePath } from "../paths/mapshaper-path-utils";
import { debug } from "../utils/mapshaper-logging";

export function fixNestingErrors(rings, arcs) {
  if (rings.length <= 1) return rings;
  var ringData = getPathMetadata(rings, arcs, "polygon");

  var shapes = rings.map(function (ids) {
    return [ids];
  });
  var index = new PathIndex(shapes, arcs);
  return rings.filter(ringIsValid);

  function ringIsValid(ids, i) {
    var containerId = index.findSmallestEnclosingPolygon(ids);
    var ringIsCW, containerIsCW;
    var valid = true;
    if (containerId > -1) {
      ringIsCW = ringData[i].area > 0;
      containerIsCW = ringData[containerId].area > 0;
      if (containerIsCW === ringIsCW) {
        valid = false;
      }
    }
    return valid;
  }
}

export function rewindPolygons(lyr, arcs) {
  lyr.shapes = lyr.shapes.map(function (shp) {
    if (!shp) return null;
    return rewindPolygon(shp, arcs);
  });
}

function rewindPolygon(rings, arcs) {
  var ringData = getPathMetadata(rings, arcs, "polygon");

  ringData.sort(function (a, b) {
    return Math.abs(b.area) - Math.abs(a.area);
  });

  ringData.forEach(function (ring, i) {
    var shouldBeCW = true;
    var j = i;
    var largerRing;
    while (--j >= 0) {
      largerRing = ringData[j];
      if (testRingInRing(ring, largerRing, arcs)) {
        shouldBeCW = !(largerRing.area > 0);
        break;
      }
    }
    setRingWinding(ring, shouldBeCW);
  });
  return ringData.map(function (data) {
    return data.ids;
  });
}

function setRingWinding(data, cw) {
  var isCW = data.area > 0;
  if (isCW !== cw) {
    data.area = -data.area;
    reversePath(data.ids);
  }
}

function testRingInRing(a, b, arcs) {
  if (b.bounds.contains(a.bounds) === false) return false;
  var p = arcs.getVertex(a.ids[0], 0);
  return geom.testPointInRing(p.x, p.y, b.ids, arcs) === 1;
}

export function groupPolygonRings(paths, arcs, reverseWinding) {
  var holes = [],
    groups = [],
    sign = reverseWinding ? -1 : 1,
    boundsQuery;

  (paths || []).forEach(function (path) {
    if (path.area * sign > 0) {
      groups.push([path]);
    } else if (path.area * sign < 0) {
      holes.push(path);
    } else {
    }
  });

  if (holes.length === 0) {
    return groups;
  }

  boundsQuery = getBoundsSearchFunction(
    groups.map(function (group, i) {
      return {
        bounds: group[0].bounds,
        idx: i,
      };
    }),
  );

  holes.forEach(function (hole) {
    var containerId = -1,
      containerArea = 0,
      holeArea = hole.area * -sign,
      b = hole.bounds,
      candidates = boundsQuery(b.xmin, b.ymin, b.xmax, b.ymax),
      ring,
      ringId,
      ringArea,
      isContained;

    for (var i = 0, n = candidates.length; i < n; i++) {
      ringId = candidates[i].idx;
      ring = groups[ringId][0];
      ringArea = ring.area * sign;
      isContained = ring.bounds.contains(hole.bounds) && ringArea > holeArea;
      if (
        isContained &&
        candidates.length > 1 &&
        !testRingInRing(hole, ring, arcs)
      ) {
        continue;
      }
      if (isContained && (containerArea === 0 || ringArea < containerArea)) {
        containerArea = ringArea;
        containerId = ringId;
      }
    }
    if (containerId === -1) {
      debug(
        "[groupPolygonRings()] polygon hole is missing a containing ring, dropping.",
      );
    } else {
      groups[containerId].push(hole);
    }
  });

  return groups;
}
