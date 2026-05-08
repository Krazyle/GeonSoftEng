import { PathImporter } from "../paths/mapshaper-path-import";
import {
  isSupportedShapefileType,
  translateShapefileType,
} from "../shapefile/shp-common";
import { ShpReader } from "../shapefile/shp-reader";
import ShpType from "../shapefile/shp-type";
import { message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function importShp(shp, shx, opts) {
  var reader = new ShpReader(shp, shx),
    shpType = reader.type(),
    type = translateShapefileType(shpType),
    importOpts = utils.defaults(
      {
        type: type,
        reserved_points: Math.round(reader.header().byteLength / 16),
      },
      opts,
    ),
    importer = new PathImporter(importOpts);

  if (!isSupportedShapefileType(shpType)) {
    stop("Unsupported Shapefile type:", shpType);
  }
  if (ShpType.isZType(shpType)) {
    message("Warning: Shapefile Z data will be lost.");
  } else if (ShpType.isMType(shpType)) {
    message("Warning: Shapefile M data will be lost.");
  }

  reader.forEachShape(function (shp) {
    importer.startShape();
    if (shp.isNull) {
    } else if (type === "point") {
      importer.importPoints(shp.readPoints());
    } else {
      shp.stream(importer);
    }
  });

  return importer.done();
}
