import {
  findFrameLayerInDataset,
  getFrameSize,
} from "../commands/mapshaper-frame";
import {
  getDatasetBounds,
  transformPoints,
} from "../dataset/mapshaper-dataset-utils";
import { getFurnitureLayerData } from "../furniture/mapshaper-furniture";
import { Bounds } from "../geom/mapshaper-bounds";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function transformDatasetToPixels(dataset, opts) {
  var frameLyr = findFrameLayerInDataset(dataset);
  var bounds, bounds2, fwd, frameData;
  if (frameLyr) {
    frameData = getFurnitureLayerData(frameLyr);
    bounds = new Bounds(frameData.bbox);
    bounds2 = new Bounds(0, 0, frameData.width, frameData.height);
  } else {
    bounds = getDatasetBounds(dataset);
    bounds2 = calcOutputSizeInPixels(bounds, opts);
  }
  fwd = bounds.getTransform(bounds2, opts.invert_y);
  transformPoints(dataset, function (x, y) {
    return fwd.transform(x, y);
  });
  return [Math.round(bounds2.width()), Math.round(bounds2.height()) || 1];
}

function parseMarginOption(opt) {
  var str = utils.isNumber(opt) ? String(opt) : opt || "";
  var margins = str.trim().split(/[, ] */);
  if (margins.length === 1) margins.push(margins[0]);
  if (margins.length === 2) margins.push(margins[0], margins[1]);
  if (margins.length === 3) margins.push(margins[2]);
  return margins.map(function (str) {
    var px = parseFloat(str);
    return Number.isNaN(px) ? 1 : px;
  });
}

function calcOutputSizeInPixels(bounds, opts) {
  var padX = 0,
    padY = 0,
    offX = 0,
    offY = 0,
    width = bounds.width(),
    height = bounds.height(),
    margins = parseMarginOption(opts.margin),
    marginX = margins[0] + margins[2],
    marginY = margins[1] + margins[3],
    wx = 0.5,
    wy = 0.5,
    widthPx,
    heightPx,
    size,
    kx,
    ky;

  if (opts.fit_bbox) {
    offX = opts.fit_bbox[0];
    offY = opts.fit_bbox[1];
    widthPx = opts.fit_bbox[2] - offX;
    heightPx = opts.fit_bbox[3] - offY;
    if (width / height > widthPx / heightPx) {
      heightPx = 0;
    } else {
      widthPx = 0;
    }
    marginX = marginY = 0;
  } else if (opts.svg_scale > 0) {
    widthPx = width / opts.svg_scale + marginX;
    heightPx = 0;
  } else if (+opts.pixels) {
    size = getFrameSize(bounds, opts);
    widthPx = size[0];
    heightPx = size[1];
  } else {
    heightPx = opts.height || 0;
    widthPx = opts.width || (heightPx > 0 ? 0 : 800);
  }

  if (heightPx > 0) {
    ky = (height || width || 1) / (heightPx - marginY);
  }
  if (widthPx > 0) {
    kx = (width || height || 1) / (widthPx - marginX);
  }

  if (!widthPx) {
    kx = ky;
    widthPx = width > 0 ? marginX + width / kx : heightPx;
  } else if (!heightPx) {
    ky = kx;
    heightPx = height > 0 ? marginY + height / ky : widthPx;

    if (opts.max_height > 0 && heightPx > opts.max_height) {
      ky = (kx * heightPx) / opts.max_height;
      heightPx = opts.max_height;
    }
  }

  if (kx > ky) {
    ky = kx;
    padY = ky * (heightPx - marginY) - height;
  } else if (ky > kx) {
    kx = ky;
    padX = kx * (widthPx - marginX) - width;
  }

  bounds.padBounds(
    margins[0] * kx + padX * wx,
    margins[1] * ky + padY * wy,
    margins[2] * kx + padX * (1 - wx),
    margins[3] * ky + padY * (1 - wy),
  );

  if (!(widthPx > 0 && heightPx > 0)) {
    error("Missing valid height and width parameters");
  }
  if (!(kx === ky && kx > 0)) {
    error("Missing valid margin parameters");
  }

  return new Bounds(offX, offY, widthPx + offX, heightPx + offY);
}
