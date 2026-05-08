import type { JsonObject, JsonValue } from "type-fest";
import type { Feature } from "types";
import { cast, recast } from "@/utils/cast";

export function updatePropertyValue(
  feature: Feature,
  {
    key,
    value,
  }: {
    key: string;
    value: JsonValue;
  },
) {
  const { properties: oldProperties } = feature;
  const properties = { ...oldProperties } as JsonObject;
  const oldValue = properties[key]!;
  if (oldValue === undefined) {
    if (typeof value === "string") {
      properties[key] = cast(value);
      return {
        ...feature,
        properties,
      };
    } else {
      properties[key] = value;
      return {
        ...feature,
        properties,
      };
    }
  } else {
    properties[key] = recast(oldValue, value);
    return {
      ...feature,
      properties,
    };
  }
}
