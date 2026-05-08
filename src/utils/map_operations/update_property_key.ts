import type { Feature } from "types";
import renameProperty from "@/utils/rename_property";

export function updatePropertyKey(
  feature: Feature,
  {
    key,
    newKey,
  }: {
    key: string;
    newKey: string;
  },
): Feature {
  return {
    ...feature,
    properties: renameProperty(feature.properties, key, newKey),
  };
}
