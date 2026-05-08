import type { IWrappedFeature } from "types";

export interface IDMap {
  uuids: string[];

  intids: Map<string, RawId>;
}

export const UIDMap = {
  empty(): IDMap {
    return {
      uuids: [],
      intids: new Map(),
    };
  },

  loadIdsFromPersistence(wrappedFeatures: IWrappedFeature[]): IDMap {
    const map = UIDMap.empty();
    for (const { id } of wrappedFeatures) {
      UIDMap.pushUUID(map, id);
    }
    return map;
  },

  pushUUID(map: IDMap, uuid: string): void {
    if (map.intids.has(uuid)) return;
    const index = map.uuids.push(uuid) - 1;
    map.intids.set(uuid, index as RawId);
  },
  deleteUUID(map: IDMap, uuid: string): void {
    const index = map.intids.get(uuid);
    if (index === undefined) return;

    delete map.uuids[index];
    map.intids.delete(uuid);
  },
  getUUID(map: IDMap, intid: number): string {
    return map.uuids[intid];
  },
  getIntID(map: IDMap, uuid: string): RawId {
    return map.intids.get(uuid)!;
  },
};
