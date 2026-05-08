import {
  type CollisionDescriptor,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { ClientRect, Coordinates } from "@dnd-kit/core/dist/types";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { useAtomValue } from "jotai";
import isEqual from "lodash/isEqual";
import { Portal } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FolderMap } from "types";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import { dataAtom, type Sel, splitsAtom } from "@/stores/jotai";
import { LEFT_PANEL_ROW_HEIGHT } from "@/utils/constants";
import { usePersistence } from "@/utils/persistence/context";
import { FeatureEditorFolderHeader } from "./feature_editor_folder/header";
import { useCustomSensors } from "./feature_editor_folder/hooks";
import { OverlayItem, SortableItem } from "./feature_editor_folder/items";
import {
  type FlattenedItem,
  getProjection,
  getRequiredExpansionsFeature,
  indentationWidth,
  useFlattenedItems,
} from "./feature_editor_folder/math";
import { virtualPosition } from "./feature_editor_folder/utils";

function verticalCenterOfRectangle(rect: ClientRect): number {
  return rect.top + rect.height * 0.5;
}

const closestVerticalCenter: CollisionDetection = ({
  pointerCoordinates,
  droppableRects,
  droppableContainers,
}) => {
  const centerRect = pointerCoordinates?.y || 0;
  let closest: CollisionDescriptor | null = null;

  for (const droppableContainer of droppableContainers) {
    const { id } = droppableContainer;
    const rect = droppableRects.get(id);

    if (rect) {
      const distBetween = Math.abs(
        verticalCenterOfRectangle(rect) - centerRect,
      );

      if (!closest || distBetween < closest.data.value) {
        closest = { id, data: { droppableContainer, value: distBetween } };
      }
    }
  }

  return closest ? [closest] : [];
};

const SHRINKAGE = 3;

function isPointWithinRect(point: Coordinates, rect: ClientRect): boolean {
  const top = rect.top + SHRINKAGE;
  const bottom = rect.bottom - SHRINKAGE;

  return top <= point.y && point.y <= bottom;
}

const customPointerWithin = (
  {
    droppableContainers,
    droppableRects,
    pointerCoordinates,
  }: Parameters<CollisionDetection>[0],
  folderMap: FolderMap,
): CollisionDescriptor[] | null => {
  if (!pointerCoordinates) {
    return null;
  }

  for (const droppableContainer of droppableContainers) {
    const { id } = droppableContainer;

    if (!folderMap.has(id as string)) continue;

    const rect = droppableRects.get(id);

    if (rect && isPointWithinRect(pointerCoordinates, rect)) {
      return [
        {
          id,
          data: { droppableContainer, value: 1, dropIntoFolder: true },
        },
      ];
    }
  }

  return null;
};

export function FeatureEditorFolder() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.leftOpen) return null;
  return (
    <div
      style={{
        width: splits.left,
      }}
      className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-900 relative"
    >
      <div className="absolute inset-0 flex flex-col">
        <FeatureEditorFolderInner />
      </div>
    </div>
  );
}

function findBeforeAt({
  newIndex,
  myDepth,
  sortedItems,
}: {
  newIndex: number;
  myDepth: number;
  sortedItems: FlattenedItem[];
}) {
  for (let i = newIndex - 1; i >= 0; i--) {
    if (sortedItems[i].depth < myDepth) {
      break;
    } else if (sortedItems[i].depth === myDepth) {
      return sortedItems[i].at;
    } else {
    }
  }
  return null;
}

function findAfterAt({
  newIndex,
  myDepth,
  sortedItems,
}: {
  newIndex: number;
  myDepth: number;
  sortedItems: FlattenedItem[];
}) {
  for (let i = newIndex + 1; i < sortedItems.length; i++) {
    if (sortedItems[i].depth < myDepth) {
      break;
    } else if (sortedItems[i].depth === myDepth) {
      return sortedItems[i].at;
    } else {
    }
  }
  return null;
}

export function FeatureEditorFolderInner() {
  const data = useAtomValue(dataAtom);
  const { featureMap, folderMap, selection } = data;
  const rep = usePersistence();
  const [meta] = rep.useMetadata();
  const transact = rep.useTransact();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [dropIntoFolder, setDropIntoFolder] = useState<boolean>(false);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const parentRef = useRef<HTMLDivElement | null>(null);

  const sensors = useCustomSensors();

  const treeCurrentValueRef = useRef<FlattenedItem[]>([]);

  const tree = useFlattenedItems({ data, activeId });

  treeCurrentValueRef.current = tree;

  const projected =
    activeId && overId
      ? getProjection({
          tree,
          activeId,
          overId,
          offsetLeft,
          indentationWidth,
          dropIntoFolder,
        })
      : null;

  const activeItemIndex = useMemo(() => {
    return tree.findIndex(({ id }) => id === activeId);
  }, [tree, activeId]);

  const rowVirtualizer = useVirtualizer({
    count: tree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        return index === activeItemIndex ? 0 : LEFT_PANEL_ROW_HEIGHT;
      },
      [activeItemIndex],
    ),
    overscan: 10,
  });

  const { scrollToIndex } = rowVirtualizer;
  const lastSelection = useRef<Sel | null>(null);

  useEffect(() => {
    if (
      selection.type === "none" ||
      isEqual(selection, lastSelection.current)
    ) {
      return;
    }

    switch (selection.type) {
      case "single": {
        const expansions = getRequiredExpansionsFeature(selection, data);

        if (expansions.length) {
          void transact({
            note: "Auto-expand folders",
            putFolders: expansions.map((folder) => {
              return {
                ...folder,
                expanded: true,
              };
            }),
          });

          return;
        }

        const idx = tree.findIndex((item) => {
          return item.kind === "feature" && item.id === selection.id;
        });
        if (idx !== null && idx !== -1) {
          scrollToIndex(idx);
        }
        break;
      }
      case "folder": {
        const idx = tree.findIndex((item) => {
          return item.kind === "folder" && item.id === selection.id;
        });
        if (idx !== null && idx !== -1) {
          scrollToIndex(idx);
        }
        break;
      }
      case "multi": {
        break;
      }
    }

    lastSelection.current = selection;
  }, [tree, selection, scrollToIndex, data, transact]);

  const customCollisionDetectionAlgorithm: CollisionDetection = useCallback(
    (args) => {
      const pointerCollision = customPointerWithin(args, folderMap);

      if (pointerCollision) {
        return pointerCollision;
      }

      const closest = closestVerticalCenter(args);
      return closest;
    },
    [folderMap, folderMap.version],
  );

  function resetState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    setOverId(event.active.id);
  }

  function handleDragOver(evt: DragOverEvent) {
    const { over } = evt;
    setOverId(over?.id ?? null);
    setDropIntoFolder(
      !!(
        evt?.collisions?.length === 1 &&
        evt?.collisions?.[0].data?.dropIntoFolder
      ),
    );
  }

  function handleDragMove(evt: DragMoveEvent) {
    const { delta } = evt;
    setOffsetLeft(delta.x);
    setDropIntoFolder(
      !!(
        evt?.collisions?.length === 1 &&
        evt?.collisions?.[0].data?.dropIntoFolder
      ),
    );
  }

  function handleDragEnd(evt: DragEndEvent) {
    const { active, over } = evt;
    resetState();

    if (projected && over) {
      const { depth, folderId } = projected;
      const clonedItems: FlattenedItem[] = tree.slice();
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];
      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newIndex = sortedItems.findIndex((item) => item.id === active.id);
      const myDepth = depth;

      const beforeAt = findBeforeAt({ newIndex, myDepth, sortedItems });
      const afterAt = findAfterAt({ newIndex, myDepth, sortedItems });

      let at = activeTreeItem.at;

      try {
        at = generateKeyBetween(beforeAt, afterAt);
      } catch (e) {
        captureException(e);
      }

      switch (activeTreeItem.kind) {
        case "feature": {
          if (selection.type === "multi") {
            try {
              const wrappedFeatures = USelection.getSelectedFeatures(data);
              const ats = generateNKeysBetween(
                beforeAt,
                afterAt,
                wrappedFeatures.length,
              );
              void transact({
                note: "Changed the order of features",
                putFeatures: wrappedFeatures.map((wrappedFeature, i) => {
                  return {
                    ...wrappedFeature,
                    at: ats[i],
                    folderId,
                  };
                }),
              });
            } catch (e) {
              captureException(e);
            }
          } else {
            void transact({
              note: "Changed the order of a feature",
              putFeatures: [
                {
                  ...activeTreeItem.data,
                  at,
                  folderId,
                },
              ],
            });
          }
          break;
        }
        case "folder": {
          void transact({
            note: "Changed the order of a folder",
            putFolders: [
              {
                ...activeTreeItem.data,
                at,
                folderId,
              },
            ],
          });
          break;
        }
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetectionAlgorithm}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <FeatureEditorFolderHeader featureMap={featureMap} />
      <SortableContext items={tree} strategy={verticalListSortingStrategy}>
        <div
          ref={parentRef}
          data-keybinding-scope="editor_folder"
          className="app-scrollbar overflow-y-scroll flex-auto group"
        >
          <div
            className="relative w-full"
            style={{
              willChange: "transform",
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((row) => {
              const item = tree[row.index];
              const isDragging = activeId === item.id;
              if (isDragging && dropIntoFolder) {
                return null;
              }
              return (
                <div key={row.index} style={virtualPosition(row)}>
                  <SortableItem
                    key={item.id}
                    id={item.id}
                    treeCurrentValueRef={treeCurrentValueRef}
                    depth={
                      item.id === activeId && projected
                        ? projected.depth
                        : item.depth
                    }
                    highlight={dropIntoFolder && overId === item.id}
                    item={item}
                    preview={meta.label}
                    isDragging={isDragging}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </SortableContext>
      <Portal.Root>
        <DragOverlay dropAnimation={null} className="bg-transparent">
          {activeId ? (
            <OverlayItem
              preview={meta.label}
              id={activeId}
              treeCurrentValueRef={treeCurrentValueRef}
              item={tree.find((item) => item.id === activeId)!}
            />
          ) : null}
        </DragOverlay>
      </Portal.Root>
    </DndContext>
  );
}
