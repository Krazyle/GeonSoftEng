import { compileValueExpression } from "../expressions/mapshaper-expressions";
import { parsePattern } from "../svg/svg-hatch";
import { stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

var stylePropertyTypes = {
  class: "classname",
  dx: "measure",
  dy: "measure",
  fill: "color",
  "fill-pattern": "pattern",
  "font-family": null,
  "font-size": null,
  "font-style": null,
  "font-weight": null,
  "label-text": null,
  "letter-spacing": "measure",
  "line-height": "measure",
  opacity: "number",
  r: "number",
  stroke: "color",
  "stroke-dasharray": "dasharray",
  "stroke-width": "number",
  "stroke-opacity": "number",
  "fill-opacity": "number",
  "text-anchor": null,
};

var symbolPropertyTypes = utils.extend(
  {
    type: null,
    length: "number",
    rotation: "number",
    radius: "number",
    radii: null,
    flipped: "boolean",
    rotated: "boolean",
    direction: "number",
    "head-angle": "number",
    "head-width": "number",
    "head-length": "number",
    "stem-width": "number",
    "stem-curve": "number",
    "stem-taper": "number",
    "stem-length": "number",
    "min-stem": "number",
    "arrow-scaling": "number",
    effect: null,
  },
  stylePropertyTypes,
);

var commonProperties =
  "class,opacity,stroke,stroke-width,stroke-dasharray,stroke-opacity,fill-opacity".split(
    ",",
  );

var propertiesBySymbolType = {
  polygon: utils.arrayToIndex(commonProperties.concat("fill", "fill-pattern")),
  polyline: utils.arrayToIndex(commonProperties),
  point: utils.arrayToIndex(commonProperties.concat("fill", "r")),
  label: utils.arrayToIndex(
    commonProperties.concat(
      "fill,r,font-family,font-size,text-anchor,font-weight,font-style,letter-spacing,dominant-baseline".split(
        ",",
      ),
    ),
  ),
};

function _isSupportedSvgStyleProperty(name) {
  return name in stylePropertyTypes;
}

function isSupportedSvgSymbolProperty(name) {
  return name in symbolPropertyTypes;
}

export function findPropertiesBySymbolGeom(fields, type) {
  var index = propertiesBySymbolType[type] || {};
  return fields.filter(function (name) {
    return name in index;
  });
}

function _getSymbolDataAccessor(lyr, opts) {
  var functions = {};
  var properties = [];
  var _fields = lyr.data ? lyr.data.getFields() : [];

  Object.keys(opts).forEach(function (optName) {
    var svgName = optName.replace(/_/g, "-");
    if (!isSupportedSvgSymbolProperty(svgName)) {
      return;
    }
    var val = opts[optName];
    functions[svgName] = getSymbolPropertyAccessor(val, svgName, lyr);
    properties.push(svgName);
  });

  return function (id) {
    var d = {},
      name;
    for (var i = 0; i < properties.length; i++) {
      name = properties[i];
      d[name] = functions[name](id);
    }
    return d;
  };
}

function mightBeExpression(str, fields) {
  fields = fields || [];
  if (fields.indexOf(str.trim()) > -1) return true;
  return /[(){}./*?:&|=[+-]/.test(str);
}

function getSymbolPropertyAccessor(val, svgName, lyr) {
  var strVal = String(val).trim();
  var typeHint = symbolPropertyTypes[svgName];
  var fields = lyr.data ? lyr.data.getFields() : [];
  var literalVal = null;
  var accessor;

  if (typeHint && fields.indexOf(strVal) === -1) {
    literalVal = parseSvgLiteralValue(strVal, typeHint);
  }
  if (literalVal === null && mightBeExpression(strVal, fields)) {
    accessor = parseStyleExpression(strVal, lyr);
  }
  if (!accessor && literalVal === null && !typeHint) {
    literalVal = strVal;
  }

  if (accessor) return accessor;
  if (literalVal !== null)
    return function (_id) {
      return literalVal;
    };
  stop("Unexpected value for", `${svgName}:`, strVal);
}

function parseStyleExpression(strVal, lyr) {
  var func;
  try {
    func = compileValueExpression(strVal, lyr, null, { no_warn: true });
    func(0);
  } catch (_e) {
    func = null;
  }
  return func;
}

function parseSvgLiteralValue(strVal, type) {
  var val = null;
  if (type === "number") {
    val = isSvgNumber(strVal) ? Number(strVal) : null;
  } else if (type === "color") {
    val = isSvgColor(strVal) ? strVal : null;
  } else if (type === "classname") {
    val = isSvgClassName(strVal) ? strVal : null;
  } else if (type === "measure") {
    val = isSvgMeasure(strVal) ? parseSvgMeasure(strVal) : null;
  } else if (type === "dasharray") {
    val = isDashArray(strVal) ? strVal : null;
  } else if (type === "pattern") {
    val = isPattern(strVal) ? strVal : null;
  } else if (type === "boolean") {
    val = parseBoolean(strVal);
  }

  return val;
}

function isPattern(str) {
  return !!parsePattern(str);
}

function isDashArray(str) {
  return /^[0-9]+( [0-9]+)*$/.test(str);
}

function isSvgClassName(str) {
  return /^( ?[_a-z][-_a-z0-9]*\b)+$/i.test(str);
}

function isSvgNumber(o) {
  return (
    utils.isFiniteNumber(o) || (utils.isString(o) && /^-?[.0-9]+$/.test(o))
  );
}

function parseBoolean(o) {
  if (o === true || o === "true") return true;
  if (o === false || o === "false") return false;
  return null;
}

function isSvgMeasure(o) {
  return (
    utils.isFiniteNumber(o) ||
    (utils.isString(o) && /^-?[.0-9]+[a-z]*$/.test(o))
  );
}

function parseSvgMeasure(str) {
  return utils.isString(str) && /[a-z]/.test(str) ? str : Number(str);
}

function isSvgColor(str) {
  return (
    /^[a-z]+$/i.test(str) ||
    /^#[0-9a-f]+$/i.test(str) ||
    /^rgba?\([0-9,. ]+\)$/.test(str)
  );
}
