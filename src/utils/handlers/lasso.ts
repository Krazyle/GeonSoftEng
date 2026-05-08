import { useAtomCallback } from "jotai/utils";
import noop from "lodash/noop";
import { useCallback } from "react";
import type { HandlerContext } from "types";
import { USelection } from "@/stores";
import type { EphemeralEditingStateLasso } from "@/stores/jotai";
import { ephemeralStateAtom, modeAtom, selectionAtom } from "@/stores/jotai";
import { Mode } from "@/stores/mode";
import * as utils from "@/utils/map_component_utils";
import { toggle, toggleByValue } from "@/utils/utils";

export function useLassoHandlers({
  flatbushInstance,
  featureMap,
  idMap,
  folderMap,
  selection,
  pmap,
}: HandlerContext): Handlers {
  return {
    click: useAtomCallback(
      useCallback((_get, set) => {
        set(modeAtom, { mode: Mode.NONE });
      }, []),
    ),
    move: useAtomCallback(
      useCallback(
        (get, set, e) => {
          const map = e.target;
          const oldState = get(ephemeralStateAtom);
          if (oldState.type !== "lasso") return;
          const pos = e.lngLat.toArray() as Pos2;
          const newLasso: EphemeralEditingStateLasso = {
            type: "lasso",
            box: [oldState.box[0], pos],
          };
          if (utils.isLassoTiny(newLasso, map)) {
            set(ephemeralStateAtom, newLasso);
            return;
          }
          const { box } = newLasso;
          switch (flatbushInstance.type) {
            case "feature": {
              set(ephemeralStateAtom, newLasso);
              set(selectionAtom, (sel) => flatbushInstance.search(box, sel));
              break;
            }
            case "vertex": {
              const oldSelection = get(selectionAtom);
              if (oldSelection.type === "single") {
                set(ephemeralStateAtom, newLasso);
                set(selectionAtom, (sel) => flatbushInstance.search(box, sel));
              }
              break;
            }
            default:
              break;
          }
          e.preventDefault();
        },
        [flatbushInstance],
      ),
    ),
    down: noop,
    up: useAtomCallback((get, set, e) => {
      const map = e.target;
      const ephemeralState = get(ephemeralStateAtom);
      set(ephemeralStateAtom, { type: "none" });

      if (ephemeralState?.type !== "lasso") return;

      if (
        !(utils.isLassoTiny(ephemeralState, map) && e.originalEvent.shiftKey)
      ) {
        set(modeAtom, { mode: Mode.NONE });
        return;
      }

      const fuzzyResult = utils.fuzzyClick(e, {
        idMap,
        featureMap,
        folderMap,
        pmap,
      });
      if (!fuzzyResult) {
        set(selectionAtom, USelection.none());
        return;
      }

      const { wrappedFeature, decodedId } = fuzzyResult;

      const id = wrappedFeature.id;

      switch (selection.type) {
        case "folder": {
          break;
        }
        case "none": {
          set(selectionAtom, USelection.single(id));
          break;
        }
        case "multi": {
          const newSelection = USelection.toggleSelectionId(selection, id);
          set(selectionAtom, newSelection);
          break;
        }
        case "single": {
          if (decodedId.type === "vertex") {
            set(selectionAtom, {
              type: "single",
              parts: toggleByValue(selection.parts, decodedId),
              id: id,
            });
          } else if (decodedId.type === "feature") {
            const ids = toggle([selection.id], id);
            set(
              selectionAtom,
              ids.length === 0
                ? {
                    type: "none",
                  }
                : {
                    type: "multi",
                    ids,
                  },
            );
          }
          break;
        }
      }
    }),
    double: noop,
    enter() {},
  };
}
