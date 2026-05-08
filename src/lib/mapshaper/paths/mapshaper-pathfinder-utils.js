import geom from "../geom/mapshaper-geom";
import { debug, error } from "../utils/mapshaper-logging";

export function getRightmostArc(arcId, nodes, filter) {
  var ids = nodes.getConnectedArcs(arcId);
  if (filter) {
    ids = ids.filter(filter);
  }
  if (ids.length === 0) {
    return arcId;
  }
  return getRighmostArc2(arcId, ids, nodes.arcs);
}

function getRighmostArc2(fromId, ids, arcs) {
  var coords = arcs.getVertexData(),
    xx = coords.xx,
    yy = coords.yy,
    inode = arcs.indexOfVertex(fromId, -1),
    nodeX = xx[inode],
    nodeY = yy[inode],
    ifrom = arcs.indexOfVertex(fromId, -2),
    fromX = xx[ifrom],
    fromY = yy[ifrom],
    toId = fromId,
    ito,
    candId,
    icand,
    code,
    j;

  if (ids.length > 0) {
    toId = ids[0];
    ito = arcs.indexOfVertex(toId, -2);
  }

  for (j = 1; j < ids.length; j++) {
    candId = ids[j];
    icand = arcs.indexOfVertex(candId, -2);
    code = chooseRighthandPath(
      fromX,
      fromY,
      nodeX,
      nodeY,
      xx[ito],
      yy[ito],
      xx[icand],
      yy[icand],
    );

    if (code === 2) {
      toId = candId;
      ito = icand;
    }
  }
  if (toId === fromId) {
    error("Pathfinder error");
  }
  return toId;
}

function _chooseRighthandPath2(_fromX, _fromY, nodeX, nodeY, ax, ay, bx, by) {
  return chooseRighthandVector(ax - nodeX, ay - nodeY, bx - nodeX, by - nodeY);
}

function chooseRighthandPath(fromX, fromY, nodeX, nodeY, ax, ay, bx, by) {
  var angleA = geom.signedAngle(fromX, fromY, nodeX, nodeY, ax, ay);
  var angleB = geom.signedAngle(fromX, fromY, nodeX, nodeY, bx, by);
  var code;
  if (angleA <= 0 || angleB <= 0) {
    debug("[chooseRighthandPath()] 0 angle(s):", angleA, angleB);
    if (angleA <= 0) {
      debug("  A orient2D:", geom.orient2D(fromX, fromY, nodeX, nodeY, ax, ay));
    }
    if (angleB <= 0) {
      debug("  B orient2D:", geom.orient2D(fromX, fromY, nodeX, nodeY, bx, by));
    }

    if (angleA > 0) {
      code = 1;
    } else if (angleB > 0) {
      code = 2;
    } else {
      code = 0;
    }
  } else if (angleA < angleB) {
    code = 1;
  } else if (angleB < angleA) {
    code = 2;
  } else if (Number.isNaN(angleA) || Number.isNaN(angleB)) {
    error("Invalid node geometry");
  } else {
    code = chooseRighthandVector(
      ax - nodeX,
      ay - nodeY,
      bx - nodeX,
      by - nodeY,
    );
    debug(
      "[chooseRighthandPath()] equal angles:",
      angleA,
      "fallback test:",
      code,
    );
  }
  return code;
}

function chooseRighthandVector(ax, ay, bx, by) {
  var orient = geom.orient2D(ax, ay, 0, 0, bx, by);
  var code;
  if (orient > 0) {
    code = 2;
  } else if (orient < 0) {
    code = 1;
  } else {
    code = 0;
  }
  return code;
}
