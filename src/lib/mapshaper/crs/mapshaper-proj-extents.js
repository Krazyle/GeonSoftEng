import { getCircleGeoJSON } from "../buffer/mapshaper-point-buffer";
import { projectDataset } from "../commands/mapshaper-proj";
import { convertBboxToGeoJSON } from "../commands/mapshaper-rectangle";
import { rotateDataset } from "../commands/mapshaper-rotate";
import { getCrsSlug, inList } from "../crs/mapshaper-proj-info";
import { getCircleRadiusFromAngle } from "../crs/mapshaper-proj-utils";
import { importGeoJSON } from "../geojson/geojson-import";
import { error, message, verbose } from "../utils/mapshaper-logging";

export function getClippingDataset(src, dest, opts) {
  return getUnprojectedBoundingPolygon(src, dest, opts);
}

function getUnprojectedBoundingPolygon(src, dest, opts) {
  var dataset;
  if (isCircleClippedProjection(dest) || opts.clip_angle || dest.clip_angle) {
    dataset = getBoundingCircle(src, dest, opts);
  } else if (isRectangleClippedProjection(dest) || opts.clip_bbox) {
    dataset = getBoundingRectangle(dest, opts);
  }
  return dataset || null;
}

function _getPolygonDataset(src, dest, opts) {
  var dataset = getUnprojectedBoundingPolygon(src, dest, opts);
  if (!dataset) {
    dataset = getBoundingRectangle(dest, { clip_bbox: [-180, -90, 180, 90] });
  }
  projectDataset(dataset, src, dest, { no_clip: false, quiet: true });
  return dataset;
}

function _getOutlineDataset(src, dest, opts) {
  var dataset = getUnprojectedBoundingPolygon(src, dest, opts);
  if (dataset) {
    projectDataset(dataset, src, dest, { no_clip: false, quiet: true });
    dataset.layers[0].geometry_type = "polyline";
  }
  return dataset || null;
}

function getBoundingRectangle(dest, opts) {
  var bbox = opts.clip_bbox || getDefaultClipBBox(dest);
  var rotation = getRotationParams(dest);
  if (!bbox) error("Missing expected clip bbox.");
  opts = Object.assign({ interval: 0.5 }, opts);
  var geojson = convertBboxToGeoJSON(bbox, opts);
  var dataset = importGeoJSON(geojson);
  if (rotation) {
    rotateDataset(dataset, { rotation: rotation, invert: true });
  }
  return dataset;
}

function getBoundingCircle(src, dest, opts) {
  var angle = opts.clip_angle || dest.clip_angle || getDefaultClipAngle(dest);
  if (!angle) return null;
  verbose(`Using clip angle of ${+angle.toFixed(2)} degrees`);
  var dist = getClippingRadius(src, angle);
  var cp = getProjCenter(dest);

  dest.clip_angle = angle;
  var geojson = getCircleGeoJSON(cp, dist, null, opts);
  return importGeoJSON(geojson);
}

function isRectangleClippedProjection(P) {
  return inList(P, "merc,bertin1953");
}

function getDefaultClipBBox(P) {
  var e = 1e-3;
  var slug = getCrsSlug(P);
  var tmerc = [-179, -90, 179, 90];
  var bbox = {
    tmerc: tmerc,
    utm: tmerc,
    etmerc: tmerc,
    merc: [-180, -89, 180, 89],
    lcc: [-180, -89, 180, 89],
    bertin1953: [-180 + e, -90 + e, 180 - e, 90 - e],
  }[slug];
  return bbox;
}

export function getClampBBox(P) {
  var bbox;
  if (inList(P, "merc,lcc")) {
    bbox = getDefaultClipBBox(P);
  }
  return bbox;
}

function isCircleClippedProjection(P) {
  return inList(P, "stere,sterea,ups,ortho,gnom,laea,nsper,tpers");
}

function getPerspectiveClipAngle(P) {
  var h = parseFloat(P.params.h.param);
  if (!h || h < 0) {
    return 0;
  }
  var theta = (Math.acos(P.a / (P.a + h)) * 180) / Math.PI;
  theta *= 0.995;
  return theta;
}

function getDefaultClipAngle(P) {
  var slug = getCrsSlug(P);
  if (slug === "nsper") return getPerspectiveClipAngle(P);
  if (slug === "tpers") {
    message(
      "Automatic clipping is not supported for the Tilted Perspective projection",
    );
    return 0;
  }
  return (
    {
      gnom: 60,
      laea: 179,
      ortho: 89.9,
      stere: 142,
      sterea: 142,
      ups: 10.5,
    }[slug] || 0
  );
}

function getRotationParams(P) {
  var slug = getCrsSlug(P);
  if (slug === "bertin1953") return [-16.5, -42];
  if (slug === "tmerc" || slug === "utm" || slug === "etmerc") {
    if (P.lam0 !== 0) return [(P.lam0 * 180) / Math.PI];
  }
  return null;
}

function getProjCenter(P) {
  var rtod = 180 / Math.PI;
  return [P.lam0 * rtod, P.phi0 * rtod];
}

function getClippingRadius(P, angle) {
  return getCircleRadiusFromAngle(P, angle);
}
