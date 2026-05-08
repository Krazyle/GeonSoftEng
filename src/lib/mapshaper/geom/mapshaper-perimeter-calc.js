import geom from "../geom/mapshaper-geom";
import { absArcId } from "../paths/mapshaper-arc-utils";
import { forEachArcId } from "../paths/mapshaper-path-utils";

export function getInnerPctCalcFunction(arcs, shapes) {
  var calcSegLen = arcs.isPlanar() ? geom.distance2D : geom.greatCircleDistance;
  var arcIndex = new ArcTopologyIndex(arcs, shapes);
  var outerLen, innerLen, arcLen;

  return function (shp) {
    outerLen = 0;
    innerLen = 0;
    if (shp) shp.forEach(procRing);
    return innerLen > 0 ? innerLen / (innerLen + outerLen) : 0;
  };

  function procRing(ids) {
    ids.forEach(procArc);
  }

  function procArc(id) {
    arcLen = 0;
    arcs.forEachArcSegment(id, addSegLen);
    if (arcIndex.isInnerArc(id)) {
      innerLen += arcLen;
    } else {
      outerLen += arcLen;
    }
  }

  function addSegLen(i, j, xx, yy) {
    arcLen += calcSegLen(xx[i], yy[i], xx[j], yy[j]);
  }
}

function ArcTopologyIndex(arcs, shapes) {
  var index = new Uint8Array(arcs.size());
  forEachArcId(shapes, function (arcId) {
    if (arcId < 0) index[~arcId] |= 2;
    else index[arcId] |= 1;
  });

  this.isInnerArc = function (arcId) {
    var i = absArcId(arcId);
    return index[i] === 3;
  };
}
