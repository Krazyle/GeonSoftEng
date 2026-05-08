import once from "lodash/once";
import type maplibregl from "maplibre-gl";
import { toast } from "react-hot-toast";
import type { ILayerConfig } from "types";
import { getMapboxLayerURL, getTileJSON } from "@/utils/utils";

const warnOffline = once(() => {
  toast.error("Offline: falling back to blank background");
});

export async function addMapboxStyle(
  _base: maplibregl.StyleSpecification,
  layer: ILayerConfig,
): Promise<maplibregl.StyleSpecification> {
  const url = getMapboxLayerURL(layer);

  const style: maplibregl.StyleSpecification = await fetch(url)
    .then((res) => {
      if (!res?.ok) {
        throw new Error("Could not fetch layer");
      }
      return res.json();
    })
    .catch(() => {
      warnOffline();
      return {
        version: 8,
        name: "Empty",
        sources: {},
        layers: [],
      };
    });

  const updatedStyle = updateMapboxStyle(style, {
    labelVisibility: layer.labelVisibility,
    rasterOpacity: layer.opacity,
  });
  return updatedStyle;
}

function updateMapboxStyle(
  style: maplibregl.StyleSpecification,
  options: {
    labelVisibility?: boolean;
    rasterOpacity?: number;
  },
): maplibregl.StyleSpecification {
  const { labelVisibility = true, rasterOpacity } = options;

  if (!style.layers) {
    return style;
  }

  const isSatelliteStyle =
    style.name === "Mapbox Satellite Streets" ||
    style.name === "Mapbox Satellite";

  const updatedLayers = style.layers
    .map((layer) => {
      const isLabelLayer =
        layer.type === "symbol" && layer.layout?.["text-field"] !== undefined;

      if (!labelVisibility && isLabelLayer) {
        return null;
      }

      if (
        isSatelliteStyle &&
        layer.type === "raster" &&
        rasterOpacity !== undefined
      ) {
        return {
          ...layer,
          paint: {
            ...(layer.paint || {}),
            "raster-opacity": rasterOpacity,
          },
        };
      }

      if (isSatelliteStyle && layer.type === "background" && layer.paint) {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            "background-color": "#ffffff",
          },
        };
      }

      return layer;
    })
    .filter(Boolean) as maplibregl.LayerSpecification[];

  return {
    ...style,
    layers: updatedLayers,
  };
}
function paintLayoutFromRasterLayer(
  layer: ILayerConfig,
): Pick<maplibregl.RasterLayerSpecification, "type" | "paint" | "layout"> {
  return {
    type: "raster",
    paint: {
      "raster-opacity": layer.opacity,
    },
    layout: {
      visibility: layer.visibility ? "visible" : "none",
    },
  };
}

export async function addTileJSONStyle(
  style: maplibregl.StyleSpecification,
  layer: ILayerConfig,
  id: number,
) {
  const sourceId = `appInternalSource${id}`;
  const layerId = `appInternalLayer${id}`;

  try {
    const resp = await getTileJSON(layer.url);

    style.sources[sourceId] = {
      type: "raster",
      tiles: resp.tiles,
      scheme: resp.scheme || "xyz",
      tileSize: 256,
      minzoom: resp.minzoom,
      maxzoom: resp.maxzoom,
    };

    const newLayer = {
      id: layerId,
      source: sourceId,
      ...paintLayoutFromRasterLayer(layer),
    } as maplibregl.LayerSpecification;

    style.layers.push(newLayer);
  } catch (_e) {
    toast.error(
      "A TileJSON layer failed to load: the server it depends on may be down",
    );
  }
  return style;
}

export function addXYZStyle(
  style: maplibregl.StyleSpecification,
  layer: ILayerConfig,
  id: number,
) {
  const sourceId = `appInternalSource${id}`;
  const layerId = `appInternalLayer${id}`;

  style.sources[sourceId] = {
    type: "raster",
    tiles: [layer.url],
    scheme: layer.tms ? "tms" : "xyz",
    tileSize: 256,
  };

  const newLayer = {
    id: layerId,
    source: sourceId,
    ...paintLayoutFromRasterLayer(layer),
  } as maplibregl.LayerSpecification;

  style.layers.push(newLayer);

  return style;
}
