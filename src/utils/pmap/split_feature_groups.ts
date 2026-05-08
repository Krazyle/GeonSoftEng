import type { Feature, ISymbolization } from "types";
import type { Data, PreviewProperty } from "@/stores/jotai";
import { EMPTY_ARRAY, emptySelection } from "@/utils/constants";
import { generateExclude } from "@/utils/folder";
import { encodeId } from "@/utils/id";
import { type IDMap, UIDMap } from "@/utils/id_mapper";
import { generateSyntheticPoints } from "./generate_synthetic_points";
import { fixDegenerates } from "./merge_ephemeral_state";
import { getKeepProperties, stripFeature } from "./strip_features";

interface SplitGroups {
  selectionIds: Set<RawId>;
  synthetic: Feature[];
  ephemeral: Feature[];
  features: Feature[];
}

export function splitFeatureGroups({
  data,
  lastSymbolization,
  idMap,
  previewProperty,
}: {
  data: Data;
  lastSymbolization: ISymbolization | null;
  idMap: IDMap;
  previewProperty: PreviewProperty;
}): SplitGroups {
  const { selection, folderMap, featureMap } = data;

  const features: Feature[] = [];
  let selectedFeature: Feature | null = null;

  const exclude = generateExclude(folderMap);

  const keepProperties = getKeepProperties({
    symbolization: lastSymbolization,
    previewProperty,
  });

  for (const feature of featureMap.values()) {
    if (feature.folderId && exclude.size && exclude.has(feature.folderId)) {
      continue;
    }
    if (feature.feature.properties?.visibility === false) {
      continue;
    }
    if (selection.type === "single" && feature.id === selection.id) {
      selectedFeature = stripFeature({
        wrappedFeature: feature,
        keepProperties,
        idMap,
      });
    } else {
      features.push(
        stripFeature({
          wrappedFeature: feature,
          keepProperties,
          idMap,
        }),
      );
    }
  }

  const noneResult = {
    synthetic: EMPTY_ARRAY,
    ephemeral: EMPTY_ARRAY,
    features,
    selectionIds: emptySelection,
  } as const;

  switch (selection.type) {
    case "single": {
      const { id } = selection;
      if (!selectedFeature) {
        return noneResult;
      }

      const selectionIds = new Set<RawId>(selection.parts.map(encodeId));
      return {
        synthetic: generateSyntheticPoints(
          selectedFeature,
          UIDMap.getIntID(idMap, id),
        ),
        ephemeral: [fixDegenerates(selectedFeature)],
        features,
        selectionIds,
      };
    }
    case "folder":
    case "none": {
      return noneResult;
    }
    case "multi": {
      const selectionIds = new Set<RawId>(
        selection.ids.map((uuid) => UIDMap.getIntID(idMap, uuid)),
      );
      return {
        synthetic: EMPTY_ARRAY,
        ephemeral: EMPTY_ARRAY,
        features,
        selectionIds,
      };
    }
  }
}
