import { useSetAtom } from "jotai";
import noop from "lodash/noop";
import type maplibregl from "maplibre-gl";
import { useRef } from "react";
import type { HandlerContext } from "types";
import { useAltHeld, useSpaceHeld } from "@/hooks/use_held";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import {
  cursorStyleAtom,
  ephemeralStateAtom,
  Mode,
  selectionAtom,
} from "@/stores/jotai";
import { modeAtom, type ROUTE_TYPE } from "@/stores/mode";
import { CURSOR_DEFAULT, DECK_SYNTHETIC_ID } from "@/utils/constants";
import { filterLockedFeatures } from "@/utils/folder";
import {
  type FlatbushLike,
  generateFeaturesFlatbushInstance,
  generateVertexFlatbushInstance,
} from "@/utils/generate_flatbush_instance";
import { decodeId, encodeVertex } from "@/utils/id";
import { UIDMap } from "@/utils/id_mapper";
import * as utils from "@/utils/map_component_utils";
import * as ops from "@/utils/map_operations";
import { useEndSnapshot, useStartSnapshot } from "@/utils/persistence/shared";
import { getMapCoord, getSnappingCoordinates, transactRoute } from "./utils";

export function useNoneHandlers({
  setFlatbushInstance,
  throttledMovePointer,
  dragTargetRef,
  selection,
  featureMap,
  idMap,
  folderMap,
  mode,
  rep,
  pmap,
}: HandlerContext): Handlers {
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const endSnapshot = useEndSnapshot();
  const startSnapshot = useStartSnapshot();
  const lastPoint = useRef<maplibregl.LngLat | null>(null);
  const spaceHeld = useSpaceHeld();
  const altHeld = useAltHeld();

  const handlers: Handlers = {
    double: noop,
    down: (e) => {
      lastPoint.current = e.lngLat;

      if ("button" in e.originalEvent && e.originalEvent.button === 2) {
        return;
      }

      const { shiftKey } = e.originalEvent;

      if (shiftKey) {
        let index: undefined | FlatbushLike;

        if (selection.type === "single") {
          const feature = featureMap.get(selection.id);
          if (!feature) return;
          if (feature.feature.geometry?.type === "Point") {
            index = generateFeaturesFlatbushInstance(
              filterLockedFeatures({ featureMap, folderMap }),
            );
          } else {
            index = generateVertexFlatbushInstance(
              feature,
              UIDMap.getIntID(idMap, selection.id),
            );
          }
        } else {
          index = generateFeaturesFlatbushInstance(
            filterLockedFeatures({ featureMap, folderMap }),
          );
        }

        if (index) {
          setFlatbushInstance(index);
          setMode({ mode: Mode.LASSO });
          setEphemeralState({
            type: "lasso",
            box: [e.lngLat.toArray() as Pos2, e.lngLat.toArray() as Pos2],
          });

          if (selection.type === "multi") {
            setSelection((selection) => {
              if (selection.type !== "multi") {
                return selection;
              }
              return {
                type: "multi",
                ids: selection.ids,
                previousIds: selection.ids,
              };
            });
          }
        }

        e.preventDefault();

        return;
      }

      const selectedIds = USelection.toIds(selection);
      if ((e.originalEvent.altKey || spaceHeld.current) && selectedIds.length) {
        dragTargetRef.current = selectedIds.slice();
        void startSnapshot(
          USelection.getSelectedFeatures({
            selection,
            featureMap,
            folderMap,
          }),
        );
        e.preventDefault();
        return;
      }

      const feature = pmap.overlay.pickObject({
        ...e.point,
        layerIds: [DECK_SYNTHETIC_ID],
      });

      if (!feature?.object || selection.type !== "single") {
        const fuzzyResult = utils.fuzzyClick(e, {
          idMap,
          featureMap,
          folderMap,
          pmap,
        });

        if (fuzzyResult) {
          const { wrappedFeature, id } = fuzzyResult;
          if (
            selection.type === "single" &&
            selection.id !== wrappedFeature.id
          ) {
            void startSnapshot(wrappedFeature);
            dragTargetRef.current = id;
            setSelection(USelection.single(wrappedFeature.id));
          }
          e.preventDefault();
        }

        return;
      }
      e.preventDefault();

      const rawId = feature.object.id as RawId;
      const id = decodeId(rawId);
      const wrappedFeature = featureMap.get(selection.id);

      if (!wrappedFeature) {
        return;
      }

      if (id.type === "midpoint") {
        const spliced = ops.spliceNewVertex({
          feature: wrappedFeature.feature,
          id,
          position: getMapCoord(e),
        });
        void startSnapshot(wrappedFeature);
        transact({
          putFeatures: [
            {
              ...wrappedFeature,
              feature: spliced,
            },
          ],
        })
          .then(() => {
            dragTargetRef.current = encodeVertex(id.featureId, id.vertex + 1);
          })
          .catch((e) => captureException(e));

        return;
      }

      void startSnapshot(wrappedFeature);
      dragTargetRef.current = rawId;
      setCursor("pointer");
    },
    up: () => {
      dragTargetRef.current = null;
      void endSnapshot();
      setCursor(CURSOR_DEFAULT);
      if (selection.type === "single") {
        const newFeature = featureMap.get(selection.id);

        if (newFeature) {
          const typeProperty = newFeature.feature.properties?.["@type"];

          if (
            typeProperty === "route:walking" ||
            typeProperty === "route:cycling" ||
            typeProperty === "route:driving"
          ) {
            const routeType = typeProperty.split(":")[1] as ROUTE_TYPE;
            return transactRoute(transact, newFeature, routeType);
          }
        }
      }
    },
    move: (e) => {
      if (dragTargetRef.current === null) {
        throttledMovePointer(e.point);
        return;
      }

      if (lastPoint.current === null) {
        lastPoint.current = e.lngLat;
      }

      const dragTarget = dragTargetRef.current;

      if (Array.isArray(dragTarget)) {
        if (e.originalEvent.altKey && lastPoint.current) {
          const a = lastPoint.current;
          lastPoint.current = e.lngLat;
          return transact({
            putFeatures: ops.rotateFeatures(
              dragTarget.map((uuid) => {
                return featureMap.get(uuid)!;
              }),
              a,
              e.lngLat,
            ),
            quiet: true,
          });
        } else if (lastPoint.current) {
          const dx = lastPoint.current.lng - e.lngLat.lng;
          const dy = lastPoint.current.lat - e.lngLat.lat;
          lastPoint.current = e.lngLat;
          return transact({
            putFeatures: dragTarget.map((uuid) => {
              const feature = featureMap.get(uuid)!;
              return {
                ...feature,
                feature: ops.moveFeature(feature.feature, dx, dy),
              };
            }),
            quiet: true,
          });
        }
      } else if (selection.type === "single") {
        const id = decodeId(dragTarget);
        switch (id.type) {
          case "feature":
          case "midpoint": {
            break;
          }
          case "vertex": {
            const feature = featureMap.get(selection.id);
            if (!feature) return;

            let nextCoord = getMapCoord(e);
            if (altHeld.current) {
              nextCoord = getSnappingCoordinates(
                e,
                featureMap,
                pmap,
                idMap,
                selection.id,
              ) as Pos2;
            }

            const { feature: newFeature, wasRectangle } = ops.setCoordinates({
              feature: feature.feature,
              position: nextCoord,
              breakRectangle: e.originalEvent.metaKey,
              vertexId: id,
            });

            if (wasRectangle && !mode?.modeOptions?.hasResizedRectangle) {
              setMode((mode) => {
                return {
                  ...mode,
                  modeOptions: {
                    hasResizedRectangle: true,
                  },
                };
              });
            }

            return transact({
              putFeatures: [
                {
                  ...feature,
                  feature: newFeature,
                },
              ],
              quiet: true,
            });
          }
        }
      }
    },
    click: (e) => {
      const fuzzyResult = utils.fuzzyClick(e, {
        idMap,
        featureMap,
        folderMap,
        pmap,
      });

      if (!fuzzyResult) {
        setSelection(USelection.none());
        setMode({ mode: Mode.NONE });
        return;
      }

      const { wrappedFeature, decodedId } = fuzzyResult;

      const feature = wrappedFeature.feature;

      const id = wrappedFeature.id;

      switch (decodedId.type) {
        case "feature": {
          setSelection(USelection.single(id));
          break;
        }
        case "vertex": {
          setSelection({
            type: "single",
            parts: [decodedId],
            id,
          });
          break;
        }
        case "midpoint": {
          break;
        }
      }

      if (feature.geometry === null) {
        return;
      }

      if (
        !(
          decodedId.type === "vertex" &&
          feature.geometry.type === "LineString" &&
          USelection.isVertexSelected(selection, id, decodedId)
        )
      ) {
        return;
      }
    },
    enter() {
      setSelection(USelection.none());
    },
  };

  return handlers;
}
