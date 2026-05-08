import { EitherAsync } from "purify-ts/EitherAsync";
import type { ConvertError } from "@/utils/errors";
import type { FileType, ImportOptions } from ".";
import { type ConvertResult, okResult } from "./utils";

class CGeoTIFF implements FileType {
  id = "geotiff" as const;
  label = "GeoTIFF";
  extensions = [".tif", ".tiff"];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer, _options?: ImportOptions) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardGeoTIFF() {
        const { getGeotiffExtent } = await import("@/lib/geotiff");
        const extent = await getGeotiffExtent(file);
        return okResult(extent);
      },
    );
  }
}

export const GeoTIFF = new CGeoTIFF();
