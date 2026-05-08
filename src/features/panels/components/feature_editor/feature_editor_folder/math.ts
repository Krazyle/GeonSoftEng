import type { UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Root, Folder as TFolder } from "@tmcw/togeojson";
import { useMemo } from "react";
import type {
  Feature,
  FeatureMap,
  FolderMap,
  IFolder,
  IWrappedFeature,
} from "types";
import type { Data, SelSingle } from "@/stores/jotai";
import { collectFoldersByFolder } from "@/utils/folder";
import { sortByAt } from "@/utils/parse_stored";

export const indentationWidth = 16;

export interface FlattenedFolder {
  kind: "folder";
  at: string;
  id: string;
  data: IFolder;
  depth: number;
}

export interface FlattenedFeature {
  kind: "feature";
  at: string;
  data: IWrappedFeature;
  id: string;
  depth: number;
}

interface Sortable {
  at: string;
  id: string;
  data: Feature | TFolder;
}

export type FlattenedItem = FlattenedFolder | FlattenedFeature;

function folderToFlat(folder: IFolder, depth: number): FlattenedFolder {
  return {
    at: folder.at,
    id: folder.id,
    kind: "folder",
    depth,
    data: folder,
  };
}

function featureToFlat(
  feature: IWrappedFeature,
  depth: number,
): FlattenedFeature {
  return {
    at: feature.at,
    id: feature.id,
    kind: "feature",
    depth,
    data: feature,
  };
}

function collectFeaturesByFolder(featureMap: FeatureMap) {
  const featuresByFolder = new Map<string | null, IWrappedFeature[]>();
  for (const feature of featureMap.values()) {
    const group = featuresByFolder.get(feature.folderId) || [];
    group.push(feature);
    featuresByFolder.set(feature.folderId, group);
  }
  return featuresByFolder;
}

export function solveRootItems(
  featureMap: FeatureMap,
  folderMap: FolderMap,
): Root {
  const featuresByFolder = collectFeaturesByFolder(featureMap);
  const foldersByFolder = collectFoldersByFolder(folderMap);

  function getChildren(folderId: string | null): Array<TFolder | Feature> {
    const features = (featuresByFolder.get(folderId) ?? []).map(
      (wrappedFeature): Sortable => {
        return {
          id: wrappedFeature.id,
          at: wrappedFeature.at,
          data: wrappedFeature.feature,
        };
      },
    );
    const folders = (foldersByFolder.get(folderId) ?? []).map(
      (folder): Sortable => {
        const children = getChildren(folder.id);
        const count = children.filter(
          (child) => child.type === "Feature",
        ).length;
        return {
          at: folder.at,
          id: folder.id,
          data: {
            type: "folder",
            meta: {
              id: folder.id,
              count,
              name: folder.name,
            },
            children,
          },
        };
      },
    );

    const items = sortByAt([...features, ...folders]).map((item) => item.data);

    return items;
  }

  return {
    type: "root",
    children: getChildren(null),
  };
}

export function useRootItems({
  folderMap,
  featureMap,
}: {
  folderMap: FolderMap;
  featureMap: FeatureMap;
}): Root {
  return useMemo(() => {
    return solveRootItems(featureMap, folderMap);
  }, [featureMap, featureMap.version, folderMap, folderMap.version]);
}

function getLevel(
  folderId: string | null,
  depth: number,
  featuresByFolder: ReturnType<typeof collectFeaturesByFolder>,
  foldersByFolder: ReturnType<typeof collectFoldersByFolder>,
  activeId: UniqueIdentifier | null,
) {
  let items: FlattenedItem[] = [];
  const folders = foldersByFolder.get(folderId) ?? [];
  const features = featuresByFolder.get(folderId) ?? [];

  function pushFeature(feature: IWrappedFeature, depth: number) {
    items.push(featureToFlat(feature, depth));
    featureI++;
  }

  function pushFolder(folder: IFolder, depth: number) {
    items.push(folderToFlat(folder, depth));
    folderI++;
  }

  let folderI = 0;
  let featureI = 0;
  while (folderI < folders.length || featureI < features.length) {
    const headFolder = folders[folderI];
    const headFeature = features[featureI];

    if (!headFolder) {
      pushFeature(headFeature, depth);
    } else if (!headFeature) {
      pushFolder(headFolder, depth);
    } else if (headFeature.at < headFolder.at) {
      pushFeature(headFeature, depth);
    } else {
      pushFolder(headFolder, depth);
    }
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind !== "folder") continue;
    const folder = item.data;

    const hideChildren = !folder.expanded || activeId === folder.id;
    if (!hideChildren) {
      const children = getLevel(
        folder.id,
        depth + 1,
        featuresByFolder,
        foldersByFolder,
        activeId,
      );
      if (children.length) {
        items = items
          .slice(0, i + 1)
          .concat(children)
          .concat(items.slice(i + 1));
      }
    }
  }
  return items;
}

export function useFlattenedItems({
  data,
  activeId,
}: {
  data: Data;
  activeId: UniqueIdentifier | null;
}) {
  return useMemo(() => {
    const featuresByFolder = collectFeaturesByFolder(data.featureMap);
    const foldersByFolder = collectFoldersByFolder(data.folderMap);

    return getLevel(null, 0, featuresByFolder, foldersByFolder, activeId);
  }, [data, activeId]);
}

export function useFolderSummary({
  featureMap,
  root,
}: {
  featureMap: FeatureMap;
  root: Root;
}): TFolder[] {
  return useMemo(() => {
    const items: TFolder[] = [
      {
        type: "folder",
        children: Array.from(featureMap.values()).map(
          (wrappedFeature) => wrappedFeature.feature,
        ),
        meta: {
          count: featureMap.size,
          id: null,
          name: "All",
        },
      },
    ];

    function flattenChild(child: TFolder | Feature) {
      switch (child.type) {
        case "Feature":
          break;
        case "folder": {
          const features = child.children.filter(
            (child) => child.type === "Feature",
          );
          items.push({
            ...child,
            meta: {
              ...child.meta,
              count: features.length,
            },

            children: features,
          });
          for (const c of child.children) {
            flattenChild(c);
          }
          break;
        }
      }
    }

    for (const child of root.children) {
      flattenChild(child);
    }

    return items;
  }, [root, featureMap]);
}

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

export function getProjection({
  tree,
  activeId,
  overId,
  offsetLeft,
  indentationWidth,
  dropIntoFolder,
}: {
  tree: FlattenedItem[];
  activeId: UniqueIdentifier;
  overId: UniqueIdentifier;
  offsetLeft: number;
  indentationWidth: number;
  dropIntoFolder: boolean;
}) {
  const overItemIndex = tree.findIndex(({ id }) => id === overId);
  const activeItemIndex = tree.findIndex(({ id }) => id === activeId);

  const activeItem = tree[activeItemIndex];

  const newItems = arrayMove(tree, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const dragDepth = getDragDepth(offsetLeft, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = getMaxDepth({
    previousItem,
  });
  const minDepth = getMinDepth({ nextItem });
  let depth = projectedDepth;

  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  function getParentId(): string | null {
    if (depth === 0 || !previousItem) {
      return null;
    }

    if (depth === previousItem.depth) {
      return previousItem.data.folderId;
    }

    if (depth > previousItem.depth) {
      return previousItem.id;
    }

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.data.folderId;

    return newParent ?? null;
  }

  if (dropIntoFolder) {
    return {
      depth,
      maxDepth,
      minDepth,
      folderId: String(overId),
    };
  }

  return {
    depth,
    maxDepth,
    minDepth,
    folderId: getParentId(),
  };
}

function getMaxDepth({ previousItem }: { previousItem: FlattenedItem }) {
  if (previousItem?.kind === "folder") {
    return previousItem.depth + 1;
  }

  if (previousItem?.kind === "feature") {
    return previousItem.depth;
  }

  return 0;
}

function getMinDepth({ nextItem }: { nextItem: FlattenedItem }) {
  if (nextItem) {
    return nextItem.depth;
  }

  return 0;
}

type Expansions = IFolder[];

export function getRequiredExpansionsFeature(
  selection: SelSingle,
  data: Data,
): Expansions {
  const expansions: Expansions = [];
  const feature = data.featureMap.get(selection.id);
  if (!feature) return expansions;

  let folderId = feature.folderId;

  while (folderId !== null) {
    const folder = data.folderMap.get(folderId);
    if (!folder) return expansions;

    if (!folder.expanded) {
      expansions.push(folder);
    }

    folderId = folder.folderId;
  }

  return expansions;
}
