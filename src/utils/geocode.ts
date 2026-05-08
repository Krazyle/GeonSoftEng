import Fuse, { type FuseResult } from "fuse.js";
import pick from "lodash/pick";
import type { LngLat } from "maplibre-gl";
import { Either, Left, Right } from "purify-ts/Either";
import type { JsonObject } from "type-fest";
import type {
  IFeature,
  IFeatureCollection,
  IWrappedFeature,
  Point,
} from "types";
import { z } from "zod";
import type { Action } from "@/features/context_actions/components/action_item";
import type { ContainerNode, LeafNode } from "@/utils/tree";
import { ConvertError } from "./errors";
import {
  bboxToPolygon,
  formatCoordinates,
  parseBBOX,
  parseCoordinates,
} from "./geometry";
import { truncate } from "./utils";

interface TreeFolder {
  folderId: any;
  name: string;
  id: any;
}

interface TreeWfc {
  name: string;
  wrappedFeatureCollectionFolderId: any;
}

type SearchIndex = Fuse<IWrappedFeature>;

type QItemWrappedFeature = {
  type: "wrappedFeature";
  result: FuseResult<IWrappedFeature>;
};

type QItemAction = {
  type: "action";
  action: Action;
};

type QItemCoordinate = {
  type: "coordinate";
  name: string;
  coordinates: [number, number];
};

type QItemExtent = {
  type: "extent";
  name: string;
  coordinates: [number, number, number, number];
};

type QItemContainerNode = ContainerNode<TreeFolder, TreeWfc>;
type QItemLeafNode = LeafNode<TreeWfc>;

export type QItemAddable = IGeocoderFeature | QItemCoordinate | QItemExtent;

export type QItem =
  | QItemAddable
  | QItemWrappedFeature
  | QItemAction
  | QItemContainerNode
  | QItemLeafNode;

const zBBox4 = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const GeocoderProperties = z
  .object({
    id: z.string(),
    label: z.string(),
  })
  .passthrough();

type IGeocoderProperties = z.infer<typeof GeocoderProperties>;

const zPoint: z.ZodType<Point> = z.lazy(() =>
  z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).min(2),
  }),
);

const GeocoderFeature = z.object({
  type: z.literal("Feature"),
  geometry: zPoint,
  bbox: z.optional(zBBox4),
  properties: GeocoderProperties,
});

type IGeocoderFeature = IFeature<Point, IGeocoderProperties>;

export const GeocodeEarthResult: z.ZodType<
  IFeatureCollection<Point, IGeocoderProperties>
> = z.lazy(() => {
  return z.object({
    bbox: z.optional(zBBox4),
    geocoding: z.any(),
    type: z.literal("FeatureCollection"),
    features: z.array(GeocoderFeature),
  });
});

export function coordFeature(
  pos: Pos2,
  flip = false,
): Either<ConvertError, QItemCoordinate> {
  if (flip) {
    pos = pos.slice().reverse() as Pos2;
  }
  if (pos[1] > 90 || pos[1] < -90) {
    return Left(new ConvertError("Coordinate out of bounds"));
  }
  return Right({
    type: "coordinate",
    name: `${formatCoordinates(pos)}`,
    coordinates: pos,
  });
}

export function bboxToQItem(bbox: BBox4): QItemExtent {
  return {
    type: "extent",
    name: `${bbox.join(",")}`,
    coordinates: bbox,
  };
}

export function getQItemNamePreview(item: QItemAddable): string {
  switch (item.type) {
    case "Feature": {
      return truncate(item.properties.label, 24);
    }
    case "extent": {
      return item.name;
    }
    case "coordinate": {
      return item.name;
    }
  }
}

function includeProperties(properties: JsonObject, includeData = false) {
  if (includeData || !properties) return properties;
  return pick(properties, ["name", "label"]);
}

export function qItemToPolygon(
  item: QItemAddable,
  includeData = false,
): IFeature | null {
  switch (item.type) {
    case "coordinate":
      return null;
    case "Feature": {
      if (item.bbox) {
        return {
          type: "Feature",
          geometry: bboxToPolygon(item.bbox),

          properties: includeProperties(
            item.properties as JsonObject,
            includeData,
          ),
        };
      }
      return null;
    }
    case "extent": {
      return {
        type: "Feature",
        geometry: bboxToPolygon(item.coordinates),
        properties: {},
      };
    }
  }
}

export function qItemToFeature(
  item: QItemAddable,
  includeData = false,
): IFeature {
  switch (item.type) {
    case "Feature": {
      return {
        ...item,

        properties: includeProperties(
          item.properties as JsonObject,
          includeData,
        ),
      };
    }
    case "extent": {
      return {
        type: "Feature",
        geometry: bboxToPolygon(item.coordinates),
        properties: {},
      };
    }
    case "coordinate": {
      return {
        type: "Feature",
        geometry: {
          coordinates: item.coordinates,
          type: "Point",
        },
        properties: {},
      };
    }
  }
}

export function getLiteralItems(query: string) {
  const coordEither = parseCoordinates(query);
  const coord = coordEither.chain((pos) => coordFeature(pos));
  const coord2 = coordEither.chain((pos) => coordFeature(pos, true));
  const bbox = parseBBOX(query).map(bboxToQItem);
  return Either.rights<ConvertError, QItem>([bbox, coord, coord2]);
}

export function getActions(query: string, actions: Action[]): QItemAction[] {
  const searchIndex = new Fuse(actions, {
    keys: ["label"],
    isCaseSensitive: false,
    threshold: 0.2,
    ignoreLocation: true,
  });
  const results = searchIndex.search(query, {
    limit: 5,
  });
  return results.map((result) => {
    return {
      type: "action",
      action: result.item,
    };
  });
}

function getFeatureItems(
  query: string,
  searchIndex: SearchIndex,
): QItemWrappedFeature[] {
  const results = searchIndex.search(query, {
    limit: 5,
  });
  return results.map((result) => {
    return {
      type: "wrappedFeature",
      result,
    };
  });
}

export interface GeocoderResults {
  literal: QItem[];
  features: QItem[];
  geocoder: QItem[];
  actions: QItem[];
}

export async function geocodeEarth({
  query,
  center,
  signal,
  searchIndex,
  actions,
}: {
  query: string;
  center: LngLat | undefined;
  zoom: number | undefined;
  signal: AbortSignal | undefined;
  searchIndex: SearchIndex;
  actions: Action[];
}): Promise<GeocoderResults> {
  if (!query) {
    return {
      literal: [],
      features: [],
      geocoder: [],
      actions: [],
    };
  }

  const params = {
    q: query,
    format: "geojson",
    limit: "5",
    ...(center
      ? {
          lat: center.lat.toString(),
          lon: center.lng.toString(),
        }
      : {}),
  };

  const queryString = new URLSearchParams(params).toString();

  const resp = await (
    await fetch(`https://nominatim.openstreetmap.org/search?${queryString}`, {
      signal: signal || null,
      headers: {
        "User-Agent": "Application (Nominatim Implementation)",
      },
    })
  ).json();

  const geocoderFeatures: IGeocoderFeature[] = (resp.features || []).map(
    (f: any) => ({
      type: "Feature",
      geometry: f.geometry,
      bbox: f.bbox,
      properties: {
        id: f.properties.place_id.toString(),
        label: f.properties.display_name,
      },
    }),
  );

  return {
    literal: getLiteralItems(query),
    actions: getActions(query, actions),
    features: getFeatureItems(query, searchIndex),
    geocoder: geocoderFeatures,
  };
}
