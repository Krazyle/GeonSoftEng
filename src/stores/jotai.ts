import type { FileSystemHandle } from "browser-fs-access";
import { atom, type createStore } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";
import { focusAtom } from "jotai-optics";
import { atomWithMachine } from "jotai-xstate";
import type { SetOptional } from "type-fest";
import {
  type FeatureMap,
  type FolderMap,
  type IFolder,
  type LayerConfigMap,
  SYMBOLIZATION_NONE,
} from "types";
import { NIL } from "uuid";
import { createMachine } from "xstate";
import {
  CIRCLE_TYPE,
  MODE_INFO,
  Mode,
  modeAtom,
  ROUTE_TYPE,
} from "@/stores/mode";
import type { ScaleUnit } from "@/utils/constants";
import type { ExportOptions } from "@/utils/convert";
import LAYERS from "@/utils/default_layers";
import type { QItemAddable } from "@/utils/geocode";
import type { PersistenceMetadataMemory } from "@/utils/persistence/ipersistence";
import type { MomentLog } from "@/utils/persistence/moment";
import { CMomentLog } from "@/utils/persistence/moment";
import { shallowArrayEqual } from "@/utils/utils";
import { USelection } from "./uselection";

export type Store = ReturnType<typeof createStore>;

type MapboxLayer = any;

interface FileInfo {
  handle: FileSystemHandle | FileSystemFileHandle;
  options: ExportOptions;
}

export type PreviewProperty = PersistenceMetadataMemory["label"];

export interface Data {
  folderMap: FolderMap;
  featureMap: FeatureMap;
  selection: Sel;
}

export const dataAtom = atom<Data>({
  featureMap: new Map(),
  folderMap: new Map(),
  selection: {
    type: "none",
  },
});

const layerId = NIL;

export const layerConfigAtom = atom<LayerConfigMap>(
  new Map([
    [
      layerId,
      {
        ...LAYERS.LIBERTY,
        at: "a0",
        opacity: 1,
        tms: false,
        visibility: true,
        labelVisibility: true,
        id: layerId,
      },
    ],
  ]),
);

export const selectedFeaturesAtom = selectAtom(
  dataAtom,
  (data) => {
    return USelection.getSelectedFeatures(data);
  },
  shallowArrayEqual,
);

export const selectionAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("selection"),
);

export const memoryMetaAtom = atom<Omit<PersistenceMetadataMemory, "type">>({
  symbolization: SYMBOLIZATION_NONE,
  label: null,
  layer: null,
});

export const searchHistoryAtom = atom<string[]>([]);

export type Side = "left" | "right";

export const OTHER_SIDE: Record<Side, Side> = {
  left: "right",
  right: "left",
};

export const MIN_SPLITS = {
  left: 100,
  right: 200,
} as const;

export interface Splits {
  layout: PanelLayout;
  bottom: number;
  rightOpen: boolean;
  right: number;
  leftOpen: boolean;
  left: number;
}

type PanelLayout = "AUTO" | "FLOATING" | "VERTICAL";

export const splitsAtom = atom<Splits>({
  layout: "AUTO",
  bottom: 500,
  rightOpen: true,
  right: 320,
  leftOpen: true,
  left: 200,
});

export const showPanelBottomAtom = atom<boolean>(true);

export const showAllAtom = atomWithStorage("showAll", true);
export const panelIdOpen = atomWithStorage("panelIdOpen", false);
export const panelRawOpen = atomWithStorage("panelRawOpen", false);
export const panelExportOpen = atomWithStorage("panelExportOpen", false);
export const panelNullOpen = atomWithStorage("panelNullOpen", true);
export const panelCircleOpen = atomWithStorage("panelCircleOpen", true);
export const panelStyleOpen = atomWithStorage("panelStyleOpen", false);
export const panelSymbolizationExportOpen = atomWithStorage(
  "panelSymbolizationExportOpen",
  true,
);
export type PanelAtom = typeof panelIdOpen;

export const hideHintsAtom = atomWithStorage<Mode[]>("hideHints", []);

export const scaleUnitAtom = atomWithStorage<ScaleUnit>(
  "scaleUnit",
  "imperial",
);

export const addMetadataWithGeocoderAtom = atomWithStorage(
  "addMetadataWithGeocoder",
  false,
);

export type {
  DialogStateCastProperty as ModalStateCastProperty,
  DialogStateImport as ModalStateImport,
} from "@/stores/dialog_state";

export { dialogAtom } from "@/stores/dialog_state";

export type PartialLayer = SetOptional<MapboxLayer, "createdById">;

export const momentLogAtom = atom<MomentLog>(new CMomentLog());

export interface SelFolder {
  type: "folder";

  id: StringId;
}

export interface SelSingle {
  type: "single";

  id: StringId;
  parts: readonly VertexId[];
}

export interface SelMulti {
  type: "multi";
  ids: readonly StringId[];
  previousIds?: readonly StringId[];
}

export type Sel =
  | SelMulti
  | SelFolder
  | {
      type: "none";
    }
  | SelSingle;

export const SELECTION_NONE: Sel = {
  type: "none",
};

export interface EphemeralEditingStateLasso {
  type: "lasso";
  box: [Pos2, Pos2];
}

export const cursorStyleAtom = atom<React.CSSProperties["cursor"]>("default");

export type EphemeralEditingState =
  | EphemeralEditingStateLasso
  | { type: "none" };

export const ephemeralStateAtom = atom<EphemeralEditingState>({ type: "none" });

export { MODE_INFO, Mode, modeAtom };

export const lastSearchResultAtom = atom<QItemAddable | null>(null);

export const fileInfoAtom = atom<FileInfo | null>(null);

const fileInfoMachine = createMachine({
  id: "fileInfo",
  initial: "idle",
  states: {
    idle: {
      on: {
        show: "visible",
      },
    },
    visible: {
      after: {
        2000: {
          target: "idle",
        },
      },
    },
  },
});

export const fileInfoMachineAtom = atomWithMachine(() => fileInfoMachine);

export enum TabOption {
  Feature = "Feature",
  Table = "Table",
  List = "List",
  Symbolization = "Symbolization",
}

export const tabAtom = atom<TabOption>(TabOption.Feature);

export type VirtualColumns = string[];
export const virtualColumnsAtom = atom<VirtualColumns>([]);

export type SortOption = { column: string; direction: "asc" | "desc" };

export interface FilterOptions {
  column: string | null;
  search: string | null;
  isCaseSensitive: boolean;
  geometryType: string | null;
  folderId: IFolder["id"] | null;
  exact: boolean;
  sort: SortOption | null;
}

export const initialFilterValues: FilterOptions = {
  column: "",
  search: "",
  isCaseSensitive: false,
  geometryType: null,
  folderId: null,
  exact: false,
  sort: null,
};

export const tableFilterAtom = atom<FilterOptions>(initialFilterValues);

export const circleTypeAtom = atomWithStorage<CIRCLE_TYPE>(
  "circleType",
  CIRCLE_TYPE.MERCATOR,
);

export const routeTypeAtom = atomWithStorage<ROUTE_TYPE>(
  "routeType",
  ROUTE_TYPE.WALKING,
);

export const themeAtom = atomWithStorage<"light" | "dark">("theme", "light");
