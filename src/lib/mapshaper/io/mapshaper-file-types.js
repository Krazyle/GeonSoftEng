import { getFileExtension } from "../utils/mapshaper-filename-utils";
import utils from "../utils/mapshaper-utils";

export function guessInputFileType(file) {
  var ext = getFileExtension(file || "").toLowerCase(),
    type = null;
  if (ext === "dbf" || ext === "shp" || ext === "prj" || ext === "shx") {
    type = ext;
  } else if (/json$/.test(ext)) {
    type = "json";
  } else if (ext === "csv" || ext === "tsv" || ext === "txt" || ext === "tab") {
    type = "text";
  }
  return type;
}

export function guessInputContentType(content) {
  var type = null;
  if (utils.isString(content)) {
    type = stringLooksLikeJSON(content) ? "json" : "text";
  } else if (
    (utils.isObject(content) && content.type) ||
    utils.isArray(content)
  ) {
    type = "json";
  }
  return type;
}

export function guessInputType(file, content) {
  return guessInputFileType(file) || guessInputContentType(content);
}

function stringLooksLikeJSON(str) {
  return /^\s*[{[]/.test(String(str));
}

export function couldBeDsvFile(name) {
  var ext = getFileExtension(name).toLowerCase();
  return /csv|tsv|txt$/.test(ext);
}

function _isZipFile(file) {
  return /\.zip$/i.test(file);
}

function _isSupportedOutputFormat(fmt) {
  var types = ["geojson", "topojson", "json", "dsv", "dbf", "shapefile", "svg"];
  return types.indexOf(fmt) > -1;
}

function _getFormatName(fmt) {
  return (
    {
      geojson: "GeoJSON",
      topojson: "TopoJSON",
      json: "JSON records",
      dsv: "CSV",
      dbf: "DBF",
      shapefile: "Shapefile",
      svg: "SVG",
    }[fmt] || ""
  );
}

export function isSupportedBinaryInputType(path) {
  var ext = getFileExtension(path).toLowerCase();
  return ext === "shp" || ext === "shx" || ext === "dbf";
}

function _filenameIsUnsupportedOutputType(file) {
  var rxp = /\.(shx|prj|xls|xlsx|gdb|sbn|sbx|xml|kml)$/i;
  return rxp.test(file);
}
