import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function TileShapeIndex(mosaic, opts) {
  var singleIndex = new Int32Array(mosaic.length);
  utils.initializeArray(singleIndex, -1);
  var multipleIndex = [];

  var shapeIndex = [];

  this.getTileIdsByShapeId = function (shapeId) {
    var ids = shapeIndex[shapeId];

    return ids
      ? ids.filter(function (id) {
          return id >= 0;
        })
      : [];
  };

  this.getShapeIdByTileId = function (id) {
    var shapeId = singleIndex[id];
    return shapeId >= 0 ? shapeId : -1;
  };

  this.getShapeIdsByTileId = function (id) {
    var singleId = singleIndex[id];
    if (singleId >= 0) {
      return [singleId];
    }
    if (singleId === -1) {
      return [];
    }
    return multipleIndex[id];
  };

  this.indexTileIdsByShapeId = function (shapeId, tileIds, weightFunction) {
    shapeIndex[shapeId] = [];
    for (var i = 0; i < tileIds.length; i++) {
      indexShapeIdByTileId(shapeId, tileIds[i], weightFunction);
    }
  };

  this.flatten = function () {
    multipleIndex.forEach(function (_shapeIds, tileId) {
      flattenStackedTile(tileId);
    });
    multipleIndex = [];
  };

  this.getUnusedTileIds = function () {
    var ids = [];
    for (var i = 0, n = singleIndex.length; i < n; i++) {
      if (singleIndex[i] === -1) ids.push(i);
    }
    return ids;
  };

  this.addTileToShape = function (shapeId, tileId) {
    if (shapeId in shapeIndex === false || singleIndex[tileId] !== -1) {
      error("Internal error");
    }
    singleIndex[tileId] = shapeId;
    shapeIndex[shapeId].push(tileId);
  };

  function indexShapeIdByTileId(shapeId, tileId, weightFunction) {
    var singleId = singleIndex[tileId];
    if (singleId !== -1 && opts.flat) {
      if (
        weightFunction &&
        weightFunction(shapeId) > weightFunction(singleId)
      ) {
        removeTileFromShape(tileId, singleId);
        singleIndex[tileId] = singleId;
        singleId = -1;
      } else {
        return;
      }
    }
    if (singleId === -1) {
      singleIndex[tileId] = shapeId;
    } else if (singleId === -2) {
      multipleIndex[tileId].push(shapeId);
    } else {
      multipleIndex[tileId] = [singleId, shapeId];
      singleIndex[tileId] = -2;
    }
    shapeIndex[shapeId].push(tileId);
  }

  function flattenStackedTile(tileId) {
    var shapeIds = multipleIndex[tileId];

    var selectedId = shapeIds[0];
    var shapeId;
    singleIndex[tileId] = selectedId;

    for (var i = 0; i < shapeIds.length; i++) {
      shapeId = shapeIds[i];
      if (shapeId !== selectedId) {
        removeTileFromShape(tileId, shapeId);
      }
    }
  }

  function removeTileFromShape(tileId, shapeId) {
    var tileIds = shapeIndex[shapeId];
    for (var i = 0; i < tileIds.length; i++) {
      if (tileIds[i] === tileId) {
        tileIds[i] = -1;
        break;
      }
    }
  }

  function _removeTileFromShape_old(tileId, shapeId) {
    shapeIndex[shapeId] = shapeIndex[shapeId].filter(function (tileId2) {
      return tileId2 !== tileId;
    });
    if (shapeIndex[shapeId].length > 0 === false) {
    }
  }
}
