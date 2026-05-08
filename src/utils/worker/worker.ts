import * as Comlink from "comlink";
import geojsonhint from "geojsonhint";
import { bufferFeature } from "@/utils/buffer";
import { fileToGeoJSON, fromGeoJSON } from "@/utils/convert";
import { booleanFeatures } from "@/utils/map_operations/boolean_features";
import { EitherHandler } from "./shared";

const lib = {
  getIssues: (json: string) => geojsonhint.hint(json),
  bufferFeature,
  booleanFeatures,
  fileToGeoJSON,
  fromGeoJSON,
};

export type Lib = typeof lib;

Comlink.transferHandlers.set("EITHER", EitherHandler);
Comlink.expose(lib);
