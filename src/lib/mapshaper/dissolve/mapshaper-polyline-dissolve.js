import { absArcId } from "../paths/mapshaper-arc-utils";
import { traversePaths } from "../paths/mapshaper-path-utils";
import { NodeCollection } from "../topology/mapshaper-nodes";

export function dissolvePolylineGeometry(lyr, getGroupId, arcs, _opts) {
  var groups = getPolylineDissolveGroups(lyr.shapes, getGroupId);
  var dissolve = getPolylineDissolver(arcs);
  return groups.map(dissolve);
}

function getPolylineDissolveGroups(shapes, getGroupId) {
  var groups = [];
  traversePaths(shapes, function (o) {
    var groupId = getGroupId(o.shapeId);
    if (groupId in groups === false) {
      groups[groupId] = [];
    }
    groups[groupId].push(o.arcId);
  });
  return groups;
}

function getPolylineDissolver(arcs) {
  var flags = new Uint8Array(arcs.size());
  var testArc = function (id) {
    return flags[absArcId(id)] > 0;
  };
  var useArc = function (id) {
    flags[absArcId(id)] = 0;
  };
  var nodes = new NodeCollection(arcs);
  return function (ids) {
    ids.forEach(function (id) {
      flags[absArcId(id)] = 1;
    });
    var ends = findPolylineEnds(ids, nodes, testArc);
    var straightParts = collectPolylineArcs(ends, nodes, testArc, useArc);
    var ringParts = collectPolylineArcs(ids, nodes, testArc, useArc);
    var allParts = straightParts.concat(ringParts);
    ids.forEach(function (id) {
      flags[absArcId(id)] = 0;
    });
    return allParts;
  };
}

function collectPolylineArcs(ids, nodes, testArc, useArc) {
  var parts = [];
  ids.forEach(function (startId) {
    var part = [];
    var nextId = startId;
    var nextIds;
    while (testArc(nextId)) {
      part.push(nextId);
      nextIds = testArc(nextId) ? nodes.getConnectedArcs(nextId, testArc) : [];
      useArc(nextId);
      if (nextIds.length > 0) {
        nextId = ~nextIds[0];
      } else {
        break;
      }
    }
    if (part.length > 0) parts.push(part);
  });
  return parts;
}

function findPolylineEnds(ids, nodes, filter) {
  var ends = [];
  ids.forEach(function (arcId) {
    if (nodes.getConnectedArcs(arcId, filter).length === 0) {
      ends.push(~arcId);
    }
    if (nodes.getConnectedArcs(~arcId, filter).length === 0) {
      ends.push(arcId);
    }
  });
  return ends;
}
