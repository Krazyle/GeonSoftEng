import { getBoundsSearchFunction } from "../geom/mapshaper-bounds-search";
import geom from "../geom/mapshaper-geom";
import { getPathBounds } from "../paths/mapshaper-path-utils";
import { PolygonIndex } from "../polygons/mapshaper-polygon-index";
import utils from "../utils/mapshaper-utils";

export function PathIndex(shapes, arcs) {
  var boundsQuery = getBoundsSearchFunction(getRingData(shapes, arcs));
  var totalArea = getPathBounds(shapes, arcs).area();

  function getRingData(shapes, arcs) {
    var arr = [];
    shapes.forEach(function (shp, shpId) {
      var n = shp ? shp.length : 0;
      for (var i = 0; i < n; i++) {
        arr.push({
          ids: shp[i],
          id: shpId,
          bounds: arcs.getSimpleShapeBounds(shp[i]),
        });
      }
    });
    return arr;
  }

  this.findEnclosingShapes = function (p) {
    var ids = [];
    var cands = findPointHitCandidates(p);
    var groups = groupItemsByShapeId(cands);
    groups.forEach(function (group) {
      if (testPointInRings(p, group)) {
        ids.push(group[0].id);
      }
    });
    return ids;
  };

  this.findEnclosingShape = function (p) {
    var shpId = -1;
    var groups = groupItemsByShapeId(findPointHitCandidates(p));
    groups.forEach(function (group) {
      if (testPointInRings(p, group)) {
        shpId = group[0].id;
      }
    });
    return shpId;
  };

  this.findShapesEnclosingArc = function (arcId) {
    var p = getTestPoint([arcId]);
    return this.findEnclosingShapes(p);
  };

  this.findPointEnclosureCandidates = function (p, buffer) {
    var items = findPointHitCandidates(p, buffer);
    return utils.pluck(items, "id");
  };

  this.pointIsEnclosed = function (p) {
    return testPointInRings(p, findPointHitCandidates(p));
  };

  this.findSmallestEnclosingPolygon = function (ring) {
    var bounds = arcs.getSimpleShapeBounds(ring);
    var p = getTestPoint(ring);
    var smallest;
    var cands = findPointHitCandidates(p);
    cands.forEach(function (cand) {
      if (
        cand.bounds.contains(bounds) &&
        !cand.bounds.sameBounds(bounds) &&
        !(smallest && smallest.bounds.area() < cand.bounds.area())
      ) {
        if (testPointInRing(p, cand)) {
          smallest = cand;
        }
      }
    });

    return smallest ? smallest.id : -1;
  };

  this.arcIsEnclosed = function (arcId) {
    return this.pointIsEnclosed(getTestPoint([arcId]));
  };

  this.pathIsEnclosed = function (pathIds) {
    return this.pointIsEnclosed(getTestPoint(pathIds));
  };

  this.findEnclosedPaths = function (pathIds) {
    var b = arcs.getSimpleShapeBounds(pathIds),
      cands = boundsQuery(b.xmin, b.ymin, b.xmax, b.ymax),
      paths = [],
      index;

    if (cands.length > 6) {
      index = new PolygonIndex([pathIds], arcs);
    }
    cands.forEach(function (cand) {
      var p = getTestPoint(cand.ids);
      var isEnclosed =
        b.containsPoint(p[0], p[1]) &&
        (index
          ? index.pointInPolygon(p[0], p[1])
          : geom.testPointInRing(p[0], p[1], pathIds, arcs));
      if (isEnclosed) {
        paths.push(cand.ids);
      }
    });
    return paths.length > 0 ? paths : null;
  };

  this.findPathsInsideShape = function (shape) {
    var paths = [];
    shape.forEach(function (ids) {
      var enclosed = this.findEnclosedPaths(ids);
      if (enclosed) {
        paths = xorArrays(paths, enclosed);
      }
    }, this);
    return paths.length > 0 ? paths : null;
  };

  function testPointInRing(p, cand) {
    if (!cand.bounds.containsPoint(p[0], p[1])) return false;
    if (!cand.index && cand.bounds.area() > totalArea * 0.01) {
      cand.index = new PolygonIndex([cand.ids], arcs);
    }
    return cand.index
      ? cand.index.pointInPolygon(p[0], p[1])
      : geom.testPointInRing(p[0], p[1], cand.ids, arcs);
  }

  function testPointInRings(p, cands) {
    var isOn = false,
      isIn = false;
    cands.forEach(function (cand) {
      var inRing = testPointInRing(p, cand);
      if (inRing === -1) {
        isOn = true;
      } else if (inRing === 1) {
        isIn = !isIn;
      }
    });
    return isOn || isIn;
  }

  function groupItemsByShapeId(items) {
    var groups = [],
      group,
      item;
    if (items.length > 0) {
      items.sort(function (a, b) {
        return a.id - b.id;
      });
      for (var i = 0; i < items.length; i++) {
        item = items[i];
        if (i === 0 || item.id !== items[i - 1].id) {
          groups.push((group = []));
        }
        group.push(item);
      }
    }
    return groups;
  }

  function findPointHitCandidates(p, buffer) {
    var b = buffer > 0 ? buffer : 0;
    var _x = p[0],
      _y = p[1];
    return boundsQuery(p[0] - b, p[1] - b, p[0] + b, p[1] + b);
  }

  function getTestPoint(ring) {
    var arcId = ring[0],
      p0 = arcs.getVertex(arcId, 0),
      p1 = arcs.getVertex(arcId, 1);
    return [(p0.x + p1.x) / 2, (p0.y + p1.y) / 2];
  }

  function xorArrays(a, b) {
    var xor = [],
      i;
    for (i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) === -1) xor.push(a[i]);
    }
    for (i = 0; i < b.length; i++) {
      if (a.indexOf(b[i]) === -1) xor.push(b[i]);
    }
    return xor;
  }
}
