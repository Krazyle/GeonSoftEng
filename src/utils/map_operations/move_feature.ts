import type { AllGeoJSON } from "@turf/helpers";
import { coordEach } from "@turf/meta";
import cloneDeep from "lodash/cloneDeep";
import type { Feature } from "types";
import {
  getCircleProp,
  getCircleRadius,
  makeCircleNative,
} from "@/utils/circle";

function validLatitude(lat: number) {
  return lat >= -90 && lat <= 90;
}

export function moveFeature(feature: Feature, dx: number, dy: number) {
  const geometry = cloneDeep(feature.geometry);

  let movingMakesFeatureInvalid = true;

  if (geometry) {
    const prop = getCircleProp(feature);
    const value = getCircleRadius(feature);

    if (prop && value) {
      const center: Pos2 = [prop.center[0] - dx, prop.center[1] - dy];

      const geometry = makeCircleNative({
        center,
        type: prop.type,
        value,
      });

      return {
        ...feature,
        properties: {
          ...feature.properties,
          "@circle": {
            ...prop,
            center,
          },
        },
        geometry,
      };
    }

    const seen = new Set();

    coordEach(geometry as AllGeoJSON, (coord) => {
      const [x, y] = coord;

      if (seen.has(coord)) {
        return;
      }
      seen.add(coord);
      coord[0] = x - dx;
      coord[1] = y - dy;

      if (validLatitude(y) === true && validLatitude(coord[1]) === false) {
        movingMakesFeatureInvalid = false;
      }
    });
  }

  if (!movingMakesFeatureInvalid) {
    return feature;
  }

  return {
    ...feature,
    geometry,
  };
}
