import { useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import type {
  IFolder,
  ILayerConfig,
  IWrappedFeature,
  LayerConfigMap,
} from "types";
import { type Data, dataAtom, momentLogAtom } from "@/stores/jotai";
import { fMoment, type Moment, type MomentInput, UMomentLog } from "./moment";

export function trackMoment(partialMoment: Partial<MomentInput>) {
  const { track } = partialMoment;
  if (track) {
    delete partialMoment.track;
  }
}

export function momentForDeleteFeatures(
  features: readonly IWrappedFeature["id"][],
  { featureMap }: Data,
): Moment {
  const moment = fMoment("Update features");
  for (const id of features) {
    const feature = featureMap.get(id);
    if (feature) {
      moment.putFeatures.push(feature);
    }
  }
  return moment;
}

export function momentForDeleteLayerConfigs(
  layerConfigs: readonly ILayerConfig["id"][],
  layerConfigMap: LayerConfigMap,
): Moment {
  const moment = fMoment("Update layers");
  for (const id of layerConfigs) {
    const layerConfig = layerConfigMap.get(id);
    if (layerConfig) {
      moment.putLayerConfigs.push(layerConfig);
    }
  }
  return moment;
}

export function momentForDeleteFolders(
  folders: readonly IFolder["id"][],
  { folderMap }: Data,
): Moment {
  const moment = fMoment("Update folders");
  for (const id of folders) {
    const folder = folderMap.get(id);
    if (folder) {
      moment.putFolders.push(folder);
    }
  }
  return moment;
}

function getLastAtInMap(map: Map<unknown, IFolder | IWrappedFeature>): string {
  let lastAt = "a0";
  for (const val of map.values()) {
    lastAt = val.at;
  }
  return lastAt;
}

export function getFreshAt(ctx: Data): string {
  const a = getLastAtInMap(ctx.featureMap);
  const b = getLastAtInMap(ctx.folderMap);
  return a > b ? a : b;
}

export function useEndSnapshot() {
  return useAtomCallback(
    useCallback((_get, set) => {
      set(momentLogAtom, (momentLog) => UMomentLog.endSnapshot(momentLog));
    }, []),
  );
}

export function useStartSnapshot() {
  return useAtomCallback(
    useCallback(
      (_get, set, feature: Parameters<typeof UMomentLog.startSnapshot>[1]) => {
        set(momentLogAtom, (momentLog) =>
          UMomentLog.startSnapshot(momentLog, feature),
        );
      },
      [],
    ),
  );
}

export function usePopMoment() {
  return useAtomCallback(
    useCallback((_get, set, n: number) => {
      set(momentLogAtom, (momentLog) => UMomentLog.popMoment(momentLog, n));
    }, []),
  );
}

export function useFeatureMap(): Map<string, IWrappedFeature> {
  return useAtomValue(dataAtom).featureMap;
}
