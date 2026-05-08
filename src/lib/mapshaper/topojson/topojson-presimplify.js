export function getPresimplifyFunction(width) {
  var quanta = 10000,
    k = quanta / width;
  return function (z) {
    return z === Infinity ? 0 : Math.ceil(z * k);
  };
}
