export function getSemiMinorAxis(P) {
  return P.a * Math.sqrt(1 - (P.es || 0));
}

export function getCircleRadiusFromAngle(P, angle) {
  return ((angle * Math.PI) / 180) * getSemiMinorAxis(P);
}
