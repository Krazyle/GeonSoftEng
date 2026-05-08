import { useMemo } from "react";
import type { FeatureMap, IFolder, IWrappedFeature } from "types";
import type { VirtualColumns } from "@/stores/jotai";

export function getFn(obj: IWrappedFeature, path: string | string[]) {
  if (Array.isArray(path)) {
    path = path[0];
  }
  const val = obj.feature.properties?.[path];
  if (val === undefined) return "";
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

type FolderId = IFolder["id"];

interface ColumnsArgs {
  featureMap: FeatureMap;
  folderId: FolderId | null;
  virtualColumns: VirtualColumns;
}

export function getColumns({
  featureMap,
  folderId,
  virtualColumns,
}: ColumnsArgs) {
  const columns = new Set<string>();

  for (const { feature, folderId: id } of featureMap.values()) {
    if (folderId === null || folderId === id) {
      if (feature.properties === null) continue;
      for (const name in feature.properties) {
        columns.add(name);
      }
    }
  }

  for (const col of virtualColumns) {
    columns.add(col);
  }

  return Array.from(columns);
}

export function useColumns({
  featureMap,
  folderId,
  virtualColumns,
}: ColumnsArgs) {
  return useMemo(() => {
    return getColumns({
      featureMap,
      folderId,
      virtualColumns,
    });
  }, [featureMap, featureMap.version, folderId, virtualColumns]);
}
