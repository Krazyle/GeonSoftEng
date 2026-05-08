import { IdLookupIndex } from "../indexing/mapshaper-id-lookup-index";
import { getArcPresenceTest, reversePath } from "../paths/mapshaper-path-utils";
import { forEachShapePart } from "../paths/mapshaper-shape-utils";
import { NodeCollection } from "../topology/mapshaper-nodes";
import { error } from "../utils/mapshaper-logging";

export function cleanPolylineLayerGeometry(lyr, dataset, _opts) {
  var arcs = dataset.arcs;
  var filter = getArcPresenceTest(lyr.shapes, arcs);
  var nodes = new NodeCollection(arcs, filter);
  var arcIndex = new IdLookupIndex(arcs.size(), true);
  lyr.shapes = lyr.shapes.map(function (shp, _i) {
    if (!shp) return null;

    shp = divideShapeAtNodes(shp, nodes);

    arcIndex.clear();
    shp = uniqifyArcs(shp, arcIndex);

    arcIndex.clear();
    shp = combineContiguousParts(shp, nodes, arcIndex);
    return shp;
  });
}

function uniqifyArcs(shp, index) {
  var shp2 = shp.reduce(function (memo, ids) {
    addUnusedArcs(memo, ids, index);
    return memo;
  }, []);
  return shp2.length > 0 ? shp2 : null;
}

function addUnusedArcs(shp, ids, index) {
  var part = [],
    arcId;
  for (var i = 0; i < ids.length; i++) {
    arcId = ids[i];
    if (!index.hasId(arcId)) {
      part.push(arcId);
    } else if (part.length > 0) {
      shp.push(part);
      part = [];
    }
    index.setId(arcId, i);
    index.setId(~arcId, i);
  }
  if (part.length > 0) shp.push(part);
}

function divideShapeAtNodes(shp, nodes) {
  var shp2 = [];
  forEachShapePart(shp, onPart);
  return shp2;

  function onPart(ids) {
    var n = ids.length;
    var id, _connected;
    var ids2 = [];
    for (var i = 0; i < n; i++) {
      id = ids[i];
      ids2.push(id);
      if (i < n - 1 && nodes.getConnectedArcs(id).length > 1) {
        shp2.push(ids2);
        ids2 = [];
      }
    }
    if (ids2.length > 0) shp2.push(ids2);
  }
}

function combineContiguousParts(parts, nodes, endpointIndex) {
  if (!parts || parts.length < 2) return parts;

  parts.forEach(function (ids, i) {
    var tailId = ~ids[0];
    var headId = ids[ids.length - 1];

    if (endpointIndex.hasId(tailId) || endpointIndex.hasId(headId)) {
      error("Indexing error");
    }
    endpointIndex.setId(tailId, i);
    endpointIndex.setId(headId, i);
    procEndpoint(tailId, i);
    procEndpoint(headId, i);
  });

  return parts.filter(function (ids) {
    return !!ids;
  });

  function procEndpoint(endpointId, sourcePartId) {
    var joins = 0;
    var partId2 = -1;
    var endpointId2;
    var indexedPartId = endpointIndex.getId(endpointId);
    nodes.forEachConnectedArc(endpointId, function (arcId) {
      if (endpointIndex.hasId(arcId)) {
        partId2 = endpointIndex.getId(arcId);
        endpointId2 = arcId;
      }
      joins++;
    });
    if (joins === 1 && partId2 > -1 && partId2 < sourcePartId) {
      extendPolylinePart(
        parts,
        partId2,
        endpointId2,
        indexedPartId,
        endpointId,
      );

      endpointIndex.setId(endpointId, partId2);

      var ids = parts[indexedPartId];
      var otherEndpointId = getOtherEndpointId(ids, endpointId);
      endpointIndex.setId(otherEndpointId, partId2);
      if (indexedPartId !== partId2) {
        parts[indexedPartId] = null;
      }
    }
  }
}

function getOtherEndpointId(ids, endpointId) {
  var headId = ~ids[0];
  var tailId = ids[ids.length - 1];
  if (endpointId === headId) return tailId;
  else if (endpointId === tailId) return headId;
  error("Indexing error");
}

function extendPolylinePart(parts, partId1, endpoint1, partId2, endpoint2) {
  var ids1 = parts[partId1];
  var ids2 = parts[partId2];
  var joinToTail, joinFromTail;
  if (~endpoint1 === ids1[0]) {
    joinToTail = true;
  } else if (endpoint1 === ids1[ids1.length - 1]) {
    joinToTail = false;
  } else {
    error("Index error");
  }
  if (~endpoint2 === ids2[0]) {
    joinFromTail = true;
  } else if (endpoint2 === ids2[ids2.length - 1]) {
    joinFromTail = false;
  } else {
    error("Index error 2");
  }
  if (!joinFromTail) {
    ids2 = reversePath(ids2.concat());
  }
  if (joinToTail) {
    prependPath(ids1, ids2);
  } else {
    appendPath(ids1, ids2);
  }
}

function prependPath(target, source) {
  source = reversePath(source.concat());
  var args = [0, 0].concat(source);
  target.splice.apply(target, args);
}

function appendPath(target, source) {
  target.push.apply(target, source);
}
