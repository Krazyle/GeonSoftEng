import type { Feature, IFeature, LineString } from "types";
import type { EphemeralEditingStateLasso } from "@/stores/jotai";

export function makeRectangle(ephemeralState: EphemeralEditingStateLasso) {
  const [a, b] = ephemeralState.box;

  return [...a, 0, a[0], b[1], 0, ...b, 0, b[0], a[1], 0, ...a, 0];
}

export function fixDegenerates(feature: Feature) {
  if (feature.geometry?.type === "Polygon") {
    const ring = feature.geometry.coordinates[0];
    if (
      ring.length < 3 ||
      (ring.length === 3 &&
        ring[0][0] === ring[2][0] &&
        ring[0][1] === ring[2][1])
    ) {
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: feature.geometry.coordinates[0],
        },
      } as IFeature<LineString>;
    }
  }
  return feature;
}
