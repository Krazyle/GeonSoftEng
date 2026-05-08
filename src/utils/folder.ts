import type { FeatureMap, FolderMap, IFolder, IWrappedFeature } from "types";

type FolderByFolderMap = Map<string | null, IFolder[]>;

export function collectDescendents(
  folderId: string,
  idMap: FolderByFolderMap,
  exclude: Set<string>,
) {
  for (const child of idMap.get(folderId) ?? []) {
    exclude.add(child.id);
    collectDescendents(child.id, idMap, exclude);
  }
  return exclude;
}

export function generateExclude(folderMap: FolderMap): Set<string> {
  const idMap = collectFoldersByFolder(folderMap);
  const exclude = new Set<string>();
  for (const folder of folderMap.values()) {
    if (folder.visibility === false) {
      exclude.add(folder.id);
      collectDescendents(folder.id, idMap, exclude);
    }
  }
  return exclude;
}

export const collectFoldersByFolder = (folderMap: FolderMap) => {
  const foldersByFolder = new Map<string | null, IFolder[]>();
  for (const folder of folderMap.values()) {
    const group = foldersByFolder.get(folder.folderId) || [];
    group.push(folder);
    foldersByFolder.set(folder.folderId, group);
  }
  return foldersByFolder;
};

export const generateLockedSet = (folderMap: FolderMap): Set<string> => {
  const idMap = collectFoldersByFolder(folderMap);
  const exclude = new Set<string>();
  for (const folder of folderMap.values()) {
    if (folder.locked) {
      exclude.add(folder.id);
      collectDescendents(folder.id, idMap, exclude);
    }
  }
  return exclude;
};

export function getFoldersInTree(
  folderMap: FolderMap,
  folderId: string,
): Set<string> {
  const set = new Set<string>([folderId]);
  const idMap = collectFoldersByFolder(folderMap);
  collectDescendents(folderId, idMap, set);
  return set;
}

export function isFeatureLocked(
  feature: IWrappedFeature,
  folderMap: FolderMap,
): boolean {
  if (!feature.folderId) return false;

  let parentFolder = folderMap.get(feature.folderId);

  while (parentFolder) {
    if (parentFolder.locked) return true;
    if (!parentFolder.folderId) return false;
    parentFolder = folderMap.get(parentFolder.folderId);
  }

  return false;
}

export function filterLockedFeatures({
  featureMap,
  folderMap,
}: {
  featureMap: FeatureMap;
  folderMap: FolderMap;
}) {
  const lockedSet = generateLockedSet(folderMap);
  const exclude = generateExclude(folderMap);

  const features: IWrappedFeature[] = [];
  for (const feature of featureMap.values()) {
    if (feature.feature.properties?.visibility === false) {
      continue;
    }
    if (
      !feature.folderId ||
      (!exclude.has(feature.folderId) && !lockedSet.has(feature.folderId))
    ) {
      features.push(feature);
    }
  }

  return features;
}
