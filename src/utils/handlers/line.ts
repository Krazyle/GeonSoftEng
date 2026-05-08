import { useSetAtom } from "jotai";
import { useRef } from "react";
import type { HandlerContext, IFeature, LineString, Position } from "types";
import { lockDirection, useAltHeld, useShiftHeld } from "@/hooks/use_held";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import { cursorStyleAtom, Mode, modeAtom, selectionAtom } from "@/stores/jotai";
import { CURSOR_DEFAULT } from "@/utils/constants";
import * as utils from "@/utils/map_component_utils";
import { usePopMoment } from "@/utils/persistence/shared";
import replaceCoordinates from "@/utils/replace_coordinates";
import {
  createOrUpdateFeature,
  getMapCoord,
  getSnappingCoordinates,
} from "./utils";

export function useLineHandlers({
  rep,
  featureMap,
  folderMap,
  selection,
  pmap,
  idMap,
  mode,
  dragTargetRef,
}: HandlerContext): Handlers {
  const multi = mode.modeOptions?.multi;
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const popMoment = usePopMoment();
  const usingTouchEvents = useRef<boolean>(false);
  const shiftHeld = useShiftHeld();
  const altHeld = useAltHeld();

  const handlers: Handlers = {
    click: (e) => {
      const { modeOptions } = mode;

      if (selection.type === "none" || selection.type === "folder") {
        const lineString = utils.newLineStringFromClickEvent(e);

        const putFeature = createOrUpdateFeature({
          mode,
          selection,
          featureMap,
          geometry: lineString,
        });

        const id = putFeature.id;
        transact({
          note: "Drew a line",
          putFeatures: [putFeature],
        }).catch((e) => captureException(e));
        setSelection(USelection.single(id));
      } else if (selection.type === "single") {
        const position = getMapCoord(e);
        const wrappedFeature = featureMap.get(selection.id);
        if (!wrappedFeature) {
          setSelection(USelection.none());
          return;
        }
        const feature = wrappedFeature.feature as IFeature<LineString>;
        void transact({
          note: "Added to line",
          putFeatures: [
            {
              ...wrappedFeature,
              feature: replaceCoordinates(
                feature,
                modeOptions?.reverse
                  ? [position as Position].concat(feature.geometry.coordinates)
                  : feature.geometry.coordinates.concat([position]),
              ),
            },
          ],
        })
          .catch((e) => captureException(e))
          .then(() => {});
      }
    },

    move: (e) => {
      const { modeOptions } = mode;
      if (selection.type !== "single") return;

      if (e.type === "mousemove" && usingTouchEvents.current) {
        return;
      }
      const wrappedFeature = featureMap.get(selection.id);
      if (!wrappedFeature) {
        return;
      }
      const feature = wrappedFeature.feature as IFeature<LineString>;

      let nextCoord = getMapCoord(e) as Position;
      const lastCoord = feature.geometry.coordinates.at(-2);
      if (shiftHeld.current && lastCoord) {
        nextCoord = lockDirection(lastCoord, nextCoord);
      }

      if (altHeld.current && lastCoord) {
        nextCoord = getSnappingCoordinates(e, featureMap, pmap, idMap);
      }

      void transact({
        putFeatures: [
          {
            ...wrappedFeature,
            feature: replaceCoordinates(
              feature,
              modeOptions?.reverse
                ? [nextCoord].concat(feature.geometry.coordinates.slice(1))
                : feature.geometry.coordinates.slice(0, -1).concat([nextCoord]),
            ),
          },
        ],
        quiet: true,
      })
        .catch((e) => captureException(e))
        .then(() => {});
    },

    touchstart: (e) => {
      usingTouchEvents.current = true;
      e.preventDefault();
    },

    touchmove: (e) => {
      handlers.move(e);
    },

    touchend: (e) => {
      handlers.click(e);
    },

    down: (e) => {
      if (e.type === "mousedown") {
        usingTouchEvents.current = false;
      }
    },
    up() {
      dragTargetRef.current = null;
      setCursor(CURSOR_DEFAULT);
    },
    double: (e) => {
      const { modeOptions } = mode;
      if (selection?.type !== "single") return;

      const wrappedFeature = featureMap.get(selection.id);
      if (!wrappedFeature) {
        setSelection(USelection.none());
        return;
      }
      if (!multi) {
        setMode({ mode: Mode.NONE });
      } else {
        setSelection(
          USelection.selectionToFolder({
            selection,
            folderMap,
            featureMap,
          }),
        );
      }
      e.preventDefault();

      const feature = wrappedFeature.feature as IFeature<LineString>;
      const finalFeature = replaceCoordinates(
        feature,
        modeOptions?.reverse
          ? feature.geometry.coordinates.slice(2)
          : feature.geometry.coordinates.slice(0, -2),
      );
      void popMoment(2);
      transact({
        putFeatures: [
          {
            ...wrappedFeature,
            feature: finalFeature,
          },
        ],
        quiet: true,
      }).catch((e) => captureException(e));
    },
    enter() {
      setMode({ mode: Mode.NONE });
      if (selection.type !== "single") return;

      const selected = featureMap.get(selection.id);

      if (!selected) {
        setSelection(USelection.none());
        return;
      }

      const feature = selected.feature as IFeature<LineString>;

      transact({
        putFeatures: [
          {
            ...selected,
            feature: replaceCoordinates(
              feature,
              feature.geometry.coordinates.length > 2
                ? mode.modeOptions?.reverse
                  ? feature.geometry.coordinates.slice(1)
                  : feature.geometry.coordinates.slice(0, -1)
                : feature.geometry.coordinates,
            ),
          },
        ],
      }).catch((e) => captureException(e));
    },
  };

  return handlers;
}
