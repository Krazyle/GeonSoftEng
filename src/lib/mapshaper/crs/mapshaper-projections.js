import mproj from "mproj";
import {
  AlbersUSA,
  parseCustomProjection,
} from "../crs/mapshaper-custom-projections";
import { getDatasetBounds } from "../dataset/mapshaper-dataset-utils";
import geom from "../geom/mapshaper-geom";
import { probablyDecimalDegreeBounds } from "../geom/mapshaper-latlon";
import { getStateVar } from "../mapshaper-state";
import { print, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

var asyncLoader = null;

var projectionAliases = {
  robinson: "+proj=robin +datum=WGS84",
  webmercator: "+proj=merc +a=6378137 +b=6378137",
  wgs84: "+proj=longlat +datum=WGS84",
  albersusa: new AlbersUSA(),
};

function _initProjLibrary(opts, done) {
  if (!asyncLoader) return done();
  asyncLoader(opts, done);
}

function _setProjectionLoader(loader) {
  asyncLoader = loader;
}

function _findProjLibs(str) {
  var matches = str.match(/\b(esri|epsg|nad83|nad27)(?=:[0-9]+\b)/gi) || [];
  return utils.uniq(
    matches.map(function (str) {
      return str.toLowerCase();
    }),
  );
}

function _getProjTransform(src, dest) {
  var clampSrc = isLatLngCRS(src);
  dest = dest.__mixed_crs || dest;
  return function (x, y) {
    var xy;
    if (clampSrc) {
      if (x < -180) x = -180;
      else if (x > 180) x = 180;
    }
    xy = [x, y];
    mproj.pj_transform_point(src, dest, xy);
    return xy;
  };
}

export function getProjTransform2(src, dest) {
  var xx = [0],
    yy = [0],
    preK = src.is_latlong ? mproj.internal.DEG_TO_RAD : 1,
    postK = dest.is_latlong ? mproj.internal.RAD_TO_DEG : 1,
    clampSrc = isLatLngCRS(src);

  return function (x, y) {
    var fail;
    if (clampSrc) {
      if (x < -180) x = -180;
      else if (x > 180) x = 180;
    }
    xx[0] = x * preK;
    yy[0] = y * preK;
    try {
      dest = dest.__mixed_crs || dest;
      mproj.pj_transform(src, dest, xx, yy);
      fail = xx[0] === Infinity;
    } catch (_e) {
      fail = true;
    }
    return fail ? null : [xx[0] * postK, yy[0] * postK];
  };
}

function _toLngLat(xy, P) {
  var proj;
  if (isLatLngCRS(P)) {
    return xy.concat();
  }
  proj = getProjInfo(P, getCRS("wgs84"));
  return proj(xy);
}

function getProjInfo(dataset) {
  var P, info;
  try {
    P = getDatasetCRS(dataset);
    if (P) {
      info = crsToProj4(P);
    }
  } catch (_e) {}
  return info || "[unknown]";
}

export function crsToProj4(P) {
  return mproj.internal.get_proj_defn(P);
}

export function crsToPrj(P) {
  var wkt;
  try {
    wkt = mproj.internal.wkt_from_proj4(P);
  } catch (_e) {}
  return wkt;
}

export function crsAreEqual(a, b) {
  var str = crsToProj4(a);
  return !!str && str === crsToProj4(b);
}

function getProjDefn(str) {
  var defn;

  str = str.replace(/(^| )([\w]+)($| )/, function (a, b, c, d) {
    if (c in mproj.internal.pj_list) {
      return `${b}+proj=${c}${d}`;
    }
    return a;
  });
  if (looksLikeProj4String(str)) {
    defn = str;
  } else if (str in projectionAliases) {
    defn = projectionAliases[str];
  } else if (looksLikeInitString(str)) {
    defn = `+init=${str.toLowerCase()}`;
  } else if (str in getStateVar("defs")) {
    defn = getStateVar("defs")[str];
  } else {
    defn = parseCustomProjection(str);
  }
  if (!defn) {
    stop("Unknown projection definition:", str);
  }
  return defn;
}

function looksLikeInitString(str) {
  return /^(esri|epsg|nad83|nad27):[0-9]+$/i.test(String(str));
}

function looksLikeProj4String(str) {
  return /^(\+[^ ]+ *)+$/.test(str);
}

export function getCRS(str) {
  var defn = getProjDefn(str);
  var P;
  if (!utils.isString(defn)) {
    P = defn;
  } else {
    try {
      P = mproj.pj_init(defn);
    } catch (e) {
      stop("Unable to use projection", defn, `(${e.message})`);
    }
  }
  return P || null;
}

function _requireProjectedDataset(dataset) {
  if (isLatLngCRS(getDatasetCRS(dataset))) {
    stop("Command requires a target with projected coordinates (not lat-long)");
  }
}

export function setDatasetCRS(dataset, info) {
  dataset.info = dataset.info || {};

  dataset.info.crs = info.crs;
  dataset.info.prj = info.prj;
}

export function getDatasetCRS(dataset) {
  var info = dataset.info || {},
    P = info.crs;
  if (!P && info.prj) {
    P = parsePrj(info.prj);
  }
  if (!P && probablyDecimalDegreeBounds(getDatasetBounds(dataset))) {
    P = getCRS("wgs84");
  }
  return P;
}

export function requireDatasetsHaveCompatibleCRS(arr) {
  arr.reduce(function (memo, dataset) {
    var P = getDatasetCRS(dataset);
    if (memo && P) {
      if (isLatLngCRS(memo) !== isLatLngCRS(P)) {
        stop("Unable to combine projected and unprojected datasets");
      }
    }
    return P || memo;
  }, null);
}

export function getScaleFactorAtXY(x, y, crs) {
  var proj = mproj;
  var dist = 1;
  var lp = proj.pj_inv_deg({ x: x, y: y }, crs);
  var lp2 = proj.pj_inv_deg({ x: x + dist, y: y }, crs);
  var k = dist / geom.greatCircleDistance(lp.lam, lp.phi, lp2.lam, lp2.phi);
  return k;
}

function _isProjectedCRS(P) {
  return !isLatLngCRS(P);
}

export function isLatLngCRS(P) {
  return P?.is_latlong || false;
}

function _isLatLngDataset(dataset) {
  return isLatLngCRS(getDatasetCRS(dataset));
}

function _printProjections() {
  var index = mproj.internal.pj_list;
  var msg = "Proj4 projections\n";
  Object.keys(index)
    .sort()
    .forEach(function (id) {
      msg += `  ${utils.rpad(id, 7, " ")}  ${index[id].name}\n`;
    });
  msg += "\nAliases";
  Object.keys(projectionAliases)
    .sort()
    .forEach(function (n) {
      msg += `\n  ${n}`;
    });
  print(msg);
}

function translatePrj(str) {
  var proj4;
  try {
    proj4 = mproj.internal.wkt_to_proj4(str);
  } catch (e) {
    stop(`Unusable .prj file (${e.message})`);
  }
  return proj4;
}

export function parsePrj(str) {
  return getCRS(translatePrj(str));
}
