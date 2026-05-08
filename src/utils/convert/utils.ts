import type { Root } from "@tmcw/togeojson";
import type { FeatureCollection } from "types";

export function getExtension(path: string) {
  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;

  let preDotState = 0;
  for (let i = path.length - 1; i >= 0; --i) {
    const code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46) {
      if (startDot === -1) startDot = i;
      else if (preDotState !== 1) preDotState = 1;
    } else if (startDot !== -1) {
      preDotState = -1;
    }
  }

  if (
    startDot === -1 ||
    end === -1 ||
    preDotState === 0 ||
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    return "";
  }
  return path.slice(startDot, end).toLowerCase();
}

export async function toDom(str: string) {
  const xmldom = await import("@xmldom/xmldom");
  return new xmldom.DOMParser().parseFromString(str, "text/xml");
}

export function stringToBlob(str: string) {
  return new Blob([str], { type: "text/plain" });
}

export interface GeoJSONResult {
  type: "geojson";
  geojson: FeatureCollection;
  notes: string[];
}

export interface RootResult {
  type: "root";
  root: Root;
  notes: string[];
}

export type ConvertResult = GeoJSONResult | RootResult;

export function okResult(geojson: FeatureCollection): ConvertResult {
  return {
    type: "geojson",
    geojson,
    notes: [],
  };
}
