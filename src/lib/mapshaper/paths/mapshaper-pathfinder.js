import { absArcId } from "../paths/mapshaper-arc-utils";
import { forEachArcId } from "../paths/mapshaper-path-utils";
import { getRightmostArc } from "../paths/mapshaper-pathfinder-utils";
import { forEachShapePart } from "../paths/mapshaper-shape-utils";
import { debug } from "../utils/mapshaper-logging";

var _FWD_VISIBLE = 0x1;
var _FWD_OPEN = 0x2;
var _REV_VISIBLE = 0x10;
var _REV_OPEN = 0x20;

export function setBits(bits, arcBits, mask) {
  return (bits & ~mask) | (arcBits & mask);
}

function _andBits(bits, arcBits, mask) {
  return bits & (~mask | arcBits);
}

function setRouteBits(arcBits, arcId, routesArr) {
  var idx = absArcId(arcId),
    mask;
  if (idx === arcId) {
    mask = ~3;
  } else {
    mask = ~0x30;
    arcBits = arcBits << 4;
  }
  routesArr[idx] &= arcBits | mask;
}

function getRouteBits(arcId, routesArr) {
  var idx = absArcId(arcId),
    bits = routesArr[idx];
  if (idx !== arcId) bits = bits >> 4;
  return bits & 7;
}

export function openArcRoutes(
  paths,
  arcColl,
  routesArr,
  fwd,
  rev,
  dissolve,
  orBits,
) {
  forEachArcId(paths, function (arcId) {
    var isInv = arcId < 0,
      idx = isInv ? ~arcId : arcId,
      currBits = routesArr[idx],
      openFwd = isInv ? rev : fwd,
      openRev = isInv ? fwd : rev,
      newBits = currBits;

    if (arcColl.arcIsLollipop(arcId)) {
      debug("lollipop");
      newBits = 0;
    } else {
      if (openFwd) {
        newBits |= 3;
      }
      if (openRev) {
        newBits |= 0x30;
      }

      if (orBits > 0) {
        newBits |= orBits;
      }

      if (dissolve && (newBits & 0x22) === 0x22) {
        newBits &= ~0x11;
      }
    }

    routesArr[idx] = newBits;
  });
}

export function closeArcRoutes(arcIds, _arcs, routesArr, fwd, rev, hide) {
  forEachArcId(arcIds, function (arcId) {
    var isInv = arcId < 0,
      idx = isInv ? ~arcId : arcId,
      currBits = routesArr[idx],
      mask = 0xff,
      closeFwd = isInv ? rev : fwd,
      closeRev = isInv ? fwd : rev;

    if (closeFwd) {
      if (hide) mask &= ~1;
      mask ^= 0x2;
    }
    if (closeRev) {
      if (hide) mask &= ~0x10;
      mask ^= 0x20;
    }
    routesArr[idx] = currBits & mask;
  });
}

export function getPathFinder(nodes, useRoute, routeIsUsable) {
  var testArc = null;
  if (routeIsUsable) {
    testArc = function (arcId) {
      return routeIsUsable(~arcId);
    };
  }

  function getNextArc(prevId) {
    return ~getRightmostArc(prevId, nodes, testArc);
  }

  return function (startId) {
    var path = [],
      nextId,
      _msg,
      candId = startId;

    do {
      if (useRoute(candId)) {
        path.push(candId);
        nextId = candId;
        candId = getNextArc(nextId);
      } else {
        return null;
      }

      if (candId === ~nextId) {
        debug("Pathfinder warning: dead-end path");
        return null;
      }
    } while (candId !== startId);
    return path.length === 0 ? null : path;
  };
}

export function getRingIntersector(nodes, flagsArr) {
  var arcs = nodes.arcs;
  var findPath = getPathFinder(nodes, useRoute, routeIsActive);
  flagsArr = flagsArr || new Uint8Array(arcs.size());

  return function (rings, type) {
    var dissolve = type === "dissolve",
      openFwd = true,
      openRev = type === "flatten",
      output;

    if (rings.length > 0) {
      output = [];
      openArcRoutes(rings, arcs, flagsArr, openFwd, openRev, dissolve);
      forEachShapePart(rings, function (ids) {
        var path;
        for (var i = 0, n = ids.length; i < n; i++) {
          path = findPath(ids[i]);
          if (path) {
            output.push(path);
          }
        }
      });
      closeArcRoutes(rings, arcs, flagsArr, openFwd, openRev, true);
    } else {
      output = rings;
    }
    return output;
  };

  function routeIsActive(arcId) {
    var bits = getRouteBits(arcId, flagsArr);
    return (bits & 1) === 1;
  }

  function useRoute(arcId) {
    var route = getRouteBits(arcId, flagsArr),
      isOpen = false;
    if (route === 3) {
      isOpen = true;
      setRouteBits(1, arcId, flagsArr);
    }
    return isOpen;
  }
}
