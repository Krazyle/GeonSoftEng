import type {
  Geometry,
  IFeature,
  IFeatureCollection,
  IWrappedFeature,
  Point,
} from "types";
import { UIDMap } from "@/utils/id_mapper";

export type Feature = IFeature<Geometry, any>;
export type FeatureCollection = IFeatureCollection<Geometry, any>;

export const point: Point = {
  type: "Point",
  coordinates: [0, 0],
};

export const pointFeature: IFeature<Point> = {
  type: "Feature",
  properties: {},
  geometry: point,
};

export const twoPoints: IFeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [0, 0] },
    },
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [1, 1] },
    },
  ],
};

export const fcLineString: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
    },
  ],
};

export const fcMultiPoint: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPoint",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    },
  ],
};

export const fcPoly: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 3],
            [0, 3],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

export const fcMultiPoly: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [2, 0],
              [2, 3],
              [0, 3],
              [0, 0],
            ],
          ],
        ],
      },
    },
  ],
};

export const fcTwoPoly: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 3],
            [0, 3],
            [0, 0],
          ],
        ],
      },
      id: "1",
    },
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [10, 10],
            [12, 10],
            [12, 13],
            [10, 13],
            [10, 10],
          ],
        ],
      },
      id: "2",
    },
  ],
};

export const fcLineAndPoly: FeatureCollection = {
  type: "FeatureCollection",
  features: [...fcLineString.features, ...fcPoly.features],
};

export const fcMultiLineString: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [0, 0],
            [1, 1],
          ],
          [
            [2, 2],
            [3, 3],
          ],
        ],
      },
    },
  ],
};

export const realMultiLineString: Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiLineString",
    coordinates: [
      [
        [0, 0],
        [2, 2],
      ],
      [
        [10, 10],
        [12, 12],
      ],
    ],
  },
};

export const fcGeometryCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "GeometryCollection",
        geometries: [
          { type: "Point", coordinates: [0, 0] },
          {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        ],
      },
    },
  ],
};

export const fc = fcLineString;
export const fcPolyHoles: FeatureCollection = fcPoly;
export const fcTwoPolyContainable: FeatureCollection = fcTwoPoly;
export const geometryCollection2: Feature = fcGeometryCollection.features[0];
export const multiPoly2: Feature = fcMultiPoly.features[0];

export const NIL_PREVIEW = "nil";

export function wrap(fc: FeatureCollection): IWrappedFeature<Feature>[] {
  return fc.features.map((f, i) => ({
    id: f.id?.toString() || i.toString(),
    at: i.toString(),
    folderId: null,
    feature: f as Feature,
  }));
}

export function wrapMap(
  fc: FeatureCollection,
): Map<string, IWrappedFeature<Feature>> {
  const map = new Map<string, IWrappedFeature<Feature>>();
  wrap(fc).forEach((wf) => map.set(wf.id, wf));
  return map;
}

export function wrapMapAndId(fc: FeatureCollection) {
  const featureMap = wrapMap(fc);
  const wrappedFeatures = Array.from(featureMap.values());
  return {
    featureMap,
    wrappedFeatures,
    idMap: UIDMap.loadIdsFromPersistence(wrappedFeatures),
    id: fc.features[0]?.id?.toString() || "0",
  };
}

export const exampleFolder = {
  id: "folder-1",
  at: "a0",
  name: "Folder 1",
  expanded: true,
  locked: false,
  folderId: null,
  visibility: true,
};

export const features = fcLineString.features;

export const multiLineString = fcMultiLineString.features[0]
  .geometry as Geometry;
