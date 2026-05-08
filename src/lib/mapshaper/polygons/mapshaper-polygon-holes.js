import geom from "../geom/mapshaper-geom";
import { getSelfIntersectionSplitter } from "../paths/mapshaper-path-repair-utils";
import { editShapes, forEachShapePart } from "../paths/mapshaper-shape-utils";
import { debug } from "../utils/mapshaper-logging";

function _deleteHoles(lyr, arcs) {
  editShapes(lyr.shapes, function (path) {
    if (geom.getPathArea(path, arcs) <= 0) {
      return null;
    }
  });
}

export function getHoleDivider(nodes, spherical) {
  var split = getSelfIntersectionSplitter(nodes);

  return function (rings, cw, ccw) {
    var pathArea = spherical
      ? geom.getSphericalPathArea
      : geom.getPlanarPathArea;
    forEachShapePart(rings, function (ringIds) {
      var splitRings = split(ringIds);
      if (splitRings.length === 0) {
        debug("[getRingDivider()] Defective path:", ringIds);
      }
      splitRings.forEach(function (ringIds, _i) {
        var ringArea = pathArea(ringIds, nodes.arcs);
        if (ringArea > 0) {
          cw.push(ringIds);
        } else if (ringArea < 0) {
          ccw.push(ringIds);
        }
      });
    });
  };
}
