import {
  getArcPresenceTest2,
  layerHasPaths,
} from "../dataset/mapshaper-layer-utils";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { ArcCollection } from "../paths/mapshaper-arcs";
import { getPathEndpointTest } from "../paths/mapshaper-path-endpoints";
import { editShapeParts } from "../paths/mapshaper-shape-utils";
import { NodeCollection } from "../topology/mapshaper-nodes";
import { verbose } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function dissolveArcs(dataset) {
  var arcs = dataset.arcs,
    layers = dataset.layers.filter(layerHasPaths);

  if (!arcs || !layers.length) {
    dataset.arcs = null;
    return;
  }

  var arcsCanDissolve = getArcDissolveTest(layers, arcs),
    newArcs = [],
    totalPoints = 0,
    arcIndex = new Int32Array(arcs.size()),
    arcStatus = new Uint8Array(arcs.size());

  layers.forEach(function (lyr) {
    lyr.shapes = lyr.shapes.map(function (shape) {
      return editShapeParts(shape?.concat(), translatePath);
    });
  });
  dataset.arcs = dissolveArcCollection(arcs, newArcs, totalPoints);

  function translatePath(path) {
    var pointCount = 0;
    var newPath = [];
    var newArc, arcId, absId, arcLen, fw, newArcId;

    for (var i = 0, n = path.length; i < n; i++) {
      arcId = path[i];
      absId = absArcId(arcId);
      fw = arcId === absId;

      if (arcs.arcIsDegenerate(arcId)) {
      } else if (arcStatus[absId] !== 0) {
        newArc = null;
      } else {
        arcLen = arcs.getArcLength(arcId);

        if (newArc && arcsCanDissolve(path[i - 1], arcId)) {
          if (arcLen > 0) {
            arcLen--;
          }
          newArc.push(arcId);
          arcStatus[absId] = 1;
        } else {
          newArc = [arcId];
          arcIndex[absId] = newArcs.length;
          newArcs.push(newArc);
          arcStatus[absId] = fw ? 2 : 3;
        }
        pointCount += arcLen;
      }

      if (arcStatus[absId] > 1) {
        newArcId = arcIndex[absId];
        if ((fw && arcStatus[absId] === 3) || (!fw && arcStatus[absId] === 2)) {
          newArcId = ~newArcId;
        }
        newPath.push(newArcId);
      }
    }
    totalPoints += pointCount;
    return newPath;
  }
}

function dissolveArcCollection(arcs, newArcs, newLen) {
  var nn2 = new Uint32Array(newArcs.length),
    xx2 = new Float64Array(newLen),
    yy2 = new Float64Array(newLen),
    src = arcs.getVertexData(),
    zz2 = src.zz ? new Float64Array(newLen) : null,
    interval = arcs.getRetainedInterval(),
    offs = 0;

  newArcs.forEach(function (newArc, newId) {
    newArc.forEach(function (oldId, _i) {
      extendDissolvedArc(oldId, newId);
    });
  });

  return new ArcCollection(nn2, xx2, yy2)
    .setThresholds(zz2)
    .setRetainedInterval(interval);

  function extendDissolvedArc(oldId, newId) {
    var absId = absArcId(oldId),
      rev = oldId < 0,
      n = src.nn[absId],
      i = src.ii[absId],
      n2 = nn2[newId];

    if (n > 0) {
      if (n2 > 0) {
        n--;
        if (!rev) i++;
      }
      utils.copyElements(src.xx, i, xx2, offs, n, rev);
      utils.copyElements(src.yy, i, yy2, offs, n, rev);
      if (zz2) utils.copyElements(src.zz, i, zz2, offs, n, rev);
      nn2[newId] += n;
      offs += n;
    }
  }
}

function getArcDissolveTest(layers, arcs) {
  var nodes = new NodeCollection(arcs, getArcPresenceTest2(layers, arcs)),
    lineLayers = layers.filter(function (lyr) {
      return lyr.geometry_type === "polyline";
    }),
    testLineEndpoint = getPathEndpointTest(lineLayers, arcs),
    linkCount,
    lastId;

  return function (id1, id2) {
    if (id1 === id2 || id1 === ~id2) {
      verbose("Unexpected arc sequence:", id1, id2);
      return false;
    }
    linkCount = 0;
    nodes.forEachConnectedArc(id1, countLink);
    return (
      linkCount === 1 &&
      lastId === ~id2 &&
      !testLineEndpoint(id1) &&
      !testLineEndpoint(~id2)
    );
  };

  function countLink(arcId, _i) {
    linkCount++;
    lastId = arcId;
  }
}
