import GeoTIFF from "./geotiff";

export function fromArrayBuffer(blob: ArrayBuffer) {
  return GeoTIFF.fromSource({
    fetch(start: number, length: number) {
      return Promise.resolve(blob.slice(start, start + length));
    },
  });
}
