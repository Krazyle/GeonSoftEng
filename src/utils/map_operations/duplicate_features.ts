import type { IWrappedFeature } from "types";
import { USelection } from "@/stores/index";
import type { Data, Sel } from "@/stores/jotai";
import { getFoldersInTree } from "@/utils/folder";
import { newFeatureId } from "@/utils/id";
import { EMPTY_MOMENT, type Moment } from "@/utils/persistence/moment";

interface DuplicateResult {
  newSelection: Sel;
  moment: Moment;
}

function duplicateFeaturesSimple(features: IWrappedFeature[]): DuplicateResult {
  const putFeatures = features.map((feature) => {
    return {
      ...feature,
      id: newFeatureId(),
    };
  });
  return {
    moment: {
      ...EMPTY_MOMENT,
      note: "Duplicated features",
      putFeatures,
    },
    newSelection: USelection.fromIds(putFeatures.map((f) => f.id)),
  };
}

function duplicateFolder(data: Data, folderId: string): DuplicateResult {
  const folders = getFoldersInTree(data.folderMap, folderId);

  const idRemap = new Map<string, string>();

  for (const id of folders) {
    idRemap.set(id, newFeatureId());
  }

  const putFolders: Moment["putFolders"] = [];

  for (const id of folders) {
    const folder = data.folderMap.get(id);
    if (folder) {
      putFolders.push({
        ...folder,
        id: idRemap.get(id)!,
        folderId:
          folder.folderId === null
            ? null
            : idRemap.get(folder.folderId) || folder.folderId,
      });
    }
  }

  const putFeatures: Moment["putFeatures"] = [];

  for (const feature of data.featureMap.values()) {
    if (feature.folderId && folders.has(feature.folderId)) {
      putFeatures.push({
        ...feature,
        id: newFeatureId(),
        folderId: feature.folderId ? idRemap.get(feature.folderId)! : null,
      });
    }
  }

  return {
    moment: {
      ...EMPTY_MOMENT,
      note: "Duplicated features",
      putFeatures,
      putFolders,
    },
    newSelection: USelection.folder(idRemap.get(folderId)!),
  };
}

export function duplicateFeatures(data: Data): DuplicateResult {
  switch (data.selection.type) {
    case "folder": {
      return duplicateFolder(data, data.selection.id);
    }
    case "none": {
      return {
        newSelection: USelection.none(),
        moment: EMPTY_MOMENT,
      };
    }
    case "multi":
    case "single": {
      return duplicateFeaturesSimple(USelection.getSelectedFeatures(data));
    }
  }
}
