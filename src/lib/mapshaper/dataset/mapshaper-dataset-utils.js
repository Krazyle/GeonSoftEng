import {
  copyLayer,
  copyLayerShapes,
  getFeatureCount,
  getLayerBounds,
  layerHasGeometry,
  layerHasPaths,
  layerHasPoints,
  transformPointsInLayer,
} from "../dataset/mapshaper-layer-utils";
import { mergeDatasetsIntoDataset } from "../dataset/mapshaper-merging";
import { Bounds } from "../geom/mapshaper-bounds";
import { dissolveArcs } from "../paths/mapshaper-arc-dissolve";
import { buildTopology } from "../topology/mapshaper-topology";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function splitDataset(dataset) {
  return dataset.layers.map(function (lyr) {
    var split = {
      arcs: dataset.arcs,
      layers: [lyr],
      info: utils.extend({}, dataset.info),
    };
    dissolveArcs(split);
    return split;
  });
}

function _splitApartLayers(dataset, layers) {
  var datasets = [];
  dataset.layers = dataset.layers.filter(function (lyr) {
    if (!layers.includes(lyr)) {
      return true;
    }
    var split = {
      arcs: dataset.arcs,
      layers: [lyr],
      info: utils.extend({}, dataset.info),
    };
    dissolveArcs(split);
    datasets.push(split);
    return false;
  });
  if (dataset.layers.length) {
    dissolveArcs(dataset);
    datasets.push(dataset);
  }
  return datasets;
}

function _copyDataset(dataset) {
  var d2 = utils.extend({}, dataset);
  d2.layers = d2.layers.map(copyLayer);
  if (d2.arcs) {
    d2.arcs = d2.arcs.getFilteredCopy();
  }
  return d2;
}

export function copyDatasetForExport(dataset) {
  var d2 = utils.extend({}, dataset);
  d2.layers = d2.layers.map(copyLayerShapes);
  if (d2.arcs) {
    d2.arcs = d2.arcs.getFilteredCopy();
  }
  return d2;
}

export function copyDatasetForRenaming(dataset) {
  return utils.defaults(
    {
      layers: dataset.layers.map(function (lyr) {
        return utils.extend({}, lyr);
      }),
    },
    dataset,
  );
}

export function getDatasetBounds(dataset) {
  var bounds = new Bounds();
  dataset.layers.forEach(function (lyr) {
    var lyrbb = getLayerBounds(lyr, dataset.arcs);
    if (lyrbb) bounds.mergeBounds(lyrbb);
  });
  return bounds;
}

export function datasetHasGeometry(dataset) {
  return utils.some(dataset.layers, function (lyr) {
    return layerHasGeometry(lyr);
  });
}

export function datasetHasPaths(dataset) {
  return utils.some(dataset.layers, function (lyr) {
    return layerHasPaths(lyr);
  });
}

function cleanupArcs(dataset) {
  if (dataset.arcs && !utils.some(dataset.layers, layerHasPaths)) {
    dataset.arcs = null;
    return true;
  }
}

function _pruneArcs(dataset) {
  cleanupArcs(dataset);
  if (dataset.arcs) {
    dissolveArcs(dataset);
  }
}

export function replaceLayers(dataset, cutLayers, newLayers) {
  var currLayers = dataset.layers.concat();
  utils.repeat(Math.max(cutLayers.length, newLayers.length), function (i) {
    var cutLyr = cutLayers[i],
      newLyr = newLayers[i],
      idx = cutLyr ? currLayers.indexOf(cutLyr) : currLayers.length;

    if (cutLyr) {
      currLayers.splice(idx, 1);
    }
    if (newLyr) {
      currLayers.splice(idx, 0, newLyr);
    }
  });
  dataset.layers = currLayers;
}

function _replaceLayerContents(lyr, dataset, dataset2) {
  var lyr2 = mergeOutputLayerIntoDataset(lyr, dataset, dataset2, {});
  if (layerHasPaths(lyr2)) {
    buildTopology(dataset);
  }
}

function mergeOutputLayerIntoDataset(lyr, dataset, dataset2, opts) {
  if (!dataset2 || dataset2.layers.length !== 1) {
    error("Invalid source dataset");
  }
  if (dataset.layers.includes(lyr) === false) {
    error("Invalid target layer");
  }

  var outputLayers = mergeDatasetsIntoDataset(dataset, [dataset2]);
  var lyr2 = outputLayers[0];

  var copyData =
    !lyr2.data && lyr.data && getFeatureCount(lyr2) === lyr.data.size();

  if (copyData) {
    lyr2.data = opts.no_replace ? lyr.data.clone() : lyr.data;
  }
  if (opts.no_replace) {
  } else {
    lyr2 = Object.assign(lyr, { data: null, shapes: null }, lyr2);
    if (layerHasPaths(lyr)) {
      dissolveArcs(dataset);
    }
  }

  lyr2.name = opts.name || lyr2.name;
  return lyr2;
}

export function transformPoints(dataset, f) {
  if (dataset.arcs) {
    dataset.arcs.transformPoints(f);
  }
  dataset.layers.forEach(function (lyr) {
    if (layerHasPoints(lyr)) {
      transformPointsInLayer(lyr, f);
    }
  });
}
