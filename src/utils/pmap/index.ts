import { ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import type {
  Feature,
  IFeature,
  IFeatureCollection,
  IPresence,
  ISymbolization,
  LayerConfigMap,
  Point,
} from "types";
import type {
  Data,
  EphemeralEditingState,
  PreviewProperty,
  Sel,
} from "@/stores/jotai";
import { colorFromPresence } from "@/utils/color";
import {
  CURSOR_DEFAULT,
  DECK_SYNTHETIC_ID,
  DEFAULT_MAP_BOUNDS,
  emptySelection,
  LINE_COLORS_SELECTED_RGB,
  WHITE,
} from "@/utils/constants";
import type { IDMap } from "@/utils/id_mapper";
import loadAndAugmentStyle, {
  EPHEMERAL_SOURCE_NAME,
  FEATURES_SOURCE_NAME,
  LASSO_SOURCE_NAME,
} from "@/utils/load_and_augment_style";
import { splitFeatureGroups } from "@/utils/pmap/split_feature_groups";
import { shallowArrayEqual } from "@/utils/utils";
import { bboxToPolygon } from "../geometry";

const MAP_OPTIONS: Omit<maplibregl.MapOptions, "container"> = {
  style: { version: 8, layers: [], sources: {} },
  maxZoom: 26,
  boxZoom: false,
  dragRotate: false,
  attributionControl: false,
  fadeDuration: 0,
};

const cursorSvg = (color: string) => {
  const div = document.createElement("div");
  div.style.color = color;
  div.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M7 17L1 1L17 7L10 10L7 17Z" stroke="white" fill="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`;
  return div;
};

type ClickEvent = maplibregl.MapMouseEvent;
type MoveEvent = maplibregl.MapLibreEvent;

export type PMapHandlers = {
  onClick: (e: ClickEvent) => void;
  onDoubleClick: (e: ClickEvent) => void;
  onMapMouseUp: (e: maplibregl.MapMouseEvent) => void;
  onMapMouseMove: (e: maplibregl.MapMouseEvent) => void;
  onMapTouchMove: (e: maplibregl.MapTouchEvent) => void;
  onMapMouseDown: (e: maplibregl.MapMouseEvent) => void;
  onMapTouchStart: (e: maplibregl.MapTouchEvent) => void;
  onMoveEnd: (e: maplibregl.MapLibreEvent) => void;
  onMapTouchEnd: (e: maplibregl.MapTouchEvent) => void;
  onMove: (e: maplibregl.MapLibreEvent) => void;
};

const lastValues = new WeakMap<maplibregl.GeoJSONSource, Feature[]>();

function mSetData(
  source: maplibregl.GeoJSONSource,
  newData: Feature[],
  _label: string,
  force?: boolean,
) {
  if (!shallowArrayEqual(lastValues.get(source), newData) || force) {
    source.setData({
      type: "FeatureCollection",
      features: newData,
    } as IFeatureCollection);
    lastValues.set(source, newData);
  } else {
  }
}

export default class PMap {
  map: maplibregl.Map;
  handlers: React.MutableRefObject<PMapHandlers>;
  idMap: IDMap;

  lastSelection: Sel;
  lastSelectionIds: Set<RawId>;
  lastData: Data | null;
  lastEphemeralState: EphemeralEditingState;
  lastSymbolization: ISymbolization | null;
  presenceMarkers: Map<IPresence["userId"], maplibregl.Marker>;
  lastLayer: LayerConfigMap | null;
  lastPreviewProperty: PreviewProperty;
  overlay: MapboxOverlay;

  constructor({
    element,
    layerConfigs,
    handlers,
    previewProperty,
    symbolization,
    idMap,
    controlsCorner = "bottom-left",
  }: {
    element: HTMLDivElement;
    layerConfigs: LayerConfigMap;
    handlers: React.MutableRefObject<PMapHandlers>;
    symbolization: ISymbolization;
    previewProperty: PreviewProperty;
    idMap: IDMap;
    controlsCorner?: Parameters<maplibregl.Map["addControl"]>[1];
  }) {
    this.idMap = idMap;
    const positionOptions = {
      bounds: DEFAULT_MAP_BOUNDS as maplibregl.LngLatBoundsLike,
    };

    const map = new maplibregl.Map({
      container: element,
      ...MAP_OPTIONS,
      ...positionOptions,
    });

    this.overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });

    map.addControl(this.overlay as any);

    map.addControl(
      new maplibregl.GeolocateControl({
        showUserLocation: false,
        showAccuracyCircle: false,
        positionOptions: {
          enableHighAccuracy: true,
        },
      }),
      controlsCorner,
    );
    map.addControl(new maplibregl.NavigationControl({}), controlsCorner);
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
    );
    map.getCanvas().style.cursor = CURSOR_DEFAULT;
    map.on("click", this.onClick);
    map.on("mousedown", this.onMapMouseDown);
    map.on("mousemove", this.onMapMouseMove);
    map.on("dblclick", this.onMapDoubleClick);
    map.on("mouseup", this.onMapMouseUp);
    map.on("moveend", this.onMoveEnd);
    map.on("touchend", this.onMapTouchEnd);
    map.on("move", this.onMove);

    map.on("touchstart", this.onMapTouchStart);
    map.on("touchmove", this.onMapTouchMove);
    map.on("touchend", this.onMapTouchEnd);

    this.presenceMarkers = new Map();
    this.lastSymbolization = symbolization;

    this.lastSelection = { type: "none" };
    this.lastSelectionIds = emptySelection;
    this.lastData = null;
    this.lastEphemeralState = { type: "none" };
    this.lastLayer = null;
    this.lastPreviewProperty = null;
    this.handlers = handlers;
    this.map = map;
    void this.setStyle({
      layerConfigs,
      symbolization,
      previewProperty: previewProperty,
    });
  }

  onClick = (e: LayerScopedEvent) => {
    this.handlers.current.onClick(e);
  };

  onMapMouseDown = (e: LayerScopedEvent) => {
    this.handlers.current.onMapMouseDown(e);
  };

  onMapTouchStart = (e: maplibregl.MapTouchEvent) => {
    this.handlers.current.onMapTouchStart(e);
  };

  onMapMouseUp = (e: LayerScopedEvent) => {
    this.handlers.current.onMapMouseUp(e);
  };

  onMoveEnd = (e: MoveEvent) => {
    this.handlers.current.onMoveEnd(e);
  };

  onMapTouchEnd = (e: maplibregl.MapTouchEvent) => {
    this.handlers.current.onMapTouchEnd(e);
  };

  onMove = (e: MoveEvent) => {
    this.handlers.current.onMove(e);
  };

  onMapMouseMove = (e: maplibregl.MapMouseEvent) => {
    this.handlers.current.onMapMouseMove(e);
  };

  onMapTouchMove = (e: maplibregl.MapTouchEvent) => {
    this.handlers.current.onMapTouchMove(e);
  };

  onMapDoubleClick = (e: maplibregl.MapMouseEvent) => {
    this.handlers.current.onDoubleClick(e);
  };

  setPresences(presences: IPresence[]) {
    const ids = new Set(presences.map((p) => p.userId));
    for (const presence of presences) {
      const marker =
        this.presenceMarkers.get(presence.userId) ??
        new maplibregl.Marker(cursorSvg(colorFromPresence(presence)));
      marker
        .setLngLat([presence.cursorLongitude, presence.cursorLatitude])
        .addTo(this.map);
      this.presenceMarkers.set(presence.userId, marker);
    }

    for (const [id, marker] of this.presenceMarkers.entries()) {
      if (!ids.has(id)) {
        marker.remove();
        this.presenceMarkers.delete(id);
      }
    }
  }

  setData({
    data,
    ephemeralState,
    force = false,
  }: {
    data: Data;
    ephemeralState: EphemeralEditingState;
    force?: boolean;
  }) {
    if (!(this.map && (this.map as any).style)) {
      this.lastData = data;
      return;
    }

    const featuresSource = this.map.getSource(
      FEATURES_SOURCE_NAME,
    ) as maplibregl.GeoJSONSource;

    const lassoSource = this.map.getSource(
      LASSO_SOURCE_NAME,
    ) as maplibregl.GeoJSONSource;

    const ephemeralSource = this.map.getSource(
      EPHEMERAL_SOURCE_NAME,
    ) as maplibregl.GeoJSONSource;

    if (!featuresSource || !ephemeralSource) {
      this.lastData = data;
      return;
    }

    const groups = splitFeatureGroups({
      idMap: this.idMap,
      data,
      lastSymbolization: this.lastSymbolization,
      previewProperty: this.lastPreviewProperty,
    });

    mSetData(ephemeralSource, groups.ephemeral, "ephem");
    mSetData(featuresSource, groups.features, "features", force);

    this.overlay.setProps({
      layers: [
        new ScatterplotLayer<IFeature<Point>>({
          id: DECK_SYNTHETIC_ID,

          radiusUnits: "pixels",
          lineWidthUnits: "pixels",

          pickable: true,
          stroked: true,
          filled: true,

          data: groups.synthetic,

          getPosition: (d) => d.geometry.coordinates as [number, number],
          getFillColor: (d) => {
            return groups.selectionIds.has(d.id as RawId)
              ? WHITE
              : LINE_COLORS_SELECTED_RGB;
          },
          getLineColor: (d) => {
            return groups.selectionIds.has(d.id as RawId)
              ? LINE_COLORS_SELECTED_RGB
              : WHITE;
          },
          getLineWidth: 1.5,
          getRadius: (d) => {
            const id = Number(d.id || 0);
            const fp = d.properties?.fp;
            if (fp) return 10;
            return id % 2 === 0 ? 5 : 3.5;
          },
        }),
      ],
    });

    if (ephemeralState.type === "lasso") {
      mSetData(
        lassoSource,
        [
          {
            geometry: bboxToPolygon([
              ...ephemeralState.box[0],
              ...ephemeralState.box[1],
            ]),
            properties: {},
            type: "Feature",
          },
        ],
        "features",
        force,
      );
    } else {
      mSetData(lassoSource, [], "features", force);
    }

    this.lastData = data;
    this.updateSelections(groups.selectionIds);
    this.lastEphemeralState = ephemeralState;
  }

  remove() {
    this.map.remove();
  }

  async setStyle({
    layerConfigs,
    symbolization,
    previewProperty,
  }: {
    layerConfigs: LayerConfigMap;
    symbolization: ISymbolization;
    previewProperty: PreviewProperty;
  }) {
    if (
      layerConfigs === this.lastLayer &&
      symbolization === this.lastSymbolization &&
      previewProperty === this.lastPreviewProperty
    ) {
      return;
    }
    this.lastLayer = layerConfigs;
    this.lastSymbolization = symbolization;
    this.lastPreviewProperty = previewProperty;
    const style = await loadAndAugmentStyle({
      layerConfigs,
      symbolization,
      previewProperty,
    });
    this.map.setStyle(style, { diff: false });

    if (!this.map.isStyleLoaded()) {
      await new Promise((resolve) => {
        this.map.once("style.load", resolve);

        setTimeout(resolve, 1000);
      });
    }

    if (this.lastData) {
      this.setData({
        data: this.lastData,
        ephemeralState: this.lastEphemeralState,
        force: true,
      });
      this.lastSelection = { type: "none" };
    }
  }

  private updateSelections(newSet: Set<RawId>) {
    if (!this.map || !(this.map as any).style) return;
    const oldSet = this.lastSelectionIds;
    const tmpSet = new Set(newSet);

    for (const id of tmpSet) {
      if (!oldSet.has(id)) {
        this.map.setFeatureState(
          {
            source: FEATURES_SOURCE_NAME,
            id,
          },
          {
            state: "selected",
          },
        );
        tmpSet.delete(id);
      }
    }

    for (const id of oldSet) {
      if (!tmpSet.has(id)) {
        this.map.removeFeatureState(
          {
            source: FEATURES_SOURCE_NAME,
            id,
          },
          "state",
        );
      }
    }

    this.lastSelectionIds = newSet;
  }
}
