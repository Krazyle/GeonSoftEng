import type { PartialLayer } from "@/stores/jotai";
import { targetSize } from "./constants";

export function mapboxStaticURL(
  mapboxLayer: Pick<PartialLayer, "type" | "url" | "token">,
) {
  switch (mapboxLayer.type) {
    case "MAPBOX": {
      const params = new URLSearchParams({
        access_token: mapboxLayer.token,
        attribution: "false",
        logo: "false",
      }).toString();
      const u = new URL(mapboxLayer.url);
      const p = u.pathname.replace("//styles", "");
      return `https://api.mapbox.com/styles/v1${p}/static/[-136.3106,-35.8527,-22.7311,59.8357]/${targetSize.join(
        "x",
      )}@2x?${params}`;
    }
    case "XYZ": {
      return mapboxLayer.url
        .replace("{x}", "0")
        .replace("{y}", "0")
        .replace("{z}", "0");
    }
    case "TILEJSON": {
      return mapboxLayer.url
        .replace("{x}", "0")
        .replace("{y}", "0")
        .replace("{z}", "0");
    }
  }
}
