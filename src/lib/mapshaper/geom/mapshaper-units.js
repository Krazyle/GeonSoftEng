import { error, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

var UNITS_LOOKUP = {
  m: "meters",
  meter: "meters",
  meters: "meters",
  mi: "miles",
  mile: "miles",
  miles: "miles",
  km: "kilometers",
  ft: "feet",
  feet: "feet",
};

var TO_METERS = {
  meters: 1,
  kilometers: 1000,
  feet: 0.3048,
  miles: 1609.344,
};

function getIntervalConversionFactor(paramUnits, crs) {
  var fromParam = 0,
    fromCRS = 0,
    k;

  if (crs) {
    if (crs.is_latlong) {
      fromCRS = 1;
    } else if (crs.to_meter > 0) {
      fromCRS = crs.to_meter;
    } else {
      error("Invalid CRS");
    }
  }
  if (paramUnits) {
    fromParam = TO_METERS[paramUnits];
    if (!fromParam) error("Unknown units:", paramUnits);
  }

  if (fromParam && fromCRS) {
    k = fromParam / fromCRS;
  } else if (!fromParam && !fromCRS) {
    k = 1;
  } else if (fromParam && !fromCRS) {
    stop("Unable to convert", paramUnits, "to unknown coordinates");
  } else if (!fromParam && fromCRS) {
    k = 1 / fromCRS;
  }
  return k;
}

function parseMeasure(m) {
  var o = parseMeasure2(m);
  if (Number.isNaN(o.value)) {
    stop("Invalid parameter:", m);
  }
  return o;
}

export function parseMeasure2(m) {
  var s = utils.isString(m) ? m : "";
  var match = /(sq|)([a-z]+)(2|)$/i.exec(s);
  var o = {};
  if (utils.isNumber(m)) {
    o.value = m;
  } else if (s === "") {
    o.value = NaN;
  } else if (match) {
    o.units = UNITS_LOOKUP[match[2].toLowerCase()];
    o.areal = !!(match[1] || match[3]);
    o.value = Number(s.substring(0, s.length - match[0].length));
    if (!o.units && !Number.isNaN(o.value)) {
      stop(`Unknown units: ${match[0]}`);
    }
  } else {
    o.value = Number(s);
  }
  return o;
}

export function convertAreaParam(opt, crs) {
  var o = parseMeasure(opt);
  var k = getIntervalConversionFactor(o.units, crs);
  return o.value * k * k;
}

export function convertDistanceParam(opt, crs) {
  var o = parseMeasure(opt);
  var k = getIntervalConversionFactor(o.units, crs);
  if (o.areal) {
    stop("Expected a distance, received an area:", opt);
  }
  return o.value * k;
}

export function convertIntervalParam(opt, crs) {
  var o = parseMeasure(opt);
  var k = getIntervalConversionFactor(o.units, crs);
  if (o.units && crs?.is_latlong) {
    stop("Parameter does not support distance units with latlong datasets");
  }
  if (o.areal) {
    stop("Expected a distance, received an area:", opt);
  }
  return o.value * k;
}

export function convertIntervalPair(opt, crs) {
  var a, b;
  if (!Array.isArray(opt) || opt.length !== 2) {
    stop("Expected two distance parameters, received", opt);
  }
  a = parseMeasure(opt[0]);
  b = parseMeasure(opt[1]);
  if ((a.units && !b.units) || (b.units && !a.units)) {
    stop("Both parameters should have units:", opt);
  }
  return [convertIntervalParam(opt[0], crs), convertIntervalParam(opt[1], crs)];
}

export function convertFourSides(opt, crs, bounds) {
  var arr = opt.split(",");
  if (arr.length === 1) {
    arr = [arr[0], arr[0], arr[0], arr[0]];
  } else if (arr.length !== 4) {
    stop("Expected a distance parameter or a list of four params");
  }
  return arr.map(function (param, i) {
    var tmp;
    if (param.indexOf("%") > 0) {
      tmp = parseFloat(param) / 100 || 0;
      return tmp * (i === 1 || i === 3 ? bounds.height() : bounds.width());
    }
    return convertIntervalParam(opt, crs);
  });
}

export function getAreaLabel(area, crs) {
  var sqm = crs?.to_meter ? area * crs.to_meter * crs.to_meter : area;
  var sqkm = sqm / 1e6;
  return sqkm < 0.01 ? `${Math.round(sqm)} sqm` : `${sqkm} sqkm`;
}
