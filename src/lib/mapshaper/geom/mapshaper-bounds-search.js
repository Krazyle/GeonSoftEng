import Flatbush from "flatbush";

export function getBoundsSearchFunction(boxes) {
  var index;
  if (!boxes.length) {
    return function () {
      return [];
    };
  }
  index = new Flatbush(boxes.length);
  boxes.forEach(function (ring) {
    var b = ring.bounds;
    index.add(b.xmin, b.ymin, b.xmax, b.ymax);
  });
  index.finish();

  function idxToObj(i) {
    return boxes[i];
  }

  return function (a, b, c, d) {
    return index.search(a, b, c, d).map(idxToObj);
  };
}
