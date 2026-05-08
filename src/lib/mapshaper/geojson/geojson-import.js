import { copyRecord } from "../datatable/mapshaper-data-utils";
import GeoJSON from "../geojson/geojson-common";
import { PathImporter } from "../paths/mapshaper-path-import";
import { verbose } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function importGeoJSON(src, optsArg) {
  var opts = optsArg || {};
  var supportedGeometries = Object.keys(GeoJSON.pathImporters),
    srcObj = utils.isString(src) ? JSON.parse(src) : src,
    importer = new GeoJSONParser(opts),
    srcCollection,
    dataset;

  if (srcObj.type === "Feature") {
    srcCollection = {
      type: "FeatureCollection",
      features: [srcObj],
    };
  } else if (supportedGeometries.includes(srcObj.type)) {
    srcCollection = {
      type: "GeometryCollection",
      geometries: [srcObj],
    };
  } else {
    srcCollection = srcObj;
  }
  (srcCollection.features || srcCollection.geometries || []).forEach(
    importer.parseObject,
  );
  dataset = importer.done();
  importCRS(dataset, srcObj);
  return dataset;
}

export function GeoJSONParser(opts) {
  var idField = opts.id_field || GeoJSON.ID_FIELD,
    importer = new PathImporter(opts),
    _dataset;

  this.parseObject = function (o) {
    var geom, rec;
    if (!o?.type) {
      geom = null;
    } else if (o.type === "Feature") {
      geom = o.geometry;
      rec = o.properties || {};
      if ("id" in o) {
        rec[idField] = o.id;
      }
    } else {
      geom = o;
    }

    if (geom && geom.type === "GeometryCollection") {
      GeoJSON.importComplexFeature(importer, geom, rec, opts);
    } else {
      GeoJSON.importSimpleFeature(importer, geom, rec, opts);
    }
  };

  this.done = function () {
    return importer.done();
  };
}

GeoJSON.importComplexFeature = function (importer, geom, rec, opts) {
  var types = divideGeometriesByType(geom.geometries || []);
  if (types.length === 0) {
    importer.startShape(rec);
    return;
  }
  types.forEach(function (geometries, _i) {
    importer.startShape(copyRecord(rec));
    geometries.forEach(function (geom) {
      GeoJSON.importSimpleGeometry(importer, geom, opts);
    });
  });
};

function divideGeometriesByType(geometries, index) {
  index = index || {};
  geometries.forEach(function (geom) {
    if (!geom) return;
    var mtype = GeoJSON.translateGeoJSONType(geom.type);
    if (mtype) {
      if (mtype in index === false) {
        index[mtype] = [];
      }
      index[mtype].push(geom);
    } else if (geom.type === "GeometryCollection") {
      divideGeometriesByType(geom.geometries || [], index);
    }
  });
  return Object.values(index);
}

GeoJSON.importSimpleFeature = function (importer, geom, rec, opts) {
  importer.startShape(rec);
  GeoJSON.importSimpleGeometry(importer, geom, opts);
};

GeoJSON.importSimpleGeometry = function (importer, geom, opts) {
  var type = geom ? geom.type : null;
  if (type === null) {
  } else if (type in GeoJSON.pathImporters) {
    if (
      opts.geometry_type &&
      opts.geometry_type !== GeoJSON.translateGeoJSONType(type)
    ) {
      return;
    }
    GeoJSON.pathImporters[type](geom.coordinates, importer);
  } else {
    verbose("Unsupported geometry type:", geom.type);
  }
};

GeoJSON.pathImporters = {
  LineString: function (coords, importer) {
    importer.importLine(coords);
  },
  MultiLineString: function (coords, importer) {
    for (var i = 0; i < coords.length; i++) {
      GeoJSON.pathImporters.LineString(coords[i], importer);
    }
  },
  Polygon: function (coords, importer) {
    for (var i = 0; i < coords.length; i++) {
      importer.importRing(coords[i], i > 0);
    }
  },
  MultiPolygon: function (coords, importer) {
    for (var i = 0; i < coords.length; i++) {
      GeoJSON.pathImporters.Polygon(coords[i], importer);
    }
  },
  Point: function (coord, importer) {
    importer.importPoints([coord]);
  },
  MultiPoint: function (coords, importer) {
    importer.importPoints(coords);
  },
};

export function importCRS(dataset, jsonObj) {
  if ("crs" in jsonObj) {
    dataset.info.input_geojson_crs = jsonObj.crs;
  }
}
