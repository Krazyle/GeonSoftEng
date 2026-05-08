import { guessInputType } from "../io/mapshaper-file-types";
import { importJSON } from "../io/mapshaper-json-import";
import { cleanPathsAfterImport } from "../paths/mapshaper-path-import";
import { importDbfTable } from "../shapefile/dbf-import";
import { importShp } from "../shapefile/shp-import";
import { importDelim2 } from "../text/mapshaper-delim-import";
import { buildTopology } from "../topology/mapshaper-topology";
import { parseLocalPath } from "../utils/mapshaper-filename-utils";
import { message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function importContent(obj, opts) {
  var dataset, _content, fileFmt, data;
  opts = opts || {};
  if (obj.json) {
    data = importJSON(obj.json, opts);
    fileFmt = data.format;
    dataset = data.dataset;
    cleanPathsAfterImport(dataset, opts);
  } else if (obj.text) {
    fileFmt = "dsv";
    data = obj.text;
    dataset = importDelim2(data, opts);
  } else if (obj.shp) {
    fileFmt = "shapefile";
    data = obj.shp;
    dataset = importShapefile(obj, opts);
    cleanPathsAfterImport(dataset, opts);
  } else if (obj.dbf) {
    fileFmt = "dbf";
    data = obj.dbf;
    dataset = importDbf(obj, opts);
  } else if (obj.prj) {
    fileFmt = "prj";
    data = obj.prj;
    dataset = { layers: [], info: { prj: data.content } };
  }

  if (!dataset) {
    stop("Missing an expected input type");
  }

  if (dataset.arcs && !opts.no_topology && fileFmt !== "topojson") {
    buildTopology(dataset);
  }

  if (fileFmt !== "topojson") {
    dataset.layers.forEach(function (lyr) {
      if (!lyr.name) {
        lyr.name = filenameToLayerName(data.filename || "");
      }
    });
  }

  if (data.filename) {
    dataset.info.input_files = [data.filename];
  }
  dataset.info.input_formats = [fileFmt];
  return dataset;
}

function _importFileContent(content, filename, opts) {
  var type = guessInputType(filename, content),
    input = {};
  input[type] = { filename: filename, content: content };
  return importContent(input, opts);
}

function importShapefile(obj, opts) {
  var shpSrc = obj.shp.content || obj.shp.filename,
    shxSrc = obj.shx ? obj.shx.content || obj.shx.filename : null,
    dataset = importShp(shpSrc, shxSrc, opts),
    lyr = dataset.layers[0],
    dbf;
  if (obj.dbf) {
    dbf = importDbf(obj, opts);
    utils.extend(dataset.info, dbf.info);
    lyr.data = dbf.layers[0].data;
    if (lyr.shapes && lyr.data.size() !== lyr.shapes.length) {
      message("Mismatched .dbf and .shp record count -- possible data loss.");
    }
  }
  if (obj.prj) {
    dataset.info.prj = obj.prj.content;
  }
  return dataset;
}

function importDbf(input, opts) {
  var table;
  opts = utils.extend({}, opts);
  if (input.cpg && !opts.encoding) {
    opts.encoding = input.cpg.content;
  }
  table = importDbfTable(input.dbf.content, opts);
  return {
    info: {},
    layers: [{ data: table }],
  };
}

function filenameToLayerName(path) {
  var name = "layer1";
  var obj = parseLocalPath(path);
  if (obj.basename && obj.extension) {
    name = obj.basename;
  }
  return name;
}
