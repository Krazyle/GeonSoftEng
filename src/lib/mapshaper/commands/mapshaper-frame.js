import {
  getDatasetCRS,
  getScaleFactorAtXY,
} from "../crs/mapshaper-projections";
import { getDatasetBounds } from "../dataset/mapshaper-dataset-utils";
import { DataTable } from "../datatable/mapshaper-data-table";
import {
  furnitureRenderers,
  getFurnitureLayerData,
  getFurnitureLayerType,
} from "../furniture/mapshaper-furniture";
import { Bounds } from "../geom/mapshaper-bounds";
import { probablyDecimalDegreeBounds } from "../geom/mapshaper-latlon";
import cmd from "../mapshaper-cmd";
import { importPolygon } from "../svg/geojson-to-svg";
import { message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

cmd.frame = function (catalog, source, opts) {
  var size, bounds, tmp, dataset;
  if (+opts.width > 0 === false && +opts.pixels > 0 === false) {
    stop("Missing a width or area");
  }
  if (opts.width && opts.height) {
    opts = utils.extend({}, opts);

    opts.aspect_ratio = getAspectRatioArg(opts.width, opts.height);
  }
  tmp = cmd.rectangle(source, opts);
  bounds = getDatasetBounds(tmp);
  if (probablyDecimalDegreeBounds(bounds)) {
    stop("Frames require projected, not geographical coordinates");
  } else if (!getDatasetCRS(tmp)) {
    message(
      "Warning: missing projection data. Assuming coordinates are meters and k (scale factor) is 1",
    );
  }
  size = getFrameSize(bounds, opts);
  if (size[0] > 0 === false) {
    stop("Missing a valid frame width");
  }
  if (size[1] > 0 === false) {
    stop("Missing a valid frame height");
  }
  dataset = {
    info: {},
    layers: [
      {
        name: opts.name || "frame",
        data: new DataTable([
          {
            width: size[0],
            height: size[1],
            bbox: bounds.toArray(),
            type: "frame",
          },
        ]),
      },
    ],
  };
  catalog.addDataset(dataset);
};

function getAspectRatioArg(widthArg, heightArg) {
  return heightArg
    .split(",")
    .map(function (opt) {
      var height = Number(opt),
        width = Number(widthArg);
      if (!opt) return "";
      return width / height;
    })
    .reverse()
    .join(",");
}

export function getFrameSize(bounds, opts) {
  var aspectRatio = bounds.width() / bounds.height();
  var height, width;
  if (opts.pixels) {
    width = Math.sqrt(+opts.pixels * aspectRatio);
  } else {
    width = +opts.width;
  }
  height = width / aspectRatio;
  return [Math.round(width), Math.round(height)];
}

function _getDatasetDisplayBounds(dataset) {
  var frameLyr = findFrameLayerInDataset(dataset);
  if (frameLyr) {
    return getFrameLayerBounds(frameLyr);
  }
  return getDatasetBounds(dataset);
}

function isFrameLayer(lyr) {
  return getFurnitureLayerType(lyr) === "frame";
}

export function findFrameLayerInDataset(dataset) {
  return utils.find(dataset.layers, function (lyr) {
    return isFrameLayer(lyr);
  });
}

function _findFrameDataset(catalog) {
  var target = utils.find(catalog.getLayers(), function (o) {
    return isFrameLayer(o.layer);
  });
  return target ? target.dataset : null;
}

function _findFrameLayer(catalog) {
  var target = utils.find(catalog.getLayers(), function (o) {
    return isFrameLayer(o.layer);
  });
  return target?.layer || null;
}

function getFrameLayerBounds(lyr) {
  return new Bounds(getFurnitureLayerData(lyr).bbox);
}

function _getMapFrameMetersPerPixel(data) {
  var bounds = new Bounds(data.bbox);
  var k, toMeters, metersPerPixel;
  if (data.crs) {
    k = getScaleFactorAtXY(bounds.centerX(), bounds.centerY(), data.crs);
    toMeters = data.crs.to_meter;
  } else {
    k = 1;
    toMeters = 1;
  }
  metersPerPixel = ((bounds.width() / k) * toMeters) / data.width;
  return metersPerPixel;
}

furnitureRenderers.frame = function (d) {
  var lineWidth = 1,
    off = lineWidth / 2,
    obj = importPolygon([
      [
        [off, off],
        [off, d.height - off],
        [d.width - off, d.height - off],
        [d.width - off, off],
        [off, off],
      ],
    ]);
  utils.extend(obj.properties, {
    fill: "none",
    stroke: d.stroke || "black",
    "stroke-width": d["stroke-width"] || lineWidth,
  });
  return [obj];
};
