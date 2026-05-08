import polylabel from "polylabel";
import type { IWrappedFeature } from "types";
import { USelection } from "@/stores";
import type { Sel } from "@/stores/jotai";
import { newFeatureId } from "@/utils/id";
import { EMPTY_MOMENT, type MomentInput } from "@/utils/persistence/moment";

export function centroidFeature(
  wrappedFeature: IWrappedFeature,
  coordinates: Pos2,
): MomentInput["putFeatures"][number] {
  return {
    id: newFeatureId(),
    feature: {
      type: "Feature",
      properties: wrappedFeature.feature.properties,
      geometry: {
        type: "Point",
        coordinates,
      },
    },
    folderId: wrappedFeature.folderId,
  };
}

export function drawLabelPoints(wrappedFeatures: IWrappedFeature[]): {
  newSelection: Sel;
  moment: MomentInput;
} {
  const putFeatures: MomentInput["putFeatures"] = wrappedFeatures.flatMap(
    (wrappedFeature) => {
      const geometry = wrappedFeature.feature.geometry;
      if (geometry) {
        switch (geometry.type) {
          case "MultiPolygon": {
            return geometry.coordinates.map((polygon) => {
              const center = polylabel(polygon) as unknown as Pos2;
              return centroidFeature(wrappedFeature, center);
            });
          }
          case "Polygon": {
            const center = polylabel(geometry.coordinates) as unknown as Pos2;
            return centroidFeature(wrappedFeature, center);
          }
          default: {
            return [];
          }
        }
      }
      return [];
    },
  );

  return {
    newSelection: USelection.fromIds(putFeatures.map((f) => f.id)),
    moment: {
      ...EMPTY_MOMENT,
      note: "Added label points",
      track: "operation-label-points",
      putFeatures,
    },
  };
}
