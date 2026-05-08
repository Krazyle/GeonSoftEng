import { traversePaths } from "../paths/mapshaper-path-utils";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function dissolvePolygonGeometry(shapes, getGroupId) {
  var segments = dissolveFirstPass(shapes, getGroupId);
  return dissolveSecondPass(segments, shapes, getGroupId);
}

function dissolveFirstPass(shapes, getGroupId) {
  var groups = [],
    largeGroups = [],
    segments = [],
    ids = shapes.map(function (_shp, i) {
      return getGroupId(i);
    });

  traversePaths(shapes, procArc);
  largeGroups.forEach(splitGroup);
  return segments;

  function procArc(obj) {
    var arcId = obj.arcId,
      idx = arcId < 0 ? ~arcId : arcId,
      segId = segments.length,
      group = groups[idx];
    if (!group) {
      group = [];
      groups[idx] = group;
    }
    group.push(segId);
    obj.group = group;
    segments.push(obj);

    if (group.length === 3) {
      largeGroups.push(group);
    }
  }

  function findMatchingPair(group, cb) {
    var arc1, arc2;
    for (var i = 0; i < group.length - 1; i++) {
      arc1 = segments[group[i]];
      for (var j = i + 1; j < group.length; j++) {
        arc2 = segments[group[j]];
        if (cb(arc1, arc2)) {
          return [arc1.segId, arc2.segId];
        }
      }
    }
    return null;
  }

  function checkFwExtension(arc1, arc2) {
    return (
      getNextSegment(arc1, segments, shapes).arcId ===
      ~getNextSegment(arc2, segments, shapes).arcId
    );
  }

  function checkBwExtension(arc1, arc2) {
    return (
      getPrevSegment(arc1, segments, shapes).arcId ===
      ~getPrevSegment(arc2, segments, shapes).arcId
    );
  }

  function checkDoubleExtension(arc1, arc2) {
    return (
      checkPairwiseMatch(arc1, arc2) &&
      checkFwExtension(arc1, arc2) &&
      checkBwExtension(arc1, arc2)
    );
  }

  function checkSingleExtension(arc1, arc2) {
    return (
      checkPairwiseMatch(arc1, arc2) &&
      (checkFwExtension(arc1, arc2) || checkBwExtension(arc1, arc2))
    );
  }

  function checkPairwiseMatch(arc1, arc2) {
    return (
      arc1.arcId === ~arc2.arcId && ids[arc1.shapeId] === ids[arc2.shapeId]
    );
  }

  function updateGroupIds(ids) {
    ids.forEach(function (id) {
      segments[id].group = ids;
    });
  }

  function splitGroup(group) {
    var group2 =
      findMatchingPair(group, checkDoubleExtension) ||
      findMatchingPair(group, checkSingleExtension) ||
      findMatchingPair(group, checkPairwiseMatch);
    if (group2) {
      group = group.filter(function (i) {
        return !utils.contains(group2, i);
      });
      updateGroupIds(group);
      updateGroupIds(group2);

      if (group.length > 2) splitGroup(group);
    }
  }
}

function dissolveSecondPass(segments, shapes, getGroupId) {
  var dissolveShapes = [];
  segments.forEach(procSegment);
  return dissolveShapes;

  function procSegment(obj) {
    if (obj.used) return;
    var match = findDissolveArc(obj);
    if (!match) buildRing(obj);
  }

  function addRing(arcs, i) {
    if (i in dissolveShapes === false) {
      dissolveShapes[i] = [];
    }
    dissolveShapes[i].push(arcs);
  }

  function buildRing(firstArc) {
    var newArcs = [firstArc.arcId],
      nextArc = getNextArc(firstArc);
    firstArc.used = true;

    while (nextArc && nextArc !== firstArc) {
      newArcs.push(nextArc.arcId);
      nextArc.used = true;
      nextArc = getNextArc(nextArc);
      if (nextArc && nextArc !== firstArc && nextArc.used)
        error("buildRing() topology error");
    }

    if (!nextArc) error("buildRing() traversal error");
    firstArc.used = true;
    addRing(newArcs, getGroupId(firstArc.shapeId));
  }

  function getNextArc(obj, depth) {
    var next = getNextSegment(obj, segments, shapes),
      match;
    depth = depth || 0;
    if (next !== obj) {
      match = findDissolveArc(next);
      if (match) {
        if (depth > 100) {
          error("deep recursion -- unhandled topology problem");
        }

        if (shapes[match.shapeId][match.partId].length === 1) {
          next = getNextArc(next, depth + 1);
        } else {
          next = getNextArc(match, depth + 1);
        }
      }
    }
    return next;
  }

  function findDissolveArc(obj) {
    var dissolveId = getGroupId(obj.shapeId),
      match,
      matchId;
    matchId = utils.find(obj.group, function (i) {
      var a = obj,
        b = segments[i];
      if (
        a === b ||
        b.used ||
        getGroupId(b.shapeId) !== dissolveId ||
        a.arcId !== ~b.arcId
      )
        return false;
      return true;
    });
    match = matchId === null ? null : segments[matchId];
    return match;
  }
}

function getNextSegment(seg, segments, shapes) {
  return getSegmentByOffs(seg, segments, shapes, 1);
}

function getPrevSegment(seg, segments, shapes) {
  return getSegmentByOffs(seg, segments, shapes, -1);
}

function getSegmentByOffs(seg, segments, shapes, offs) {
  var arcs = shapes[seg.shapeId][seg.partId],
    partLen = arcs.length,
    nextOffs = (seg.i + offs) % partLen,
    nextSeg;
  if (nextOffs < 0) nextOffs += partLen;
  nextSeg = segments[seg.segId - seg.i + nextOffs];
  if (!nextSeg || nextSeg.shapeId !== seg.shapeId) error("index error");
  return nextSeg;
}
