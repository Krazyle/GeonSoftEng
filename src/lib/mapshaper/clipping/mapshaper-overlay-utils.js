import {
  copyLayerShapes,
  layerHasPaths,
} from "../dataset/mapshaper-layer-utils";
import { mergeDatasets } from "../dataset/mapshaper-merging";
import { ArcCollection } from "../paths/mapshaper-arcs";
import { buildTopology } from "../topology/mapshaper-topology";
import { stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function mergeLayersForOverlay(
  targetLayers,
  targetDataset,
  clipSrc,
  opts,
) {
  var _usingPathClip = utils.some(targetLayers, layerHasPaths);
  var bbox = opts.bbox || opts.bbox2;
  var mergedDataset, clipDataset, clipLyr;
  if (clipSrc?.geometry_type) {
    clipSrc = { dataset: targetDataset, layer: clipSrc, disposable: true };
  }
  if (bbox) {
    clipDataset = convertClipBounds(bbox);
    clipLyr = clipDataset.layers[0];
  } else if (!clipSrc) {
    stop("Command requires a source file, layer id or bbox");
  } else if (clipSrc.layer && clipSrc.dataset) {
    clipLyr = clipSrc.layer;
    clipDataset = utils.defaults({ layers: [clipLyr] }, clipSrc.dataset);
  } else if (clipSrc.layers && clipSrc.layers.length === 1) {
    clipLyr = clipSrc.layers[0];
    clipDataset = clipSrc;
  }
  if (targetDataset.arcs !== clipDataset.arcs) {
    if (clipSrc && !clipSrc.disposable) {
      clipDataset.layers[0] = copyLayerShapes(clipDataset.layers[0]);
    }

    mergedDataset = mergeDatasets([targetDataset, clipDataset]);
    buildTopology(mergedDataset);
  } else {
    mergedDataset = utils.extend({}, targetDataset);
    mergedDataset.layers = targetDataset.layers.filter(function (lyr) {
      return lyr !== clipLyr;
    });
    mergedDataset.layers.push(clipLyr);
  }
  return mergedDataset;
}

function convertClipBounds(bb) {
  var x0 = bb[0],
    y0 = bb[1],
    x1 = bb[2],
    y1 = bb[3],
    arc = [
      [x0, y0],
      [x0, y1],
      [x1, y1],
      [x1, y0],
      [x0, y0],
    ];

  if (!(y1 > y0 && x1 > x0)) {
    stop("Invalid bbox (should be [xmin, ymin, xmax, ymax]):", bb);
  }
  return {
    arcs: new ArcCollection([arc]),
    layers: [
      {
        shapes: [[[0]]],
        geometry_type: "polygon",
      },
    ],
  };
}
