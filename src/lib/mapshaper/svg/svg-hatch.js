import { message } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function parsePattern(str) {
  if (!str) return null;
  var parts = splitPattern(str);
  var first = parts[0] || "";
  var obj = null;

  if (first.startsWith("dot")) {
    parts[0] = "dots";
    obj = parseDots(parts, str);
  } else if (first.startsWith("square")) {
    parts[0] = "squares";
    obj = parseDots(parts, str);
  } else if (first.startsWith("hatch")) {
    parts[0] = "hatches";
    obj = parseHatches(parts, str);
  } else if (first.startsWith("dash")) {
    obj = parseDashes(parts, str);
  } else if (!Number.isNaN(parseFloat(first))) {
    parts.unshift("hatches");
    obj = parseHatches(parts, str);
  }
  if (!obj) {
    message("Invalid pattern, ignoring:", str);
  }
  return obj;
}

function parseDashes(parts, _str) {
  var _type = parts.shift();
  var colors = [];
  var background = parts.pop();
  var spacing = parseInt(parts.pop(), 10);
  var tmp;
  while (parts.length > 0) {
    tmp = parts.pop();
    if (isSize(tmp)) {
      parts.push(tmp);
      break;
    } else {
      colors.push(tmp);
    }
  }
  var width = parseInt(parts.pop(), 10);
  var dashes = [parseInt(parts.pop(), 10), parseInt(parts.pop(), 10)].reverse();
  var rotation = 45;
  if (parts.length > 0) {
    rotation = parseInt(parts.pop(), 10);
  }
  if (parts.length > 0) {
    return null;
  }
  if (width > 0 === false) return null;
  return {
    type: "dashes",
    tileSize: [colors.length * (width + spacing), utils.sum(dashes)],
    colors: colors,
    width: width,
    dashes: dashes,
    spacing: spacing,
    background: background,
    rotation: rotation,
  };
}

function parseHatches(parts, _str) {
  var _type = parts.shift();
  var rot = parts.length % 2 === 1 ? parseInt(parts.shift(), 10) : 45,
    colors = [],
    widths = [],
    _a,
    _b;
  for (var i = 0; i < parts.length; i += 2) {
    widths.push(parseInt(parts[i], 10));
    colors.push(parts[i + 1]);
  }
  if (Math.min.apply(null, widths) > 0 === false) return null;
  return {
    tileSize: [utils.sum(widths), 10],
    type: "hatches",
    colors: colors,
    widths: widths,
    rotation: rot,
  };
}

function isSize(str) {
  return parseInt(str, 10) > 0;
}

function parseDots(parts, _str) {
  var colors = [];
  var type = parts.shift();
  var rot = 0;
  if (isSize(parts[1])) {
    rot = parseInt(parts.shift(), 10);
  }
  var size = parseInt(parts.shift(), 10);
  var bg = parts.pop();
  var spacing = parseInt(parts.pop(), 10);
  while (parts.length > 0) {
    colors.push(parts.shift());
  }
  if (size > 0 === false || spacing >= 0 === false) return null;
  if (colors.length === 0) return null;
  var side = colors.length * (size + spacing);
  return {
    type: type,
    tileSize: [side, side],
    colors: colors,
    size: size,
    spacing: spacing,
    background: bg,
    rotation: rot,
  };
}

function splitPattern(str) {
  var splitRxp = /[, ]+(?![^(]*\))/;
  return String(str).trim().split(splitRxp);
}

function getHashId(str) {
  return `hash_${str}`.replace(/[()# ,_]+/g, "_");
}

function _convertFillPattern(properties, defs) {
  var hatchStr = properties["fill-pattern"];
  var hashId = getHashId(hatchStr);
  var hash = utils.find(defs, function (o) {
    return o.id === hashId;
  });
  delete properties["fill-pattern"];
  if (!hash) {
    hash = makeSVGPatternFill(hatchStr, hashId);
    if (!hash) return;
    defs.push(hash);
  }
  properties.fill = hash.href;
}

function makeSVGPatternFill(str, id) {
  var o = parsePattern(str);
  var svg;
  if (!o) return null;
  if (o.type === "hatches") {
    svg = makeHatchPatternSVG(o);
  } else if (o.type === "dots" || o.type === "squares") {
    svg = makeDotPatternSVG(o);
  } else if (o.type === "dashes") {
    svg = makeDashPatternSVG(o);
  }
  return {
    svg: wrapSVGPattern(o, id, svg),
    id: id,
    href: `url(#${id})`,
  };
}

function wrapSVGPattern(o, id, str) {
  var w = o.tileSize[0];
  var h = o.tileSize[1];
  var svg = `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}" patternTransform="rotate(${o.rotation})">`;
  if (o.background) {
    svg += `<rect x="0" y="0" width="${w}" height="${h}" fill="${o.background}"></rect>`;
  }
  return `${svg + str}</pattern>`;
}

function makeDashPatternSVG(o) {
  var svg = "";
  for (var i = 0, x = 0; i < o.colors.length; i++) {
    svg += `<rect x="${x}" y="0" width="${o.width}" height="${o.dashes[0]}" fill="${o.colors[i]}"></rect>`;
    x += o.width + o.spacing;
  }
  return svg;
}

function makeHatchPatternSVG(o) {
  var h = o.tileSize[1];
  var svg = "";
  for (var i = 0, x = 0; i < o.widths.length; i++) {
    svg += `<rect x="${x}" y="0" width="${o.widths[i]}" height="${h}" fill="${o.colors[i]}"></rect>`;
    x += o.widths[i];
  }
  return svg;
}

function makeDotPatternSVG(o) {
  var dotSize = o.size;
  var colorCount = o.colors.length;
  var dotDist = dotSize + o.spacing;
  var dotsPerTile = colorCount * colorCount;
  var makeSymbol = o.type === "squares" ? makeSquare : makeCircle;
  var svg = "";
  for (var i = 0, x = 0, y = 0; i < dotsPerTile; i++) {
    svg += makeSymbol(
      x,
      y,
      dotSize,
      o.colors[(i + Math.floor(i / colorCount)) % colorCount],
    );
    x = ((i + 1) % colorCount) * dotDist;
    if (x === 0) y += dotDist;
  }
  return svg;
}

function makeCircle(x, y, size, fill) {
  const r = size / 2;
  return `<circle cx="${x + r}" cy="${
    y + r
  }" r="${r}" fill="${fill}"></circle>`;
}

function makeSquare(x, y, size, fill) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill}"></rect>`;
}
