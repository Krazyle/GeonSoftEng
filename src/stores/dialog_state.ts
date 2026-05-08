import { atomWithReset } from "jotai/utils";
import type { IFeature, IWrappedFeature } from "types";
import type { ConvertResult } from "@/utils/convert/utils";
import type { FileGroups } from "@/utils/group_files";
import type { SimplifySupportedGeometry } from "@/utils/map_operations/simplify";

export type DialogStateImport = {
  type: "import";
  files: FileGroups;
};

export type DialogStateCircle = {
  type: "circle";
  position: Pos2;
};

type DialogStateExamples = {
  type: "import_example";
};

export type DialogStateImportNotes = {
  type: "import_notes";
  result: ConvertResult;
};

type DialogStateExportCode = {
  type: "export_code";
};

export type DialogStateCastProperty = {
  type: "cast_property";
  column: string;
};

export type DialogStateBuffer = {
  type: "buffer";
  features: IWrappedFeature[];
};

export type DialogStateSimplify = {
  type: "simplify";
  features: IWrappedFeature<IFeature<SimplifySupportedGeometry>>[];
};

export type DialogStateLoadText = {
  type: "load_text";
  initialValue?: string;
};

export type DialogStateRenameFeature = {
  type: "rename_feature";
  feature: IWrappedFeature;
};

type DialogState =
  | DialogStateImport
  | DialogStateImportNotes
  | DialogStateCastProperty
  | DialogStateSimplify
  | DialogStateBuffer
  | DialogStateCircle
  | DialogStateExamples
  | DialogStateExportCode
  | DialogStateRenameFeature
  | {
      type: "circle_types";
    }
  | {
      type: "route_help";
    }
  | {
      type: "quickswitcher";
    }
  | {
      type: "cheatsheet";
    }
  | {
      type: "export";
    }
  | {
      type: "export-svg";
    }
  | DialogStateLoadText
  | {
      type: "from_url";
    }
  | null;

export const dialogAtom = atomWithReset<DialogState>(null);
