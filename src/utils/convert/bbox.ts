import { EitherAsync } from "purify-ts/EitherAsync";
import { Maybe } from "purify-ts/Maybe";
import type { Feature } from "types";
import type { ConvertError } from "@/utils/errors";
import { bboxToPolygon, e6bbox, getExtent, parseBBOX } from "@/utils/geometry";
import readAsText from "@/utils/read_as_text";
import { eitherToAsync } from "@/utils/utils";
import type { FileType, ImportOptions } from ".";
import { okResult } from "./utils";

class CBBOX implements FileType {
  id = "bbox" as const;
  label = "BBOX";
  extensions = [] as string[];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardString(text: string, _options?: ImportOptions) {
    return eitherToAsync(
      parseBBOX(text).map((bbox) => {
        return okResult({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: bboxToPolygon(bbox),
              properties: {},
            },
          ],
        });
      }),
    );
  }
  featureToString(feature: Feature) {
    return EitherAsync<ConvertError, string>(function featureToStringBbox() {
      const { geometry } = feature;
      const bbox = Maybe.fromNullable(geometry).chain(getExtent);
      return Promise.resolve(bbox.mapOrDefault(e6bbox, ""));
    });
  }
  forwardBinary(file: ArrayBuffer, options: ImportOptions) {
    return readAsText(file).chain((text) => {
      return this.forwardString(text, options);
    });
  }
}

export const BBOX = new CBBOX();
