import geom from "../geom/mapshaper-geom";
import { IdLookupIndex } from "../indexing/mapshaper-id-lookup-index";
import { IdTestIndex } from "../indexing/mapshaper-id-test-index";
import { getHoleDivider } from "../polygons/mapshaper-polygon-holes";
import { buildPolygonMosaic } from "../polygons/mapshaper-polygon-mosaic";
import { PolygonTiler } from "../polygons/mapshaper-polygon-tiler";
import { TileShapeIndex } from "../polygons/mapshaper-tile-shape-index";
import { error, stop } from "../utils/mapshaper-logging";

export function MosaicIndex(lyr, nodes, optsArg) {
  var opts = optsArg || {};
  var shapes = lyr.shapes;
  var _divide = getHoleDivider(nodes);
  var mosaic = buildPolygonMosaic(nodes).mosaic;

  var arcTileIndex = new ShapeArcIndex(mosaic, nodes.arcs);

  var fetchedTileIndex = new IdTestIndex(mosaic.length, true);

  var tileShapeIndex = new TileShapeIndex(mosaic, opts);

  var shapeTiler = new PolygonTiler(mosaic, arcTileIndex, nodes, opts);
  var weightFunction = null;
  if (!opts.simple && opts.flat) {
    weightFunction = getOverlapPriorityFunction(
      lyr.shapes,
      nodes.arcs,
      opts.overlap_rule,
    );
  }
  this.mosaic = mosaic;
  this.nodes = nodes;
  this.getSourceIdsByTileId = tileShapeIndex.getShapeIdsByTileId;
  this.getTileIdsByShapeId = tileShapeIndex.getTileIdsByShapeId;

  shapes.forEach(function (shp, shapeId) {
    var tileIds = shapeTiler.getTilesInShape(shp, shapeId);
    tileShapeIndex.indexTileIdsByShapeId(shapeId, tileIds, weightFunction);
  });

  if (opts.flat) {
    tileShapeIndex.flatten();
  }

  this.removeGaps = function (filter) {
    if (!opts.flat) {
      error(
        "MosaicIndex#removeGaps() should only be called with a flat mosaic",
      );
    }
    var remainingIds = tileShapeIndex.getUnusedTileIds();
    var filledIds = remainingIds.filter(function (tileId) {
      var tile = mosaic[tileId];
      return filter(tile[0]);
    });
    filledIds.forEach(assignTileToAdjacentShape);
    return {
      removed: filledIds.length,
      remaining: remainingIds.length - filledIds.length,
    };
  };

  this.getUnusedTiles = function () {
    return tileShapeIndex.getUnusedTileIds().map(tileIdToTile);
  };

  this.getTilesByShapeIds = function (shapeIds) {
    return getTileIdsByShapeIds(shapeIds).map(tileIdToTile);
  };

  function getOverlapPriorityFunction(shapes, arcs, rule) {
    var f;
    if (!rule || rule === "max-area") {
      f = getAreaWeightFunction(shapes, arcs, false);
    } else if (rule === "min-area") {
      f = getAreaWeightFunction(shapes, arcs, true);
    } else if (rule === "max-id") {
      f = function (shapeId) {
        return shapeId;
      };
    } else if (rule === "min-id") {
      f = function (shapeId) {
        return -shapeId;
      };
    } else {
      stop("Unknown overlap rule:", rule);
    }
    return f;
  }

  function getAreaWeightFunction(shapes, arcs, invert) {
    var index = [];
    var sign = invert ? -1 : 1;
    return function (shpId) {
      var weight;
      if (shpId in index) {
        weight = index[shpId];
      } else {
        weight = sign * Math.abs(geom.getShapeArea(shapes[shpId], arcs));
        index[shpId] = weight;
      }
      return weight;
    };
  }

  function tileIdToTile(id, _i) {
    return mosaic[id];
  }

  function assignTileToAdjacentShape(tileId) {
    var ring = mosaic[tileId][0];
    var arcs = nodes.arcs;
    var arcId, neighborShapeId, neighborTileId, arcLen;
    var shapeId = -1,
      maxArcLen = 0;
    for (var i = 0; i < ring.length; i++) {
      arcId = ring[i];
      neighborTileId = arcTileIndex.getShapeIdByArcId(~arcId);
      if (neighborTileId < 0) continue;
      neighborShapeId = tileShapeIndex.getShapeIdByTileId(neighborTileId);
      if (neighborShapeId < 0) continue;
      arcLen = geom.getPathPerimeter([arcId], arcs);
      if (arcLen > maxArcLen) {
        shapeId = neighborShapeId;
        maxArcLen = arcLen;
      }
    }
    if (shapeId > -1) {
      tileShapeIndex.addTileToShape(shapeId, tileId);
    }
  }

  function getTileIdsByShapeIds(shapeIds) {
    var uniqIds = [];
    var tileId, tileIds, i, j;
    for (i = 0; i < shapeIds.length; i++) {
      tileIds = tileShapeIndex.getTileIdsByShapeId(shapeIds[i]);
      for (j = 0; j < tileIds.length; j++) {
        tileId = tileIds[j];

        if (fetchedTileIndex.hasId(tileId)) continue;
        fetchedTileIndex.setId(tileId);
        uniqIds.push(tileId);
      }
    }

    fetchedTileIndex.clear();
    return uniqIds;
  }
}

function ShapeArcIndex(shapes, arcs) {
  var n = arcs.size();
  var index = new IdLookupIndex(n);
  var shapeId;
  shapes.forEach(onShape);

  function onShape(shp, i) {
    shapeId = i;
    shp.forEach(onPart);
  }
  function onPart(path) {
    var arcId;
    for (var i = 0, n = path.length; i < n; i++) {
      arcId = path[i];
      index.setId(arcId, shapeId);
    }
  }

  this.getShapeIdByArcId = function (arcId) {
    return index.getId(arcId);
  };
}
