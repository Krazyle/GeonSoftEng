import { cleanLayers } from "../commands/mapshaper-clean";
import { projectAndDensifyArcs } from "../crs/mapshaper-densify";
import { expandProjDefn } from "../crs/mapshaper-projection-params";
import {
  crsAreEqual,
  getCRS,
  getDatasetCRS,
  getProjTransform2,
  parsePrj,
  setDatasetCRS,
} from "../crs/mapshaper-projections";
import { preProjectionClip } from "../crs/mapshaper-spherical-clipping";
import { datasetHasGeometry } from "../dataset/mapshaper-dataset-utils";
import {
  copyLayerShapes,
  layerHasPoints,
} from "../dataset/mapshaper-layer-utils";
import { importFile } from "../io/mapshaper-file-import";
import cmd from "../mapshaper-cmd";
import { runningInBrowser } from "../mapshaper-state";
import { dissolveArcs } from "../paths/mapshaper-arc-dissolve";
import { editArcs } from "../paths/mapshaper-arc-editor";
import { editShapes } from "../paths/mapshaper-shape-utils";
import { message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

cmd.proj = function (dataset, catalog, opts) {
  var srcInfo, destInfo, destStr;
  if (opts.init) {
    srcInfo = getCrsInfo(opts.init, catalog);
    if (!srcInfo.crs) stop("Unknown projection source:", opts.init);
    setDatasetCRS(dataset, srcInfo);
  }
  if (opts.match) {
    destInfo = getCrsInfo(opts.match, catalog);
  } else if (opts.crs) {
    destStr = expandProjDefn(opts.crs, dataset);
    destInfo = getCrsInfo(destStr);
  }
  if (destInfo) {
    projCmd(dataset, destInfo, opts);
  }
};

function projCmd(dataset, destInfo, opts) {
  var modifyCopy = runningInBrowser(),
    originals = [],
    target = { info: dataset.info || {} },
    src,
    dest;

  dest = destInfo.crs;
  if (!dest) {
    stop("Missing projection data");
  }

  if (!datasetHasGeometry(dataset)) {
    dataset.info.crs = dest;
    dataset.info.prj = destInfo.prj;
    return;
  }

  src = getDatasetCRS(dataset);
  if (!src) {
    stop("Unable to project -- source coordinate system is unknown");
  }

  if (crsAreEqual(src, dest)) {
    message("Source and destination CRS are the same");
    return;
  }

  if (dataset.arcs) {
    dataset.arcs.flatten();
    target.arcs = modifyCopy ? dataset.arcs.getCopy() : dataset.arcs;
  }

  target.layers = dataset.layers.map(function (lyr) {
    if (modifyCopy) {
      originals.push(lyr);
      lyr = copyLayerShapes(lyr);
    }
    return lyr;
  });

  projectDataset(target, src, dest, opts || {});

  dataset.info.prj = destInfo.prj;
  dataset.arcs = target.arcs;
  originals.forEach(function (lyr, i) {
    utils.extend(lyr, target.layers[i]);
  });
}

function getCrsInfo(name, catalog) {
  var dataset,
    source,
    info = {};
  if (/\.prj$/i.test(name)) {
    dataset = importFile(name, {});
    if (dataset) {
      info.prj = dataset.info.prj;
      info.crs = parsePrj(info.prj);
    }
    return info;
  }
  if (catalog && (source = catalog.findSingleLayer(name))) {
    dataset = source.dataset;
    info.crs = getDatasetCRS(dataset);
    info.prj = dataset.info.prj;

    return info;
  }

  info.crs = getCRS(name);
  return info;
}

export function projectDataset(dataset, src, dest, opts) {
  var proj = getProjTransform2(src, dest);
  var badArcs = 0;
  var badPoints = 0;
  var clipped = preProjectionClip(dataset, src, dest, opts);

  dataset.layers.forEach(function (lyr) {
    if (layerHasPoints(lyr)) {
      badPoints += projectPointLayer(lyr, proj);
    }
  });
  if (dataset.arcs) {
    if (opts.densify) {
      badArcs = projectAndDensifyArcs(dataset.arcs, proj);
    } else {
      badArcs = projectArcs2(dataset.arcs, proj);
    }
  }

  if (clipped) {
    cleanProjectedLayers(dataset);
  }

  if (badArcs > 0 && !opts.quiet) {
    message(
      `Removed ${badArcs} ${
        badArcs === 1 ? "path" : "paths"
      } containing unprojectable vertices.`,
    );
  }
  if (badPoints > 0 && !opts.quiet) {
    message(
      `Removed ${badPoints} unprojectable ${
        badPoints === 1 ? "point" : "points"
      }.`,
    );
  }
  dataset.info.crs = dest;
}

export function cleanProjectedLayers(dataset) {
  var polygonLayers = dataset.layers.filter(
    (lyr) => lyr.geometry_type === "polygon",
  );

  var cleanOpts = {
    allow_overlaps: true,
    rebuild_topology: true,
    no_arc_dissolve: true,
    quiet: true,
    verbose: false,
  };
  cleanLayers(polygonLayers, dataset, cleanOpts);

  dissolveArcs(dataset);
}

export function projectPointLayer(lyr, proj) {
  var errors = 0;
  editShapes(lyr.shapes, function (p) {
    var p2 = proj(p[0], p[1]);
    if (!p2) errors++;
    return p2;
  });
  return errors;
}

export function projectArcs(arcs, proj) {
  var data = arcs.getVertexData(),
    xx = data.xx,
    yy = data.yy,
    zz = data.zz,
    p;

  for (var i = 0, n = xx.length; i < n; i++) {
    p = proj(xx[i], yy[i]);
    xx[i] = p[0];
    yy[i] = p[1];
  }
  arcs.updateVertexData(data.nn, xx, yy, zz);
}

function projectArcs2(arcs, proj) {
  return editArcs(arcs, onPoint);
  function onPoint(append, x, y, _prevX, _prevY, _i) {
    var p = proj(x, y);

    if (p) {
      append(p);
    } else {
      return false;
    }
  }
}
