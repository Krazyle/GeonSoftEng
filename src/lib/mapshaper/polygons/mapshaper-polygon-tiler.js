import { IdTestIndex } from "../indexing/mapshaper-id-test-index";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { getHoleDivider } from "../polygons/mapshaper-polygon-holes";
import { debug } from "../utils/mapshaper-logging";

export function PolygonTiler(mosaic, arcTileIndex, nodes, opts) {
  var arcs = nodes.arcs;
  var visitedTileIndex = new IdTestIndex(mosaic.length, true);
  var divide = getHoleDivider(nodes);

  var currHoles;
  var _currShapeId;
  var currRingBbox;
  var tilesInShape;
  var ringIndex = new IdTestIndex(arcs.size(), true);
  var holeIndex = new IdTestIndex(arcs.size(), true);

  this.getTilesInShape = function (shp, shapeId) {
    var cw = [],
      ccw = [],
      retn;
    tilesInShape = [];
    currHoles = [];
    _currShapeId = shapeId;
    if (opts.no_holes) {
      divide(shp, cw, ccw);
    } else {
      divide(shp, cw, ccw);
      ccw.forEach(procShapeHole);
      holeIndex.setIds(currHoles);
    }
    cw.forEach(procShapeRing);
    retn = tilesInShape;

    tilesInShape = null;
    holeIndex.clear();
    currHoles = null;
    return retn;
  };

  function procShapeHole(path) {
    currHoles = currHoles ? currHoles.concat(path) : path;
  }

  function procShapeRing(path) {
    currRingBbox = arcs.getSimpleShapeBounds2(path);
    ringIndex.setIds(path);
    procArcIds(path);
    ringIndex.clear();

    visitedTileIndex.clear();
  }

  function procArcIds(ids) {
    var stack = ids.concat();
    var arcId, tileId;
    while (stack.length > 0) {
      arcId = stack.pop();
      tileId = procRingArc(arcId);
      if (tileId >= 0) {
        accumulateTraversibleArcIds(stack, mosaic[tileId]);
      }
    }
  }

  function accumulateTraversibleArcIds(ids, tile) {
    var arcId, ring;
    for (var j = 0, n = tile.length; j < n; j++) {
      ring = tile[j];
      for (var i = 0, m = ring.length; i < m; i++) {
        arcId = ring[i];
        if (arcIsTraversible(arcId)) {
          ids.push(~arcId);
        }
      }
    }
  }

  function arcIsTraversible(tileArc) {
    var neighborArc = ~tileArc;
    var traversible = !(
      ringIndex.hasId(tileArc) ||
      ringIndex.hasId(neighborArc) ||
      holeIndex.hasId(tileArc) ||
      holeIndex.hasId(neighborArc)
    );
    return traversible;
  }

  function procRingArc(arcId) {
    var tileId = arcTileIndex.getShapeIdByArcId(arcId);
    if (tileId === -1 || visitedTileIndex.hasId(tileId)) return -1;
    if (arcs.arcIsContained(absArcId(arcId), currRingBbox) === false) {
      debug("Out-of-bounds ring-3 arc", arcId);
      return -1;
    }
    visitedTileIndex.setId(tileId);
    tilesInShape.push(tileId);
    return tileId;
  }
}
