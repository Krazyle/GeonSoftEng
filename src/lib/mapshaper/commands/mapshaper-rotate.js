import { cleanProjectedLayers } from "../commands/mapshaper-proj";
import {
  densifyAntimeridianSegment,
  densifyPathByInterval,
  getIntervalInterpolator,
} from "../crs/mapshaper-densify";
import { getDatasetCRS, isLatLngCRS } from "../crs/mapshaper-projections";
import { getRotationFunction2 } from "../crs/mapshaper-spherical-rotation";
import { DatasetEditor } from "../dataset/mapshaper-dataset-editor";
import {
  removeCutSegments,
  removePolygonCrosses,
  removePolylineCrosses,
  segmentCrossesAntimeridian,
} from "../geom/mapshaper-antimeridian-cuts";
import cmd from "../mapshaper-cmd";
import {
  isEdgeSegment,
  isWholeWorld,
  lastEl,
  onPole,
  samePoint,
  snapToEdge,
} from "../paths/mapshaper-coordinate-utils";
import { buildTopology } from "../topology/mapshaper-topology";
import { debug, error, stop } from "../utils/mapshaper-logging";

cmd.rotate = rotateDataset;

export function rotateDataset(dataset, opts) {
  if (!isLatLngCRS(getDatasetCRS(dataset))) {
    stop("Command requires a lat-long dataset.");
  }
  if (!Array.isArray(opts.rotation) || !opts.rotation.length) {
    stop("Invalid rotation parameter");
  }
  var rotatePoint = getRotationFunction2(opts.rotation, opts.invert);
  var editor = new DatasetEditor(dataset);
  if (dataset.arcs) {
    dataset.arcs.flatten();
  }

  dataset.layers.forEach(function (lyr) {
    var type = lyr.geometry_type;
    editor.editLayer(lyr, getGeometryRotator(type, rotatePoint, opts));
  });
  editor.done();
  if (!opts.debug) {
    buildTopology(dataset);
    cleanProjectedLayers(dataset);
  }
}

function getGeometryRotator(layerType, rotatePoint, opts) {
  var rings;
  if (layerType === "point") {
    return function (coords) {
      coords.forEach(rotatePoint);
      return coords;
    };
  }
  if (layerType === "polyline") {
    return function (coords) {
      coords = densifyPathByInterval(coords, 0.5);
      coords.forEach(rotatePoint);
      return removePolylineCrosses(coords);
    };
  }
  if (layerType === "polygon") {
    return function (coords, i, shape) {
      if (isWholeWorld(coords)) {
        coords = densifyPathByInterval(coords, 0.5);
      } else {
        coords.forEach(snapToEdge);
        coords = removeCutSegments(coords);
        coords = densifyPathByInterval(coords, 0.5, getInterpolator(0.5));
        coords.forEach(rotatePoint);
      }
      if (i === 0) {
        rings = [];
      }
      if (coords.length < 4) {
        debug("Short ring-3", coords);
        return;
      }
      if (!samePoint(coords[0], lastEl(coords))) {
        error("Open polygon ring-3");
      }
      rings.push(coords);
      if (i === shape.length - 1) {
        return opts.debug ? rings : removePolygonCrosses(rings);
      }
    };
  }
  return null;
}

function getInterpolator(interval) {
  var interpolate = getIntervalInterpolator(interval);
  return function (a, b) {
    var points;
    if (onPole(a) || onPole(b)) {
      points = [];
    } else if (isEdgeSegment(a, b)) {
      points = densifyAntimeridianSegment(a, b, interval);
    } else if (segmentCrossesAntimeridian(a, b)) {
      points = [];
    } else {
      points = interpolate(a, b);
    }
    return points;
  };
}
