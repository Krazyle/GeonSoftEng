const BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
const BASE32_CODES_DICT: Record<string, number> = {};
for (let i = 0; i < BASE32_CODES.length; i++) {
  BASE32_CODES_DICT[BASE32_CODES.charAt(i)] = i;
}

const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LON = -180;
const MAX_LON = 180;

export function encode(
  [longitude, latitude]: [number, number],
  numberOfChars = 9,
) {
  const chars = [];
  let bits = 0;
  let bitsTotal = 0;
  let hash_value = 0;
  let maxLat = MAX_LAT;
  let minLat = MIN_LAT;
  let maxLon = MAX_LON;
  let minLon = MIN_LON;
  let mid: number;
  while (chars.length < numberOfChars) {
    if (bitsTotal % 2 === 0) {
      mid = (maxLon + minLon) / 2;
      if (longitude > mid) {
        hash_value = (hash_value << 1) + 1;
        minLon = mid;
      } else {
        hash_value = (hash_value << 1) + 0;
        maxLon = mid;
      }
    } else {
      mid = (maxLat + minLat) / 2;
      if (latitude > mid) {
        hash_value = (hash_value << 1) + 1;
        minLat = mid;
      } else {
        hash_value = (hash_value << 1) + 0;
        maxLat = mid;
      }
    }

    bits++;
    bitsTotal++;
    if (bits === 5) {
      const code = BASE32_CODES[hash_value];
      chars.push(code);
      bits = 0;
      hash_value = 0;
    }
  }
  return chars.join("");
}

function decode_bbox(hash_string: string) {
  let isLon = true;
  let maxLat = MAX_LAT;
  let minLat = MIN_LAT;
  let maxLon = MAX_LON;
  let minLon = MIN_LON;
  let mid: number;

  let hashValue = 0;
  for (let i = 0, l = hash_string.length; i < l; i++) {
    const code = hash_string[i].toLowerCase();
    hashValue = BASE32_CODES_DICT[code];

    for (let bits = 4; bits >= 0; bits--) {
      const bit = (hashValue >> bits) & 1;
      if (isLon) {
        mid = (maxLon + minLon) / 2;
        if (bit === 1) {
          minLon = mid;
        } else {
          maxLon = mid;
        }
      } else {
        mid = (maxLat + minLat) / 2;
        if (bit === 1) {
          minLat = mid;
        } else {
          maxLat = mid;
        }
      }
      isLon = !isLon;
    }
  }
  return [minLat, minLon, maxLat, maxLon];
}

export function decode(hashString: string) {
  const bbox = decode_bbox(hashString);
  const lat = (bbox[0] + bbox[2]) / 2;
  const lon = (bbox[1] + bbox[3]) / 2;

  return [lon, lat];
}
