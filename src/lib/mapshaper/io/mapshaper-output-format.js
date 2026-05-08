import { datasetHasGeometry } from "../dataset/mapshaper-dataset-utils";
import { couldBeDsvFile } from "../io/mapshaper-file-types";
import { getFileExtension } from "../utils/mapshaper-filename-utils";
export function getOutputFormat(dataset, opts) {
  var outFile = opts.file || null,
    inFmt = dataset.info?.input_formats?.[0],
    outFmt = null;

  if (opts.format) {
    return opts.format;
  }

  if (outFile) {
    outFmt = inferOutputFormat(outFile, inFmt);
  } else if (inFmt) {
    outFmt = inFmt;
  }

  if (outFmt === "json" && datasetHasGeometry(dataset)) {
    outFmt = "geojson";
  }

  return outFmt || null;
}

function inferOutputFormat(file, inputFormat) {
  var ext = getFileExtension(file).toLowerCase(),
    format = null;
  if (ext === "shp") {
    format = "shapefile";
  } else if (ext === "dbf") {
    format = "dbf";
  } else if (ext === "svg") {
    format = "svg";
  } else if (/json$/.test(ext)) {
    format = "geojson";
    if (
      ext === "topojson" ||
      (inputFormat === "topojson" && ext !== "geojson")
    ) {
      format = "topojson";
    } else if (ext === "json" && inputFormat === "json") {
      format = "json";
    }
  } else if (couldBeDsvFile(file)) {
    format = "dsv";
  } else if (inputFormat) {
    format = inputFormat;
  }
  return format;
}
