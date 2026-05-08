import { Either, Left } from "purify-ts/Either";
import type { IWrappedFeature } from "types";
import { GreatCircle } from "@/lib/arc";
import { USelection } from "@/stores";
import type { Sel } from "@/stores/jotai";
import { GeometryError } from "@/utils/errors";
import { newFeatureId } from "@/utils/id";
import { EMPTY_MOMENT, type MomentInput } from "@/utils/persistence/moment";

export function drawArc(
  features: IWrappedFeature[],
): Either<GeometryError, { newSelection: Sel; moment: MomentInput }> {
  if (features.length !== 2) {
    return Left(new GeometryError("Two features required"));
  }
  const [
    {
      feature: { geometry: a },
    },
    {
      feature: { geometry: b },
    },
  ] = features;

  if (!(a?.type === "Point" && b?.type === "Point")) {
    return Left(
      new GeometryError("Both geometries must be points to create an arc"),
    );
  }
  return Either.encase(() => {
    const arc = new GreatCircle(
      a.coordinates as Pos2,
      b.coordinates as Pos2,
    ).arc(100);
    const id = newFeatureId();
    return {
      newSelection: USelection.single(id),
      moment: {
        ...EMPTY_MOMENT,
        note: "Drew an arc",
        track: "operation-arc",
        putFeatures: [
          {
            id,
            feature: {
              type: "Feature",
              properties: {},
              geometry: arc,
            },
            folderId: features[0].folderId,
          },
        ],
      },
    };
  });
}
