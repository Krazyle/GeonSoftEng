import GeoJSON from "../geojson/geojson-common";
import { getTransform, symbolRenderers } from "../svg/svg-common";
import { stringifyLineStringCoords } from "../svg/svg-path-utils";
import { findPropertiesBySymbolGeom } from "../svg/svg-properties";
import { stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

function _importGeoJSONFeatures(features, opts) {
  opts = opts || {};
  return features.map(function (obj, _i) {
    var geom = obj.type === "Feature" ? obj.geometry : obj;
    var geomType = geom?.type;
    var svgObj = null;
    if (geomType && geom.coordinates) {
      svgObj = geojsonImporters[geomType](
        geom.coordinates,
        obj.properties,
        opts,
      );
    }
    if (!svgObj) {
      return { tag: "g" };
    }

    if (obj.properties) {
      applyStyleAttributes(svgObj, geomType, obj.properties);
    }
    if ("id" in obj) {
      if (!svgObj.properties) {
        svgObj.properties = {};
      }
      svgObj.properties.id = (opts.id_prefix || "") + obj.id;
    }
    return svgObj;
  });
}

function applyStyleAttributes(svgObj, geomType, rec) {
  var symbolType = GeoJSON.translateGeoJSONType(geomType);
  if (symbolType === "point" && "label-text" in rec) {
    symbolType = "label";
  }
  var fields = findPropertiesBySymbolGeom(Object.keys(rec), symbolType);
  for (var i = 0, n = fields.length; i < n; i++) {
    setAttribute(svgObj, fields[i], rec[fields[i]]);
  }
}

function setAttribute(obj, k, v) {
  if (k === "r") {
  } else {
    if (!obj.properties) obj.properties = {};
    obj.properties[k] = v;
    if (k === "stroke-dasharray" && v) {
      obj.properties["stroke-linecap"] = "butt";
    }
  }
}

function importMultiPoint(coords, rec, layerOpts) {
  var children = [],
    p;
  for (var i = 0; i < coords.length; i++) {
    p = importPoint(coords[i], rec, layerOpts);
    if (p.tag === "g" && p.children) {
      children = children.concat(p.children);
    } else {
      children.push(p);
    }
  }
  return children.length > 0 ? { tag: "g", children: children } : null;
}

function importMultiPath(coords, importer) {
  var o;
  for (var i = 0; i < coords.length; i++) {
    if (i === 0) {
      o = importer(coords[i]);
    } else {
      o.properties.d += ` ${importer(coords[i]).properties.d}`;
    }
  }
  return o;
}

function importLineString(coords) {
  var d = stringifyLineStringCoords(coords);
  return {
    tag: "path",
    properties: { d: d },
  };
}

function _importMultiLineString(coords) {
  var d = coords.map(stringifyLineStringCoords).join(" ");
  return {
    tag: "path",
    properties: { d: d },
  };
}

function _importStyledLabel(rec, p) {
  var o = importLabel(rec, p);
  applyStyleAttributes(o, "Point", rec);
  return o;
}

function toLabelString(val) {
  if (val || val === 0 || val === false) return String(val);
  return "";
}

function importLabel(rec, p) {
  var line = toLabelString(rec["label-text"]);
  var morelines, obj;

  var newline = /\n|\\n|<br>/i;
  var dx = rec.dx || 0;
  var dy = rec.dy || 0;
  var properties = {
    y: dy,
    x: dx,
  };
  if (p) {
    properties.transform = getTransform(p);
  }
  if (newline.test(line)) {
    morelines = line.split(newline);
    line = morelines.shift();
  }
  obj = {
    tag: "text",
    value: line,
    properties: properties,
  };
  if (morelines) {
    obj.children = [];
    morelines.forEach(function (line) {
      var tspan = {
        tag: "tspan",
        value: line,
        properties: {
          x: dx,
          dy: rec["line-height"] || "1.1em",
        },
      };
      obj.children.push(tspan);
    });
  }
  return obj;
}

function getEmptySymbol() {
  return { tag: "g", properties: {}, children: [] };
}

function renderSymbol(d, x, y) {
  var renderer = symbolRenderers[d.type];
  if (!renderer) {
    stop(
      d.type
        ? `Unknown symbol type: ${d.type}`
        : "Symbol is missing a type property",
    );
  }
  return renderer(d, x || 0, y || 0);
}

function importSymbol(d, xy) {
  var _renderer;
  if (!d) {
    return getEmptySymbol();
  }
  if (utils.isString(d)) {
    d = JSON.parse(d);
  }
  return {
    tag: "g",
    properties: {
      class: "mapshaper-svg-symbol",
      transform: xy ? getTransform(xy) : null,
    },
    children: renderSymbol(d),
  };
}

function importPoint(coords, rec, layerOpts) {
  rec = rec || {};
  if ("svg-symbol" in rec) {
    return importSymbol(rec["svg-symbol"], coords);
  }
  return importStandardPoint(coords, rec, layerOpts || {});
}

export function importPolygon(coords) {
  var d, o;
  for (var i = 0; i < coords.length; i++) {
    d = o ? `${o.properties.d} ` : "";
    o = importLineString(coords[i]);
    o.properties.d = `${d + o.properties.d} Z`;
  }
  if (coords.length > 1) {
    o.properties["fill-rule"] = "evenodd";
  }
  return o;
}

function importStandardPoint(coords, rec, layerOpts) {
  var isLabel = "label-text" in rec;
  var symbolType = layerOpts.point_symbol || "";
  var children = [];
  var halfSize = rec.r || 0;
  var p;

  if (halfSize > 0 || !isLabel) {
    if (symbolType === "square") {
      p = {
        tag: "rect",
        properties: {
          x: coords[0] - halfSize,
          y: coords[1] - halfSize,
          width: halfSize * 2,
          height: halfSize * 2,
        },
      };
    } else {
      p = {
        tag: "circle",
        properties: {
          cx: coords[0],
          cy: coords[1],
        },
      };
      if (halfSize > 0) {
        p.properties.r = halfSize;
      }
    }
    children.push(p);
  }
  if (isLabel) {
    children.push(importLabel(rec, coords));
  }
  return children.length > 1 ? { tag: "g", children: children } : children[0];
}

var geojsonImporters = {
  Point: importPoint,
  Polygon: importPolygon,
  LineString: importLineString,
  MultiPoint: function (coords, rec, opts) {
    return importMultiPoint(coords, rec, opts);
  },
  MultiLineString: function (coords) {
    return importMultiPath(coords, importLineString);
  },
  MultiPolygon: function (coords) {
    return importMultiPath(coords, importPolygon);
  },
};
