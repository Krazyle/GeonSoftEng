import { Right } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";
import type { FeatureMap } from "types";
import type { ConvertError } from "@/utils/errors";
import { parseOrError } from "@/utils/errors";
import readAsText from "@/utils/read_as_text";
import { rough } from "@/utils/roughly_geojson";
import type { ExportOptions, FileType, ImportOptions } from ".";
import { geojsonToString } from "./local/geojson";
import { type ConvertResult, stringToBlob } from "./utils";

class CGeoJSON implements FileType {
  id = "geojson" as const;
  label = "GeoJSON";
  extensions = [".geojson", ".json"];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer, options?: ImportOptions) {
    return readAsText(file).chain((text) => {
      return this.forwardString(text, options);
    });
  }
  forwardString(text: string, options?: ImportOptions) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardGeoJSON({ liftEither }) {
        const object = await liftEither(parseOrError(text));
        const geojson = await liftEither(
          rough(object, {
            removeCoincidents: options?.removeCoincidents !== false,
          }),
        );
        return geojson;
      },
    );
  }
  back({ featureMap }: { featureMap: FeatureMap }, options: ExportOptions) {
    return EitherAsync.liftEither(
      Right({
        blob: stringToBlob(geojsonToString(featureMap, options.geojsonOptions)),
        name: "features.geojson",
      }),
    );
  }
}

export const GeoJSON = new CGeoJSON();
