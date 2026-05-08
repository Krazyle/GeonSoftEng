import clsx from "clsx";
import throttle from "lodash/throttle";
import type maplibregl from "maplibre-gl";
import { ContextMenu as CM } from "radix-ui";
import type React from "react";
import {
  type MutableRefObject,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DragTarget, HandlerContext, IWrappedFeature } from "types";
import { SYMBOLIZATION_NONE } from "types";
import { MapContextMenu } from "@/features/map/components/map_context_menu";
import { captureException } from "@/lib/integrations/errors";
import { MapContext } from "@/providers/map_context";
import {
  cursorStyleAtom,
  dataAtom,
  ephemeralStateAtom,
  layerConfigAtom,
  Mode,
  modeAtom,
  selectedFeaturesAtom,
} from "@/stores/jotai";
import type { FlatbushLike } from "@/utils/generate_flatbush_instance";
import { EmptyIndex } from "@/utils/generate_flatbush_instance";
import { useHandlers } from "@/utils/handlers/index";
import { CLICKABLE_LAYERS } from "@/utils/load_and_augment_style";
import { wrappedFeaturesFromMapFeatures } from "@/utils/map_component_utils";
import type { PMapHandlers } from "@/utils/pmap";
import PMap from "@/utils/pmap";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAtom, useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import toast from "react-hot-toast";
import { LastSearchResult } from "@/components/last_search_result";
import { ModeHints } from "@/components/mode_hints";
import { useClipboard } from "@/hooks/use_clipboard";
import { keybindingOptions } from "@/hooks/use_map_keybindings";
import { useHotkeys } from "@/lib/integrations/hotkeys";
import { DECK_SYNTHETIC_ID } from "@/utils/constants";
import { newFeatureId } from "@/utils/id";
import { usePersistence } from "@/utils/persistence/context";
import { fMoment } from "@/utils/persistence/moment";

export interface ContextInfo {
  features: ReturnType<typeof wrappedFeaturesFromMapFeatures>;
  selectedFeatures: IWrappedFeature[];
  position: Pos2;
}

export const MapComponent = memo(function MapComponent({
  setMap,
}: {
  setMap: (arg0: PMap | null) => void;
}) {
  const data = useAtomValue(dataAtom);

  const layerConfigs = useAtomValue(layerConfigAtom);
  const { featureMap, folderMap } = data;

  const [flatbushInstance, setFlatbushInstance] =
    useState<FlatbushLike>(EmptyIndex);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  const lastCursor = useRef<{
    cursorLatitude: number;
    cursorLongitude: number;
  }>({
    cursorLatitude: 0,
    cursorLongitude: 0,
  });

  const rep = usePersistence();

  const selection = data.selection;
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const mode = useAtomValue(modeAtom);
  const [cursor, setCursor] = useAtom(cursorStyleAtom);

  const mapRef: React.MutableRefObject<PMap | null> = useRef<PMap>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  const dragTargetRef: React.MutableRefObject<DragTarget | null> =
    useRef<DragTarget>(null);
  const mapHandlers = useRef<PMapHandlers>(null);

  const map = useContext(MapContext);

  const transact = rep.useTransact();

  const [meta, updateMeta] = rep.useMetadata();
  const { label, symbolization } = meta;

  const currentLayer = meta.layer;
  useClipboard();

  const migrated = useRef<boolean>(false);
  useEffect(() => {
    if (currentLayer && !migrated.current) {
      migrated.current = true;
      toast
        .promise(
          Promise.resolve(
            updateMeta({
              layerId: null,
              defaultLayer: null,
            }),
          ).then(() => {
            return transact({
              ...fMoment("Upgrade layers"),
              putLayerConfigs: [
                {
                  ...currentLayer,
                  at: "a0",
                  visibility: true,
                  opacity: 1,
                  tms: false,
                  id: newFeatureId(),
                },
              ],
            });
          }),
          {
            loading: "Upgrading layers",
            success: "Upgraded layers",
            error: "Error migrating layers",
          },
        )
        .catch((e) => {
          captureException(e);
        });
    }
  }, [currentLayer, transact, updateMeta, layerConfigs]);

  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current || !mapHandlers) return;

    mapRef.current = new PMap({
      element: mapDivRef.current,
      layerConfigs,
      handlers: mapHandlers as MutableRefObject<PMapHandlers>,
      symbolization: symbolization || SYMBOLIZATION_NONE,
      previewProperty: label,
      idMap: idMap,
    });

    setMap(mapRef.current);

    return () => {
      setMap(null);
      if (mapRef.current && "remove" in mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
  }, [mapRef, mapDivRef, setMap]);

  useEffect(
    function mapSetDataMethods() {
      if (!map?.map) {
        return;
      }

      map.setData({
        data,
        ephemeralState,
      });
      map
        .setStyle({
          layerConfigs,
          symbolization: symbolization || SYMBOLIZATION_NONE,
          previewProperty: label,
        })
        .catch((e) => captureException(e));
    },
    [map, folderMap, symbolization, data, layerConfigs, ephemeralState, label],
  );

  const throttledMovePointer = useMemo(() => {
    function fastMovePointer(point: maplibregl.Point) {
      if (!map?.map.isStyleLoaded()) return;
      const style = map.map.getStyle();
      if (!style?.layers) return;
      const existingLayers = CLICKABLE_LAYERS.filter((id) =>
        style.layers.some((l) => l.id === id),
      );
      const features = map.map.queryRenderedFeatures(point, {
        layers: existingLayers,
      });
      try {
        const syntheticUnderCursor = map.overlay.pickObject({
          ...point,
          layerIds: [DECK_SYNTHETIC_ID],
        });
        setCursor(syntheticUnderCursor || features.length ? "move" : "");
      } catch (_e) {}
    }
    return fastMovePointer;
  }, [map, setCursor]);

  const idMap = rep.idMap;

  const handlerContext: HandlerContext = {
    flatbushInstance,
    setFlatbushInstance,
    throttledMovePointer,
    mode,
    dragTargetRef,
    featureMap,
    folderMap,
    idMap,
    selection,
    pmap: mapRef.current!,
    rep,
  };

  const HANDLERS = useHandlers(handlerContext);

  const newHandlers: PMapHandlers = {
    onClick: (e: maplibregl.MapMouseEvent) => {
      HANDLERS[mode.mode].click(e);
    },
    onMapMouseDown: (e: maplibregl.MapMouseEvent) => {
      HANDLERS[mode.mode].down(e);
    },
    onMapTouchStart: (e: maplibregl.MapTouchEvent) => {
      const handler = HANDLERS[mode.mode];
      if (handler.touchstart) {
        handler.touchstart(e);
      } else {
        handler.down(e);
      }
    },
    onMapMouseUp: (e: maplibregl.MapMouseEvent) => {
      HANDLERS[mode.mode].up(e);
    },
    onMapTouchEnd: (e: maplibregl.MapTouchEvent) => {
      const handler = HANDLERS[mode.mode];
      if (handler.touchend) {
        handler.touchend(e);
      } else {
        handler.up(e);
      }
    },
    onMapTouchMove: (e: maplibregl.MapTouchEvent) => {
      const handler = HANDLERS[mode.mode];
      if (handler.touchmove) {
        handler.touchmove(e);
      } else {
        handler.move(e);
      }
    },
    onMapMouseMove: (e: maplibregl.MapMouseEvent) => {
      HANDLERS[mode.mode].move(e);
      const map = mapRef.current?.map;
      if (!map) return;
      lastCursor.current = {
        cursorLongitude: e.lngLat.lng,
        cursorLatitude: e.lngLat.lat,
      };
    },
    onDoubleClick: (e: maplibregl.MapMouseEvent) => {
      HANDLERS[mode.mode].double(e);
    },
    onMoveEnd() {},
    onMove: throttle((e: maplibregl.MapLibreEvent) => {
      const center = e.target.getCenter().toArray();
      const bounds = e.target.getBounds()?.toArray();
      return {
        center,
        bounds,
      };
    }, 300),
  };

  useHotkeys(
    "Escape, Enter",
    () => {
      HANDLERS[mode.mode].enter();
    },
    keybindingOptions,
    [HANDLERS, mode],
  );

  mapHandlers.current = newHandlers;

  const onContextMenu = useAtomCallback(
    useCallback(
      (get, _set, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        const { featureMap } = get(dataAtom);
        const mapDivBox = mapDivRef.current?.getBoundingClientRect();
        const map = mapRef.current;
        if (mapDivBox && map) {
          const featureUnderMouse = map.map.queryRenderedFeatures(
            [event.pageX - mapDivBox.left, event.pageY - mapDivBox.top],
            {
              layers: CLICKABLE_LAYERS,
            },
          );

          const position = map.map
            .unproject([
              event.pageX - mapDivBox.left,
              event.pageY - mapDivBox.top,
            ])
            .toArray() as Pos2;

          const selectedFeatures = get(selectedFeaturesAtom);

          setContextInfo({
            features: wrappedFeaturesFromMapFeatures(
              featureUnderMouse,
              featureMap,
              rep.idMap,
            ),
            position,
            selectedFeatures,
          });
        }
      },
      [mapDivRef, rep],
    ),
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      setContextInfo((contextInfo) => {
        if (!open && contextInfo) {
          return null;
        }
        return contextInfo;
      });
    },
    [setContextInfo],
  );

  return (
    <CM.Root modal={false} onOpenChange={onOpenChange}>
      <CM.Trigger asChild onContextMenu={onContextMenu}>
        <div
          className={clsx(
            "top-0 bottom-0 left-0 right-0 maplibregl-map",
            cursor === "move"
              ? "cursor-move"
              : {
                  "app-cursor-default":
                    mode.mode === Mode.NONE ||
                    mode.mode === Mode.DRAW_POLYGON ||
                    mode.mode === Mode.DRAW_LINE,
                  "app-cursor-point": mode.mode === Mode.DRAW_POINT,
                  "app-cursor-crosshair":
                    mode.mode === Mode.DRAW_RECTANGLE ||
                    mode.mode === Mode.LASSO,
                },
          )}
          ref={mapDivRef}
          data-testid="map"
          style={{
            position: "absolute",
          }}
        ></div>
      </CM.Trigger>
      <MapContextMenu contextInfo={contextInfo} />
      <LastSearchResult />
      <ModeHints />
    </CM.Root>
  );
});
