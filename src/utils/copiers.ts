import type { Either } from "purify-ts/Either";
import { Right } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";
import type { IFeature } from "types";
import { BBOX } from "./convert/bbox";
import { CoordinateString } from "./convert/coordinate_string";
import { Polyline } from "./convert/polyline";
import { WKT } from "./convert/wkt";
import type { AppError } from "./errors";
import { ConvertError } from "./errors";

export const COPIERS: Record<
  "wkt" | "geojson" | "geohash" | "coordinates" | "polyline" | "bbox",
  (arg0: IFeature) => Promise<Either<AppError, string>>
> = {
  wkt: async (feature) => {
    return WKT.featureToString(feature).run();
  },
  geojson: (feature) => {
    return Promise.resolve(Right(JSON.stringify(feature)));
  },
  geohash: async (feature) => {
    return await EitherAsync(async function copyGeohash({ throwE }) {
      const geometry = feature.geometry;
      if (geometry.type !== "Point") {
        return throwE(
          new ConvertError("Only Point features can be copied as geohash"),
        );
      }
      const geohash = await import("@/lib/geohash");
      return geohash.encode(geometry.coordinates as [number, number]);
    });
  },
  coordinates: (feature) => {
    return Promise.resolve(CoordinateString.featureToString(feature));
  },
  bbox: async (feature) => {
    return BBOX.featureToString(feature).run();
  },
  polyline: async (feature) => {
    return Polyline.featureToString(feature).run();
  },
};
