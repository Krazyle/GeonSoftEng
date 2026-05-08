import { getPolygonDissolver } from "../dissolve/mapshaper-polygon-dissolver";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { PathIndex } from "../paths/mapshaper-path-index";
import { reversePath } from "../paths/mapshaper-path-utils";
import {
  closeArcRoutes,
  getPathFinder,
  openArcRoutes,
  setBits,
} from "../paths/mapshaper-pathfinder";
import { forEachShapePart } from "../paths/mapshaper-shape-utils";

export function clipPolygons(targetShapes, clipShapes, nodes, type, optsArg) {
  var arcs = nodes.arcs;
  var opts = optsArg || {};
  var clipFlags = new Uint8Array(arcs.size());
  var routeFlags = new Uint8Array(arcs.size());
  var clipArcTouches = 0;
  var clipArcUses = 0;
  var usedClipArcs = [];
  var dividePath = getPathFinder(nodes, useRoute, routeIsActive);
  var dissolvePolygon = getPolygonDissolver(nodes);

  if (!opts.bbox2) {
    targetShapes = targetShapes.map(dissolvePolygon);
  }

  openArcRoutes(
    clipShapes,
    arcs,
    clipFlags,
    type === "clip",
    type === "erase",
    !!"dissolve",
    0x11,
  );
  var index = new PathIndex(clipShapes, arcs);
  var clippedShapes = targetShapes.map(function (shape, _i) {
    if (shape) {
      return clipPolygon(shape, type, index);
    }
    return null;
  });

  var undividedClipShapes = findUndividedClipShapes(clipShapes);

  closeArcRoutes(clipShapes, arcs, routeFlags, true, true);
  index = new PathIndex(undividedClipShapes, arcs);
  targetShapes.forEach(function (shape, shapeId) {
    var paths = shape ? findInteriorPaths(shape, type, index) : null;
    if (paths) {
      clippedShapes[shapeId] = (clippedShapes[shapeId] || []).concat(paths);
    }
  });

  return clippedShapes;

  function clipPolygon(shape, type, index) {
    var dividedShape = [],
      clipping = type === "clip",
      erasing = type === "erase";

    openArcRoutes(shape, arcs, routeFlags, true, false, false);

    forEachShapePart(shape, function (ids) {
      var path;
      for (var i = 0, n = ids.length; i < n; i++) {
        clipArcTouches = 0;
        clipArcUses = 0;
        path = dividePath(ids[i]);
        if (path) {
          if (clipArcTouches === 0 || clipArcUses === 0) {
            var contained = index.pathIsEnclosed(path);
            if ((clipping && contained) || (erasing && !contained)) {
              dividedShape.push(path);
            }
          } else {
            dividedShape.push(path);
          }
        }
      }
    });

    closeArcRoutes(shape, arcs, routeFlags, true, true, true);

    if (usedClipArcs.length > 0) {
      closeArcRoutes(usedClipArcs, arcs, routeFlags, true, true, true);
      usedClipArcs = [];
    }

    return dividedShape.length === 0 ? null : dividedShape;
  }

  function routeIsActive(id) {
    var fw = id >= 0,
      abs = fw ? id : ~id,
      visibleBit = fw ? 1 : 0x10,
      targetBits = routeFlags[abs],
      clipBits = clipFlags[abs];

    if (clipBits > 0) clipArcTouches++;
    return (targetBits & visibleBit) > 0 || (clipBits & visibleBit) > 0;
  }

  function useRoute(id) {
    var fw = id >= 0,
      abs = fw ? id : ~id,
      targetBits = routeFlags[abs],
      clipBits = clipFlags[abs],
      targetRoute,
      clipRoute;

    if (fw) {
      targetRoute = targetBits;
      clipRoute = clipBits;
    } else {
      targetRoute = targetBits >> 4;
      clipRoute = clipBits >> 4;
    }
    targetRoute &= 3;
    clipRoute &= 3;

    var usable = false;

    if (targetRoute === 3) {
      if (clipRoute === 1) {
      } else if (clipRoute === 2 && type === "erase") {
      } else {
        usable = true;
      }
    } else if (targetRoute === 0 && clipRoute === 3) {
      usedClipArcs.push(id);
      usable = true;
    }

    if (usable) {
      if (clipRoute === 3) {
        clipArcUses++;
      }

      if (fw) {
        targetBits = setBits(targetBits, 1, 3);
      } else {
        targetBits = setBits(targetBits, 0x10, 0x30);
      }
    }

    targetBits |= fw ? 4 : 0x40;
    routeFlags[abs] = targetBits;
    return usable;
  }

  function findUndividedClipShapes(clipShapes) {
    return clipShapes.map(function (shape) {
      var usableParts = [];
      forEachShapePart(shape, function (ids) {
        var pathIsClean = true,
          pathIsVisible = false;
        for (var i = 0; i < ids.length; i++) {
          if (!arcIsUnused(ids[i], routeFlags)) {
            pathIsClean = false;
            break;
          }

          if (!pathIsVisible && arcIsVisible(ids[i], clipFlags)) {
            pathIsVisible = true;
          }
        }
        if (pathIsClean && pathIsVisible) usableParts.push(ids);
      });
      return usableParts.length > 0 ? usableParts : null;
    });
  }

  function arcIsUnused(id, flags) {
    var abs = absArcId(id),
      flag = flags[abs];
    return (flag & 0x44) === 0;
  }

  function arcIsVisible(id, flags) {
    var flag = flags[absArcId(id)];
    return (flag & 0x11) > 0;
  }

  function findInteriorPaths(shape, type, index) {
    var enclosedPaths = index.findPathsInsideShape(shape),
      dissolvedPaths = [];
    if (!enclosedPaths) return null;

    if (type === "erase") enclosedPaths.forEach(reversePath);
    if (enclosedPaths.length <= 1) {
      dissolvedPaths = enclosedPaths;
    } else {
      openArcRoutes(enclosedPaths, arcs, routeFlags, true, false, true);
      enclosedPaths.forEach(function (ids) {
        var path;
        for (var j = 0; j < ids.length; j++) {
          path = dividePath(ids[j]);
          if (path) {
            dissolvedPaths.push(path);
          }
        }
      });
    }

    return dissolvedPaths.length > 0 ? dissolvedPaths : null;
  }
}
