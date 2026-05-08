import { geoJSONToWkt, wktToGeoJSON } from "betterknown";
import { EitherAsync } from "purify-ts/EitherAsync";
import { Maybe } from "purify-ts/Maybe";
import type { Feature } from "types";
import { ConvertError } from "@/utils/errors";
import readAsText from "@/utils/read_as_text";
import { rough } from "@/utils/roughly_geojson";
import type { FileType } from ".";
import type { ConvertResult } from "./utils";

class CWKT implements FileType {
  id = "wkt" as const;
  label = "WKT";
  extensions = [] as string[];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer) {
    return readAsText(file).chain((text) => {
      return this.forwardString(text);
    });
  }
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(async function forwardWkt({
      liftEither,
    }) {
      const proj = await import("proj4");
      const geojson = await liftEither(
        Maybe.encase(() => {
          return wktToGeoJSON(text, {
            proj: (a, b, coord) => {
              return proj.default(a, b, coord);
            },
          });
        })
          .chainNullable((x) => x)
          .toEither(new ConvertError("Could not convert WKT"))
          .chain((geojson) => rough(geojson)),
      );
      return geojson;
    });
  }
  featureToString(geojson: Feature) {
    return EitherAsync<ConvertError, string>(
      async function featureToStringWkt() {
        if (geojson.geometry === null) return "";
        return Maybe.fromNullable(geoJSONToWkt(geojson.geometry)).orDefault("");
      },
    );
  }
}

export const WKT = new CWKT();
