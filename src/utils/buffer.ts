import center from "@turf/center";
import type { AllGeoJSON, Units } from "@turf/helpers";
import { earthRadius, lengthToRadians, radiansToLength } from "@turf/helpers";
import { type GeoProjection, geoAzimuthalEquidistant } from "d3-geo";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import BufferOp from "jsts/org/locationtech/jts/operation/buffer/BufferOp.js";
import type { CoordinateHavers, Geometry, IFeature, Position } from "types";

export interface BufferOptions {
  radius: number;
  units: Units;
  quadrantSegments: number;
}

export function bufferFeature(
  feature: IFeature<Geometry | null>,
  options: BufferOptions,
) {
  return {
    ...feature,
    geometry: feature.geometry
      ? bufferGeometry(feature.geometry, options)
      : feature.geometry,
  };
}

function bufferGeometry(
  geometry: Geometry,
  options: BufferOptions,
): Geometry | null {
  if (geometry.type === "GeometryCollection") {
    const geometries: Geometry[] = [];
    for (const geom of geometry.geometries) {
      const buffered = bufferGeometry(geom, options);
      if (buffered) geometries.push(buffered);
    }
    return {
      ...geometry,
      geometries,
    };
  }

  const projection = defineProjection(geometry);
  const projected = {
    type: geometry.type,
    coordinates: projectCoords(geometry.coordinates, projection),
  };

  const reader = new GeoJSONReader(new GeometryFactory());
  const geom = reader.read(projected);
  const distance = radiansToLength(
    lengthToRadians(options.radius, options.units),
    "meters",
  );
  let buffered = BufferOp.bufferOp(geom, distance, options.quadrantSegments);
  const writer = new GeoJSONWriter();
  buffered = writer.write(buffered);

  if (coordsIsNaN(buffered.coordinates)) return null;
  return {
    type: buffered.type,
    coordinates: unprojectCoords(buffered.coordinates, projection) as any,
  };
}

type Coords = CoordinateHavers["coordinates"];

function coordsIsNaN(coords: Coords): boolean {
  if (Array.isArray(coords[0])) return coordsIsNaN(coords[0]);
  return Number.isNaN(coords[0]);
}

function projectCoords(coords: Coords, proj: GeoProjection): Coords {
  if (typeof coords[0] !== "object") return proj(coords as any) as Position;
  return coords.map((coord) => projectCoords(coord as any, proj)) as Coords;
}

function unprojectCoords(coords: Coords, proj: GeoProjection): Coords {
  if (typeof coords[0] !== "object")
    return proj.invert!(coords as any) as Position;
  return coords.map((coord) => unprojectCoords(coord as any, proj)) as Coords;
}

function defineProjection(geojson: Geometry): GeoProjection {
  const coords = center(geojson as AllGeoJSON).geometry.coordinates;
  const rotation: [number, number] = [-coords[0], -coords[1]];
  return geoAzimuthalEquidistant().rotate(rotation).scale(earthRadius);
}
