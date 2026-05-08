import { getXYHash } from "../topology/mapshaper-hash-function";

export function initPointChains(xx, yy) {
  var chainIds = initHashChains(xx, yy),
    j,
    next,
    prevMatchId,
    prevUnmatchId;

  for (var i = xx.length - 1; i >= 0; i--) {
    next = chainIds[i];
    if (next >= i) continue;
    prevMatchId = i;
    prevUnmatchId = -1;
    do {
      j = next;
      next = chainIds[j];
      if (yy[j] === yy[i] && xx[j] === xx[i]) {
        chainIds[j] = prevMatchId;
        prevMatchId = j;
      } else {
        if (prevUnmatchId > -1) {
          chainIds[prevUnmatchId] = j;
        }
        prevUnmatchId = j;
      }
    } while (next < j);
    if (prevUnmatchId > -1) {
      chainIds[prevUnmatchId] = prevUnmatchId;
    }
    chainIds[i] = prevMatchId;
  }
  return chainIds;
}

function initHashChains(xx, yy) {
  var n = xx.length,
    m = Math.floor(n * 1.3) || 1,
    hash = getXYHash(m),
    hashTable = new Int32Array(m),
    chainIds = new Int32Array(n),
    key,
    j,
    i,
    x,
    y;

  for (i = 0; i < n; i++) {
    x = xx[i];
    y = yy[i];
    if (x !== x || y !== y) {
      j = -1;
    } else {
      key = hash(x, y);
      j = hashTable[key] - 1;
      hashTable[key] = i + 1;
    }
    chainIds[i] = j >= 0 ? j : i;
  }
  return chainIds;
}
