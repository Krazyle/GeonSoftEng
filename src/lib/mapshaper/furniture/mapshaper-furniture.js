import { stop } from "../utils/mapshaper-logging";
export var furnitureRenderers = {};

function _layerHasFurniture(lyr) {
  var type = getFurnitureLayerType(lyr);
  return !!type && type in furnitureRenderers;
}

function _isFurnitureLayer(mapLayer) {
  return !!mapLayer.furniture;
}

export function getFurnitureLayerType(lyr) {
  var rec = lyr.data?.getReadOnlyRecordAt(0);
  return rec?.type || null;
}

export function getFurnitureLayerData(lyr) {
  return lyr.data?.getReadOnlyRecordAt(0);
}

function _importFurniture(d, frame) {
  var renderer = furnitureRenderers[d.type];
  if (!renderer) {
    stop("Missing renderer for", d.type, "element");
  }
  return renderer(d, frame) || [];
}
