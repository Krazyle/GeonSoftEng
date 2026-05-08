import polyline from "@mapbox/polyline";
import { EitherAsync } from "purify-ts/EitherAsync";
import type { Feature, FeatureCollection, IFeature, LineString } from "types";
import { ConvertError } from "@/utils/errors";
import readAsText from "@/utils/read_as_text";
import type { ExportOptions, ExportResult, FileType, ImportOptions } from ".";
import { type ConvertResult, okResult, stringToBlob } from "./utils";

class CPolyline implements FileType {
  id = "polyline" as const;
  label = "Google encoded polyline";
  extensions = [] as string[];
  filenames = [] as string[];
  mimes = [] as string[];
  forwardBinary(file: ArrayBuffer, _options: ImportOptions) {
    return readAsText(file).chain((text) => {
      return Polyline.forwardString(text);
    });
  }
  forwardString(text: string) {
    return EitherAsync<ConvertError, ConvertResult>(
      async function forwardPolyline() {
        const geojson = polyline.toGeoJSON(text);
        return okResult({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: geojson,
            },
          ],
        });
      },
    );
  }
  back({ geojson }: { geojson: FeatureCollection }, _options?: ExportOptions) {
    return EitherAsync<ConvertError, ExportResult>(async function backPolyline({
      throwE,
    }) {
      const lineStringFeature = geojson.features.find((feature) => {
        return feature.geometry?.type === "LineString";
      }) as IFeature<LineString>;

      if (!lineStringFeature) {
        return throwE(
          new ConvertError("Data does not contain a LineString to convert"),
        );
      }

      return {
        blob: stringToBlob(polyline.fromGeoJSON(lineStringFeature.geometry)),
        name: "line.poly",
      };
    });
  }
  featureToString(feature: Feature) {
    return EitherAsync<ConvertError, string>(
      async function featureToStringPolyline({ throwE }) {
        const { geometry } = feature;
        if (geometry?.type !== "LineString") {
          return throwE(
            new ConvertError("Can only convert lines to polylines"),
          );
        }
        return polyline.fromGeoJSON(geometry);
      },
    );
  }
}

export const Polyline = new CPolyline();
