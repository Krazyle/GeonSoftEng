import { atom } from "jotai";
import type { IWrappedFeature } from "types";

export enum Mode {
  NONE = "NONE",
  LASSO = "LASSO",
  DRAW_POINT = "DRAW_POINT",
  DRAW_LINE = "DRAW_LINE",
  DRAW_RECTANGLE = "DRAW_RECTANGLE",
  DRAW_POLYGON = "DRAW_POLYGON",
  DRAW_CIRCLE = "DRAW_CIRCLE",
  DRAW_ROUTE = "DRAW_ROUTE",
}

export enum CIRCLE_TYPE {
  MERCATOR = "Mercator",
  GEODESIC = "Geodesic",
  DEGREES = "Degrees",
}

export enum ROUTE_TYPE {
  DRIVING = "driving",
  WALKING = "walking",
  CYCLING = "cycling",
}

interface ModeOptions {
  hasResizedRectangle?: boolean;

  reverse?: boolean;

  multi?: boolean;

  circleType?: CIRCLE_TYPE;

  replaceGeometryForId?: IWrappedFeature["id"] | null;
}

export const MODE_INFO: Record<
  Mode,
  {
    label: string;
  }
> = {
  [Mode.NONE]: { label: "Select" },
  [Mode.DRAW_POINT]: { label: "Point" },
  [Mode.DRAW_LINE]: { label: "Line" },
  [Mode.DRAW_RECTANGLE]: { label: "Rectangle" },
  [Mode.DRAW_POLYGON]: { label: "Polygon" },
  [Mode.DRAW_CIRCLE]: { label: "Circle" },
  [Mode.LASSO]: { label: "Lasso" },
  [Mode.DRAW_ROUTE]: { label: "Route" },
};

export type ModeWithOptions = {
  mode: Mode;
  modeOptions?: ModeOptions;
};

export const modeAtom = atom<ModeWithOptions>({
  mode: Mode.NONE,
});
