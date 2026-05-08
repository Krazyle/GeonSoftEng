import { transformPoints } from "../dataset/mapshaper-dataset-utils";
import { forEachPoint } from "../points/mapshaper-point-utils";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function roundToSignificantDigits(n, d) {
  return +n.toPrecision(d);
}

function _roundToDigits(n, d) {
  return +n.toFixed(d);
}

export function roundToTenths(n) {
  return Math.round(n * 10) / 10;
}

export function getRoundingFunction(inc) {
  if (!utils.isNumber(inc) || inc === 0) {
    error("Rounding increment must be a non-zero number.");
  }
  var inv = 1 / inc;
  if (inv > 1) inv = Math.round(inv);
  return function (x) {
    return Math.round(x * inv) / inv;
  };
}

export function getBoundsPrecisionForDisplay(bbox) {
  var w = bbox[2] - bbox[0],
    h = bbox[3] - bbox[1],
    range = Math.min(w, h) + 1e-8,
    digits = 0;
  while (range < 2000) {
    range *= 10;
    digits++;
  }
  return digits;
}

function getRoundedCoordString(coords, decimals) {
  return coords
    .map(function (n) {
      return n.toFixed(decimals);
    })
    .join(",");
}

function _getRoundedCoords(coords, decimals) {
  return getRoundedCoordString(coords, decimals).split(",").map(parseFloat);
}

function _roundPoints(lyr, round) {
  forEachPoint(lyr.shapes, function (p) {
    p[0] = round(p[0]);
    p[1] = round(p[1]);
  });
}

export function setCoordinatePrecision(dataset, precision) {
  var round = getRoundingFunction(precision);

  transformPoints(dataset, function (x, y) {
    return [round(x), round(y)];
  });

  return dataset;
}
