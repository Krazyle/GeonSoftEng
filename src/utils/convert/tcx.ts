import { EitherAsync } from "purify-ts/EitherAsync";
import type { FeatureCollection } from "types";
import type { ConvertError } from "@/utils/errors";
import readAsText from "@/utils/read_as_text";
import type { FileType } from ".";
import { type ConvertResult, okResult, toDom } from "./utils";

class CTCX implements FileType {
  id = "tcx" as const;
  label = "TCX";
  extensions = [".tcx"];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer) {
    return readAsText(file).chain((text) => TCX.forwardString(text));
  }
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardTcx() {
        const tcx = await import("@tmcw/togeojson").then(
          (module) => module.tcx,
        );
        const geojson = tcx((await toDom(text)) as unknown as Document);
        return okResult(geojson as FeatureCollection);
      },
    );
  }
}

export const TCX = new CTCX();
