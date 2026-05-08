import { EitherAsync } from "purify-ts/EitherAsync";
import type { FeatureCollection, FeatureMap, FolderMap } from "types";
import { flattenResult } from "@/features/dialogs/components/import_utils";
import { solveRootItems } from "@/features/panels/components/feature_editor/feature_editor_folder/math";
import { ConvertError } from "@/utils/errors";
import readAsText from "@/utils/read_as_text";
import type { ExportOptions, ExportResult, FileType, ImportOptions } from ".";
import { type ConvertResult, stringToBlob, toDom } from "./utils";

class CKML implements FileType {
  id = "kml" as const;
  label = "KML";
  extensions = [".kml"];
  filenames = [] as string[];
  mimes = ["application/vnd.google-earth.kml+xml"];
  forwardBinary(file: ArrayBuffer, _options: ImportOptions) {
    return readAsText(file).chain((text) => {
      return KML.forwardString(text);
    });
  }
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardKML() {
        const toGeoJSON = await import("@tmcw/togeojson");
        const dom = await toDom(text);
        const root = toGeoJSON.kmlWithFolders(dom as unknown as Document);
        return {
          type: "root",
          notes: [],
          root,
        };
      },
    );
  }
  back(
    {
      geojson: _ignore,
      featureMap,
      folderMap,
    }: {
      geojson: FeatureCollection;
      featureMap: FeatureMap;
      folderMap: FolderMap;
    },
    _options: ExportOptions,
  ) {
    return EitherAsync<ConvertError, ExportResult>(async ({ throwE }) => {
      const tokml = await import("tokml").then((m) => m.default || m);
      try {
        const root = solveRootItems(featureMap, folderMap);
        const fc = flattenResult({ type: "root", root, notes: [] });
        return {
          blob: stringToBlob(tokml(fc)),
          name: "features.kml",
        };
      } catch (_e) {
        return throwE(new ConvertError("Could not convert to KML"));
      }
    });
  }
}

export const KML = new CKML();
