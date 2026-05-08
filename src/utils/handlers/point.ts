import { useSetAtom } from "jotai";
import noop from "lodash/noop";
import type { HandlerContext, Point } from "types";
import { captureException } from "@/lib/integrations/errors";
import { USelection } from "@/stores";
import { cursorStyleAtom, Mode, modeAtom, selectionAtom } from "@/stores/jotai";
import { CURSOR_DEFAULT } from "@/utils/constants";
import { createOrUpdateFeature, getMapCoord } from "./utils";

export function usePointHandlers({
  dragTargetRef,
  mode,
  selection,
  featureMap,
  rep,
}: HandlerContext): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const multi = mode.modeOptions?.multi;
  return {
    click: (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const point: Point = {
        type: "Point",
        coordinates: getMapCoord(e),
      };

      const putFeature = createOrUpdateFeature({
        mode,
        selection,
        featureMap,
        geometry: point,
      });

      const id = putFeature.id;

      transact({
        note: "Drew a point",
        putFeatures: [putFeature],
      })
        .then(() => {
          if (!multi) {
            setSelection(USelection.single(id));
          }
        })
        .catch((e) => captureException(e));
    },
    move: noop,
    down: noop,
    up() {
      dragTargetRef.current = null;
      setCursor(CURSOR_DEFAULT);
    },
    double: noop,
    enter() {
      setMode({ mode: Mode.NONE });
    },
  };
}
