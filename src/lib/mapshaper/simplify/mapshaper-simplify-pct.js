import utils from "../utils/mapshaper-utils";

function _getThresholdFunction(arcs) {
  var size = arcs.getPointCount(),
    nth = Math.ceil(size / 5e5),
    sortedThresholds = arcs.getRemovableThresholds(nth);

  utils.quicksort(sortedThresholds, true);

  return function (pct) {
    var n = sortedThresholds.length;
    var rank = retainedPctToRank(pct, sortedThresholds.length);
    if (rank < 1) return 0;
    if (rank > n) return Infinity;
    return sortedThresholds[rank - 1];
  };
}

function retainedPctToRank(pct, n) {
  var rank;
  if (n === 0 || pct >= 1) {
    rank = 0;
  } else if (pct <= 0) {
    rank = n + 1;
  } else {
    rank = Math.floor((1 - pct) * (n + 2));
  }
  return rank;
}

export function getThresholdByPct(pct, arcs, nth) {
  var tmp = arcs.getRemovableThresholds(nth),
    rank = retainedPctToRank(pct, tmp.length);
  if (rank < 1) return 0;
  if (rank > tmp.length) return Infinity;
  return utils.findValueByRank(tmp, rank);
}
