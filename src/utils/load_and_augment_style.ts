import type maplibregl from "maplibre-gl";
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  StyleSpecification as Style,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { ISymbolization, LayerConfigMap } from "types";
import type { PreviewProperty } from "@/stores/jotai";
import {
  emptyFeatureCollection,
  LINE_COLORS_SELECTED,
} from "@/utils/constants";
import {
  addMapboxStyle,
  addTileJSONStyle,
  addXYZStyle,
} from "@/utils/layer_config_adapters";

function getEmptyStyle() {
  const style: Style = {
    version: 8,
    name: "Empty Style",
    sources: {},
    layers: [],
  };
  return style;
}

const CIRCLE_LAYOUT: CircleLayerSpecification["layout"] = {};

export const FEATURES_SOURCE_NAME = "features";
export const LASSO_SOURCE_NAME = "lasso";
export const EPHEMERAL_SOURCE_NAME = "ephemeral";

const EPHEMERAL_LINE_LAYER_NAME = "ephemeral-line";
const EPHEMERAL_FILL_LAYER_NAME = "ephemeral-fill";

const FEATURES_POINT_HALO_LAYER_NAME = "features-symbol-halo";
const FEATURES_POINT_LAYER_NAME = "features-symbol";
const FEATURES_POINT_LABEL_LAYER_NAME = "features-point-label";
const FEATURES_FILL_LABEL_LAYER_NAME = "features-fill-label";
const FEATURES_LINE_LABEL_LAYER_NAME = "features-line-label";
const FEATURES_LINE_LAYER_NAME = "features-line";
const FEATURES_FILL_LAYER_NAME = "features-fill";
const LASSO_LAYER_NAME = "lasso-layer";

const emptyGeoJSONSource = {
  type: "geojson",
  data: emptyFeatureCollection,

  buffer: 4,
  tolerance: 0,
} as const;

const CONTENT_LAYER_FILTERS: {
  [key: string]: any;
} = {
  [FEATURES_LINE_LAYER_NAME]: [
    "any",
    ["==", "$type", "LineString"],
    ["==", "$type", "Polygon"],
  ],
  [FEATURES_FILL_LAYER_NAME]: ["==", "$type", "Polygon"],
  [FEATURES_POINT_LAYER_NAME]: ["all", ["==", "$type", "Point"]],
};

function _addPreviewFilter(
  filters: any,
  previewProperty: PreviewProperty,
): any {
  if (!previewProperty) return filters;
  return [
    "all",
    filters,
    ["any", ["has", "title"], ["has", "name"], ["has", previewProperty]],
  ];
}

export default async function loadAndAugmentStyle({
  layerConfigs,
  symbolization,
  previewProperty,
}: {
  layerConfigs: LayerConfigMap;
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}): Promise<Style> {
  let style = getEmptyStyle();
  let id = 0;
  const layers = [...layerConfigs.values()].reverse();
  for (const layer of layers) {
    id++;
    switch (layer.type) {
      case "MAPBOX": {
        style = await addMapboxStyle(style, layer);
        break;
      }
      case "XYZ": {
        style = addXYZStyle(style, layer, id);
        break;
      }
      case "TILEJSON": {
        style = await addTileJSONStyle(style, layer, id);
        break;
      }
    }
  }
  addEditingLayers({ style, symbolization, previewProperty });

  return style;
}

export function addEditingLayers({
  style,
  symbolization,
  previewProperty,
}: {
  style: Style;
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}) {
  style.sources[FEATURES_SOURCE_NAME] = emptyGeoJSONSource;
  style.sources[EPHEMERAL_SOURCE_NAME] = emptyGeoJSONSource;
  style.sources[LASSO_SOURCE_NAME] = emptyGeoJSONSource;

  if (!style.layers) {
    throw new Error("Style unexpectedly had no layers");
  }

  style.layers = style.layers.concat(
    makeLayers({ symbolization, previewProperty }),
  );
}

export function makeLayers({
  symbolization,
  previewProperty,
}: {
  symbolization: ISymbolization;
  previewProperty: PreviewProperty;
}): maplibregl.LayerSpecification[] {
  return [
    {
      id: FEATURES_FILL_LAYER_NAME,
      type: "fill",
      source: FEATURES_SOURCE_NAME,
      filter: CONTENT_LAYER_FILTERS[FEATURES_FILL_LAYER_NAME],
      paint: FILL_PAINT(symbolization),
    },

    {
      id: FEATURES_LINE_LAYER_NAME,
      type: "line",
      source: FEATURES_SOURCE_NAME,
      filter: CONTENT_LAYER_FILTERS[FEATURES_LINE_LAYER_NAME],
      paint: LINE_PAINT(symbolization),
    },

    {
      id: EPHEMERAL_FILL_LAYER_NAME,
      type: "fill",
      source: EPHEMERAL_SOURCE_NAME,
      filter: ["==", "$type", "Polygon"],
      paint: FILL_PAINT(symbolization),
    },

    {
      id: EPHEMERAL_LINE_LAYER_NAME,
      type: "line",
      source: EPHEMERAL_SOURCE_NAME,
      filter: [
        "any",
        ["==", "$type", "LineString"],
        ["==", "$type", "Polygon"],
      ],
      paint: LINE_PAINT(symbolization),
    },

    {
      id: FEATURES_POINT_HALO_LAYER_NAME,
      type: "circle",
      source: FEATURES_SOURCE_NAME,
      layout: CIRCLE_LAYOUT,
      filter: CONTENT_LAYER_FILTERS[FEATURES_POINT_LAYER_NAME],
      paint: CIRCLE_PAINT(symbolization, true),
    },

    {
      id: FEATURES_POINT_LAYER_NAME,
      type: "circle",
      source: FEATURES_SOURCE_NAME,
      layout: CIRCLE_LAYOUT,
      filter: CONTENT_LAYER_FILTERS[FEATURES_POINT_LAYER_NAME],
      paint: CIRCLE_PAINT(symbolization),
    },

    {
      id: LASSO_LAYER_NAME,
      type: "fill",
      source: LASSO_SOURCE_NAME,
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-opacity": 0.5,
        "fill-color": "#FDE68A",
        "fill-outline-color": "#905803",
      },
    },

    {
      id: FEATURES_POINT_LABEL_LAYER_NAME,
      type: "symbol",
      source: FEATURES_SOURCE_NAME,
      paint: LABEL_PAINT(symbolization, previewProperty),
      layout: LABEL_LAYOUT(previewProperty, "point"),
      filter: CONTENT_LAYER_FILTERS[FEATURES_POINT_LAYER_NAME],
    } as maplibregl.LayerSpecification,
    {
      id: FEATURES_LINE_LABEL_LAYER_NAME,
      type: "symbol",
      source: FEATURES_SOURCE_NAME,
      paint: LABEL_PAINT(symbolization, previewProperty),
      layout: LABEL_LAYOUT(previewProperty, "line"),
      filter: CONTENT_LAYER_FILTERS[FEATURES_LINE_LAYER_NAME],
    } as maplibregl.LayerSpecification,
    {
      id: FEATURES_FILL_LABEL_LAYER_NAME,
      type: "symbol",
      source: FEATURES_SOURCE_NAME,
      paint: LABEL_PAINT(symbolization, previewProperty),
      layout: LABEL_LAYOUT(previewProperty, "point"),
      filter: CONTENT_LAYER_FILTERS[FEATURES_FILL_LAYER_NAME],
    } as maplibregl.LayerSpecification,
  ];
}

function asNumberExpression({
  symbolization,
  defaultValue = 2,
  part,
}: {
  symbolization: ISymbolization;
  defaultValue?: number;
  part: "stroke-width" | "fill-opacity" | "stroke-opacity";
}): any | number {
  if (symbolization.simplestyle) {
    return ["coalesce", ["get", part], defaultValue];
  }
  return defaultValue;
}

export function asColorExpression({
  symbolization,
  part = "fill",
}: {
  symbolization: ISymbolization;
  part?: "fill" | "stroke";
}): any | string {
  const expression = asColorExpressionInner({ symbolization });
  if (symbolization.simplestyle) {
    return ["coalesce", ["get", part], expression];
  }
  return expression;
}

function asColorExpressionInner({
  symbolization,
}: {
  symbolization: ISymbolization;
}): any | string {
  const { defaultColor } = symbolization;
  switch (symbolization.type) {
    case "none": {
      return defaultColor;
    }
    case "categorical": {
      return [
        "match",
        ["get", symbolization.property],
        ...symbolization.stops.flatMap((stop) => [stop.input, stop.output]),
        defaultColor,
      ];
    }
    case "ramp": {
      return [
        "match",
        ["typeof", ["get", symbolization.property]],
        "number",
        symbolization.interpolate === "linear"
          ? [
              "interpolate-lab",
              ["linear"],
              ["get", symbolization.property],
              ...symbolization.stops.flatMap((stop) => {
                return [stop.input, stop.output];
              }),
            ]
          : [
              "step",
              ["get", symbolization.property],
              defaultColor,
              ...symbolization.stops.flatMap((stop) => {
                return [stop.input, stop.output];
              }),
            ],
        defaultColor,
      ];
    }
  }
}

function LABEL_PAINT(
  _symbolization: ISymbolization,
  _previewProperty: PreviewProperty,
): SymbolLayerSpecification["paint"] {
  const paint: SymbolLayerSpecification["paint"] = {
    "text-halo-color": "#fff",
    "text-halo-width": 1,
    "text-halo-blur": 0.8,
  };
  return paint;
}

function LABEL_LAYOUT(
  previewProperty: PreviewProperty,
  placement: NonNullable<
    SymbolLayerSpecification["layout"]
  >["symbol-placement"],
): SymbolLayerSpecification["layout"] {
  const paint: SymbolLayerSpecification["layout"] = {
    "text-field": [
      "coalesce",
      ["get", previewProperty || "title"],
      ["get", "name"],
      "",
    ],
    "text-variable-anchor": ["top", "bottom", "left", "right"],
    "text-radial-offset": 0.5,
    "symbol-placement": placement,
    "icon-optional": true,
    "text-size": 13,
    "text-justify": "auto",
  };
  return paint;
}

export function CIRCLE_PAINT(
  symbolization: ISymbolization,
  halo = false,
): CircleLayerSpecification["paint"] {
  const r = halo ? 2 : 0;
  if (halo) {
    return {
      "circle-color": [
        "match",
        ["feature-state", "state"],
        "selected",
        "white",
        asColorExpression({
          symbolization,
          part: "stroke",
        }),
      ],
      "circle-radius": [
        "match",
        ["feature-state", "state"],
        "selected",
        6 + r,
        4 + r,
      ],
    };
  }
  return {
    "circle-stroke-color": [
      "match",
      ["feature-state", "state"],
      "selected",
      LINE_COLORS_SELECTED,
      "white",
    ],
    "circle-stroke-width": 1,
    "circle-radius": ["match", ["feature-state", "state"], "selected", 6, 4],
    "circle-opacity": 1,
    "circle-color": [
      "match",
      ["feature-state", "state"],
      "selected",
      "white",
      asColorExpression({
        symbolization,
        part: "stroke",
      }),
    ],
  };
}

function handleSelected(
  expression: any | string,
  exp = false,
  selected: any | string,
) {
  return exp
    ? expression
    : ([
        "match",
        ["feature-state", "state"],
        "selected",
        selected,
        expression,
      ] as any);
}

export function FILL_PAINT(
  symbolization: ISymbolization,
  exp = false,
): FillLayerSpecification["paint"] {
  return {
    "fill-opacity": asNumberExpression({
      symbolization,
      part: "fill-opacity",
      defaultValue:
        typeof symbolization.defaultOpacity === "number"
          ? symbolization.defaultOpacity
          : 0.3,
    }),
    "fill-color": handleSelected(
      asColorExpression({ symbolization, part: "fill" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}

export function LINE_PAINT(
  symbolization: ISymbolization,
  exp = false,
): LineLayerSpecification["paint"] {
  return {
    "line-opacity": asNumberExpression({
      symbolization,
      part: "stroke-opacity",
      defaultValue: 1,
    }),
    "line-width": asNumberExpression({
      symbolization,
      part: "stroke-width",
      defaultValue: 2,
    }),
    "line-color": handleSelected(
      asColorExpression({ symbolization, part: "stroke" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}

const CONTENT_LAYERS = [
  FEATURES_POINT_LAYER_NAME,
  FEATURES_FILL_LAYER_NAME,
  FEATURES_LINE_LAYER_NAME,
];

export const CLICKABLE_LAYERS = CONTENT_LAYERS.concat([
  EPHEMERAL_FILL_LAYER_NAME,
]);
