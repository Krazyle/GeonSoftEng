import { DataTable } from "../datatable/mapshaper-data-table";
import geom from "../geom/mapshaper-geom";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { addIntersectionCuts } from "../paths/mapshaper-intersection-cuts";
import { PathIndex } from "../paths/mapshaper-path-index";
import { reversePath } from "../paths/mapshaper-path-utils";
import { getPathFinder } from "../paths/mapshaper-pathfinder";
import { debug, stop } from "../utils/mapshaper-logging";
import { T } from "../utils/mapshaper-timing";
import utils from "../utils/mapshaper-utils";

function _mosaic(dataset, opts) {
  var layers2 = [];
  var nodes, output;
  if (!dataset.arcs) stop("Dataset is missing path data");
  nodes = addIntersectionCuts(dataset, opts);
  output = buildPolygonMosaic(nodes);
  layers2.push({
    name: "mosaic",
    shapes: output.mosaic,
    geometry_type: "polygon",
  });
  if (opts.debug) {
    layers2.push({
      geometry_type: "polygon",
      name: "mosaic-enclosure",
      shapes: output.enclosures,
    });

    if (output.lostArcs.length > 0) {
      layers2 = layers2.concat(getLostArcLayers(output.lostArcs, nodes.arcs));
    }
  }
  return layers2;

  function getLostArcLayers(lostArcs, arcs) {
    var arcLyr = { geometry_type: "polyline", name: "lost-arcs", shapes: [] };
    var pointLyr = {
      geometry_type: "point",
      name: "lost-arc-endpoints",
      shapes: [],
    };
    var arcData = [];
    var pointData = [];
    lostArcs.forEach(function (arcId) {
      var first = arcs.getVertex(arcId, 0);
      var last = arcs.getVertex(arcId, -1);
      arcData.push({ ARCID: arcId });
      arcLyr.shapes.push([[arcId]]);
      pointData.push({ ARCID: arcId }, { ARCID: arcId });
      pointLyr.shapes.push([[first.x, first.y]], [[last.x, last.y]]);
    });
    arcLyr.data = new DataTable(arcData);
    pointLyr.data = new DataTable(pointData);
    return [arcLyr, pointLyr];
  }
}

export function buildPolygonMosaic(nodes) {
  T.start();

  nodes.detachAcyclicArcs();
  var data = findMosaicRings(nodes);

  var mosaic = data.cw.map(function (ring) {
    return [ring];
  });
  debug("Find mosaic rings", T.stop());
  T.start();

  var enclosures = [];
  var index = new PathIndex(mosaic, nodes.arcs);
  data.ccw.forEach(function (ring) {
    var id = index.findSmallestEnclosingPolygon(ring);
    if (id > -1) {
      mosaic[id].push(ring);
    } else {
      reversePath(ring);
      enclosures.push([ring]);
    }
  });
  debug(
    utils.format(
      "Detect holes (holes: %d, enclosures: %d)",
      data.ccw.length - enclosures.length,
      enclosures.length,
    ),
    T.stop(),
  );

  return { mosaic: mosaic, enclosures: enclosures, lostArcs: data.lostArcs };
}

function findMosaicRings(nodes) {
  var arcs = nodes.arcs,
    cw = [],
    ccw = [],
    empty = [],
    lostArcs = [];

  var flags = new Uint8Array(arcs.size());
  var findPath = getPathFinder(nodes, useRoute);

  for (var i = 0, n = flags.length; i < n; i++) {
    tryPath(i);

    tryPath(~i);
  }
  return {
    cw: cw,
    ccw: ccw,
    empty: empty,
    lostArcs: lostArcs,
  };

  function tryPath(arcId) {
    var ring, area;
    if (!routeIsOpen(arcId)) return;
    ring = findPath(arcId);
    if (!ring) {
      lostArcs.push(arcId);
      debug("Dead-end arc:", arcId);
      return;
    }
    area = geom.getPlanarPathArea(ring, arcs);
    if (area > 0) {
      cw.push(ring);
    } else if (area < 0) {
      ccw.push(ring);
    } else {
      empty.push(ring);
    }
  }

  function useRoute(arcId) {
    return routeIsOpen(arcId, true);
  }

  function routeIsOpen(arcId, closeRoute) {
    var absId = absArcId(arcId);
    var bit = absId === arcId ? 1 : 2;
    var isOpen = (flags[absId] & bit) === 0;
    if (closeRoute && isOpen) flags[absId] |= bit;
    return isOpen;
  }
}
