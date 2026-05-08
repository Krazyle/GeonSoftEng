declare module "geometric" {
  export type Point = [number, number];

  export type Line = [Point, Point];

  export type Polygon = Point[];

  export function pointRotate(
    point: Point,
    angle: number,
    origin?: Point,
  ): Point;

  export function pointTranslate(
    point: Point,
    angle: number,
    distance: number,
  ): Point;

  export function lineAngle(line: Line): number;
  export function lineRotate(
    line: Line,
    angle: number,
    origin: [number, number],
  ): Line;

  export function lineInterpolate(line: Line): LineInterpolator;

  export type LineInterpolator = (t: number) => Point;

  export function lineLength(line: Line): number;

  export function lineMidpoint(line: Line): Point;

  export function polygonArea(polygon: Polygon, signed?: boolean): number;

  export function polygonBounds(polygon: Polygon): null | [Point, Point];

  export function polygonCentroid(polygon: Polygon): Point;

  export function polygonHull(points: Point[]): Polygon;

  export function polygonLength(polygon: Polygon): number;

  export function polygonMean(polygon: Polygon): Point;

  export function polygonRegular(
    sides?: number,
    area?: number,
    center?: Point,
  ): Polygon;

  export function polygonRotate(
    polygon: Polygon,
    angle: number,
    origin?: Point,
  ): Polygon;

  export function polygonScale(
    polygon: Polygon,
    scaleFactor: number,
    origin?: Point,
  ): Polygon;

  export function polygonTranslate(
    polygon: Polygon,
    angle: number,
    distance: number,
  ): Polygon;

  export function lineIntersectsLine(lineA: Line, lineB: Line): boolean;

  export function lineIntersectsPolygon(line: Line, polygon: Polygon): boolean;

  export function pointInPolygon(point: Point, polygon: Polygon): boolean;

  export function pointOnPolygon(point: Point, polygon: Polygon): boolean;

  export function pointOnLine(point: Point, line: Line): boolean;

  export function pointWithLine(point: Point, line: Line): boolean;

  export function pointLeftofLine(point: Point, line: Line): boolean;

  export function pointRightofLine(point: Point, line: Line): boolean;

  export function polygonInPolygon(
    polygonA: Polygon,
    polygonB: Polygon,
  ): boolean;

  export function polygonIntersectsPolygon(
    polygonA: Polygon,
    polygonB: Polygon,
  ): boolean;

  export function angleReflect(
    incidenceAngle: number,
    surfaceAngle: number,
  ): number;

  export function angleToDegrees(angle: number): number;

  export function angleToRadians(angle: number): number;
}
