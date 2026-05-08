import type { Feature } from "types";
import type { BufferOptions } from "@/utils/buffer";
import { lib } from "@/utils/worker";

export async function buffer(feature: Feature, options: BufferOptions) {
  return lib.bufferFeature(feature, options);
}
