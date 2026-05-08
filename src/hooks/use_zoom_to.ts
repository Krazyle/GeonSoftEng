import { useAtomCallback } from "jotai/utils";
import type { LngLatBoundsLike } from "maplibre-gl";
import { Maybe } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import type { BBox, FeatureCollection, IWrappedFeature } from "types";
import { MapContext } from "@/providers/map_context";
import { USelection } from "@/stores";
import { dataAtom, type Sel } from "@/stores/jotai";
import { getExtent, isBBoxEmpty } from "@/utils/geometry";

export function useZoomTo() {
  const map = useContext(MapContext);

  return useAtomCallback(
    useCallback(
      (get, _set, selection: Sel | IWrappedFeature[] | Maybe<BBox>) => {
        const data = get(dataAtom);
        let extent: Maybe<BBox>;
        if (Maybe.isMaybe(selection)) {
          extent = selection;
        } else {
          const selectedFeatures: FeatureCollection = {
            type: "FeatureCollection",
            features: Array.isArray(selection)
              ? selection.map((f) => f.feature)
              : USelection.getSelectedFeatures({
                  ...data,
                  selection,
                }).map((f) => f.feature),
          };
          extent = getExtent(selectedFeatures);
        }
        extent.ifJust((extent) => {
          map?.map.fitBounds(extent as LngLatBoundsLike, {
            padding: map?.map.getCanvas().getBoundingClientRect().width / 10,
            animate: false,

            maxZoom: isBBoxEmpty(extent) ? 14 : Infinity,
          });
        });
      },
      [map],
    ),
  );
}
