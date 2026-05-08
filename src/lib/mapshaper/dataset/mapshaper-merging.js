import { requireDatasetsHaveCompatibleCRS } from "../crs/mapshaper-projections";
import { copyLayerShapes } from "../dataset/mapshaper-layer-utils";
import { ArcCollection } from "../paths/mapshaper-arcs";
import { forEachArcId } from "../paths/mapshaper-path-utils";
import { buildTopology } from "../topology/mapshaper-topology";
import { error, verbose } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function mergeDatasetsIntoDataset(dataset, datasets) {
  var merged = mergeDatasets([dataset].concat(datasets));
  var mergedLayers = datasets.reduce(function (memo, dataset) {
    return memo.concat(dataset.layers);
  }, []);
  dataset.arcs = merged.arcs;
  return mergedLayers;
}

export function mergeDatasetsForExport(arr) {
  var copy = arr.map(function (dataset) {
    return utils.defaults(
      {
        layers: dataset.layers.map(copyLayerShapes),
      },
      dataset,
    );
  });
  return mergeDatasets(copy);
}

function _mergeCommandTargets(targets, catalog) {
  var targetLayers = [];
  var targetDatasets = [];
  var datasetsWithArcs = 0;
  var merged;

  targets.forEach(function (target) {
    targetLayers = targetLayers.concat(target.layers);
    targetDatasets = targetDatasets.concat(target.dataset);
    if (target.dataset.arcs && target.dataset.arcs.size() > 0)
      datasetsWithArcs++;
  });

  merged = mergeDatasets(targetDatasets);

  if (datasetsWithArcs > 1) {
    buildTopology(merged);
  }

  targetDatasets.forEach(catalog.removeDataset);
  catalog.addDataset(merged);
  catalog.setDefaultTarget(targetLayers, merged);
  return [
    {
      layers: targetLayers,
      dataset: merged,
    },
  ];
}

export function mergeDatasets(arr) {
  var arcSources = [],
    arcCount = 0,
    mergedLayers = [],
    mergedInfo = {},
    mergedArcs;

  requireDatasetsHaveCompatibleCRS(arr);

  arr.forEach(function (dataset) {
    var n = dataset.arcs ? dataset.arcs.size() : 0;
    if (n > 0) {
      arcSources.push(dataset.arcs);
    }

    mergeDatasetInfo(mergedInfo, dataset);
    dataset.layers.forEach(function (lyr) {
      if (lyr.geometry_type === "polygon" || lyr.geometry_type === "polyline") {
        forEachArcId(lyr.shapes, function (id) {
          return id < 0 ? id - arcCount : id + arcCount;
        });
      }
      mergedLayers.push(lyr);
    });
    arcCount += n;
  });

  if (arcSources.length > 0) {
    mergedArcs = mergeArcs(arcSources);
    if (mergedArcs.size() !== arcCount) {
      error("[mergeDatasets()] Arc indexing error");
    }
  }

  return {
    info: mergedInfo,
    arcs: mergedArcs,
    layers: mergedLayers,
  };
}

function mergeDatasetInfo(merged, dataset) {
  var info = dataset.info || {};
  merged.input_files = utils.uniq(
    (merged.input_files || []).concat(info.input_files || []),
  );
  merged.input_formats = utils.uniq(
    (merged.input_formats || []).concat(info.input_formats || []),
  );

  utils.defaults(merged, info);
}

export function mergeArcs(arr) {
  var dataArr = arr.map(function (arcs) {
    if (arcs.getRetainedInterval() > 0) {
      verbose("Baking-in simplification setting.");
      arcs.flatten();
    }
    return arcs.getVertexData();
  });
  var xx = mergeArrays(utils.pluck(dataArr, "xx"), Float64Array),
    yy = mergeArrays(utils.pluck(dataArr, "yy"), Float64Array),
    nn = mergeArrays(utils.pluck(dataArr, "nn"), Int32Array);

  return new ArcCollection(nn, xx, yy);
}

function countElements(arrays) {
  return arrays.reduce(function (memo, arr) {
    return memo + (arr.length || 0);
  }, 0);
}

function mergeArrays(arrays, TypedArr) {
  var size = countElements(arrays),
    Arr = TypedArr || Array,
    merged = new Arr(size),
    offs = 0;
  arrays.forEach(function (src) {
    var n = src.length;
    for (var i = 0; i < n; i++) {
      merged[i + offs] = src[i];
    }
    offs += n;
  });
  return merged;
}
