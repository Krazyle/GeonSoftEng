import type { Operation } from "fast-json-patch";
import { applyPatch } from "fast-json-patch";
import cloneDeep from "lodash/cloneDeep";
import type { Feature, FeatureMap, FolderMap } from "types";
import { USelection } from "@/stores/index";
import type { Data, Sel, SelFolder, SelMulti, SelSingle } from "@/stores/jotai";
import { getFoldersInTree } from "@/utils/folder";
import { removeDegenerates } from "@/utils/geometry";
import { idToJSONPointers } from "@/utils/id";
import { EMPTY_MOMENT, type Moment } from "@/utils/persistence/moment";
import * as jsonpointer from "@/utils/pointer";

interface DeleteResult {
  newSelection: Sel;
  moment: Moment;
}

export function removeCoordinatesVertex(
  id: VertexId,
  feature: Feature,
): Feature | null {
  const [pointer] = idToJSONPointers(id, feature);
  feature = jsonpointer.clone(feature, pointer);
  const patch: Operation = {
    op: "remove",
    path: pointer,
  };
  applyPatch(feature, [patch]);
  if (feature.geometry === null) return null;
  const geom = removeDegenerates(feature.geometry);
  return geom
    ? {
        ...feature,
        geometry: geom,
      }
    : null;
}

function sortParts(parts: readonly VertexId[]): VertexId[] {
  return parts.slice().sort((a, b) => b.vertex - a.vertex);
}

function deleteFolder(
  selection: SelFolder,
  featureMap: FeatureMap,
  folderMap: FolderMap,
): DeleteResult {
  const folderId = selection.id;

  const toDelete = getFoldersInTree(folderMap, folderId);
  const deleteFeatures: Moment["deleteFeatures"] = [];
  for (const feature of featureMap.values()) {
    if (feature.folderId && toDelete.has(feature.folderId)) {
      deleteFeatures.push(feature.id);
    }
  }

  return {
    newSelection: USelection.none(),
    moment: {
      ...EMPTY_MOMENT,
      note: "Deleted a folder of features",
      deleteFolders: [...toDelete],
      deleteFeatures,
    },
  };
}

function deleteSingleAndMulti(
  selection: SelSingle | SelMulti,
  featureMap: FeatureMap,
): DeleteResult {
  if (selection.type === "single" && selection.parts.length) {
    const wrappedFeature = featureMap.get(selection.id);
    if (!wrappedFeature) {
      return {
        newSelection: USelection.none(),
        moment: EMPTY_MOMENT,
      };
    }
    let feature: Feature | null = cloneDeep(wrappedFeature.feature);
    const sortedParts = sortParts(selection.parts);
    for (const id of sortedParts) {
      feature = removeCoordinatesVertex(id, feature);
      if (feature === null) {
        return {
          newSelection: USelection.none(),
          moment: {
            ...EMPTY_MOMENT,
            note: "Deleted a feature",
            deleteFeatures: [selection.id],
          },
        };
      }
    }
    return {
      newSelection: USelection.single(selection.id),
      moment: {
        ...EMPTY_MOMENT,
        note: "Deleted features",
        putFeatures: [
          {
            ...wrappedFeature,
            feature,
          },
        ],
      },
    };
  }

  const ids = USelection.toIds(selection);
  if (ids.length === 0) {
    return {
      newSelection: USelection.none(),
      moment: EMPTY_MOMENT,
    };
  }

  return {
    newSelection: USelection.none(),
    moment: {
      ...EMPTY_MOMENT,
      note: "Deleted features",
      deleteFeatures: ids.slice(),
    },
  };
}

export function deleteFeatures({
  featureMap,
  selection,
  folderMap,
}: Data): DeleteResult {
  switch (selection.type) {
    case "folder": {
      return deleteFolder(selection, featureMap, folderMap);
    }
    case "none": {
      return {
        newSelection: USelection.none(),
        moment: EMPTY_MOMENT,
      };
    }
    case "multi":
    case "single": {
      return deleteSingleAndMulti(selection, featureMap);
    }
  }
}
