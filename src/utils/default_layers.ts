import type { ILayerConfig } from "types";

const defaults = {
  type: "MAPBOX",
  token: "",
} as const;

export type LayerConfigTemplate = Pick<
  ILayerConfig,
  "name" | "url" | "type" | "token"
>;

const LAYERS: Record<string, LayerConfigTemplate> = {
  LIBERTY: {
    name: "Liberty",
    url: "https://tiles.openfreemap.org/styles/liberty",
    ...defaults,
  },
  BRIGHT: {
    name: "Bright",
    url: "https://tiles.openfreemap.org/styles/bright",
    ...defaults,
  },
  POSITRON: {
    name: "Positron",
    url: "https://tiles.openfreemap.org/styles/positron",
    ...defaults,
  },
  DARK: {
    name: "Dark Matter",
    url: "https://tiles.openfreemap.org/styles/dark",
    ...defaults,
  },
};

export default LAYERS;
