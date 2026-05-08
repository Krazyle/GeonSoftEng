import type { Operation } from "fast-json-patch";
import { applyPatch } from "fast-json-patch";
import type { Feature } from "types";
import { idToJSONPointers } from "@/utils/id";
import * as jsonpointer from "@/utils/pointer";

function offsetPointer(pointer: string) {
  return pointer.replace(/(\d+)$/, (index) => {
    return (parseInt(index, 10) + 1).toString();
  });
}

export function spliceNewVertex({
  feature,
  id,
  position,
}: {
  feature: Feature;
  id: MidpointId;
  position: Pos2;
}): Feature {
  const [pointer] = idToJSONPointers(id, feature);

  const patch: Operation = {
    op: "add",
    path: offsetPointer(pointer),
    value: position,
  };

  const copy = jsonpointer.clone(feature, pointer);
  applyPatch(copy, [patch]);

  return copy;
}
