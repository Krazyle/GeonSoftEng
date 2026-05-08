import {
  layerHasGeometry,
  layerHasPaths,
} from "../dataset/mapshaper-layer-utils";
import { dissolvePolygonGroups2 } from "../dissolve/mapshaper-polygon-dissolve2";
import cmd from "../mapshaper-cmd";
import { dissolveArcs } from "../paths/mapshaper-arc-dissolve";
import { addIntersectionCuts } from "../paths/mapshaper-intersection-cuts";
import { rewindPolygons } from "../polygons/mapshaper-ring-nesting";
import { cleanPolylineLayerGeometry } from "../polylines/mapshaper-polyline-clean";
import utils from "../utils/mapshaper-utils";

cmd.cleanLayers = cleanLayers;

export function cleanLayers(layers, dataset, optsArg) {
  var opts = optsArg || {};
  var deepClean = !opts.only_arcs;
  var pathClean = utils.some(layers, layerHasPaths);
  var nodes;
  if (opts.debug) {
    addIntersectionCuts(dataset, opts);
    return;
  }
  layers.forEach(function (lyr) {
    if (!layerHasGeometry(lyr)) return;
    if (lyr.geometry_type === "polygon" && opts.rewind) {
      rewindPolygons(lyr, dataset.arcs);
    }
    if (deepClean) {
      if (!nodes) {
        nodes = addIntersectionCuts(dataset, opts);
      }
      if (lyr.geometry_type === "polygon") {
        cleanPolygonLayerGeometry(lyr, dataset, opts);
      } else if (lyr.geometry_type === "polyline") {
        cleanPolylineLayerGeometry(lyr, dataset, opts);
      } else if (lyr.geometry_type === "point") {
        cleanPointLayerGeometry(lyr, dataset, opts);
      }
    }
    if (!opts.allow_empty) {
      cmd.filterFeatures(lyr, dataset.arcs, {
        remove_empty: true,
        verbose: opts.verbose,
      });
    }
  });

  if (!opts.no_arc_dissolve && pathClean && dataset.arcs) {
    dissolveArcs(dataset);
  }
}

function cleanPolygonLayerGeometry(lyr, dataset, opts) {
  var groups = lyr.shapes.map(function (_shp, i) {
    return [i];
  });
  lyr.shapes = dissolvePolygonGroups2(groups, lyr, dataset, opts);
}

function cleanPointLayerGeometry(lyr, _dataset, _opts) {
  var index, parts;
  lyr.shapes = lyr.shapes.map(function (shp, _i) {
    if (!shp || shp.length > 0 === false) {
      return null;
    }
    if (shp.length === 1) {
      return shp;
    }

    index = {};
    parts = [];
    shp.forEach(onPoint);
    if (parts.length === 0) {
      return null;
    }
    return parts;
  });

  function onPoint(p) {
    var key = p.join("~");
    if (key in index) return;
    index[key] = true;
    parts.push(p);
  }
}
