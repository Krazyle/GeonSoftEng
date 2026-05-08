import type { Folder, Root } from "@tmcw/togeojson";
import type { FileWithHandle } from "browser-fs-access";
import * as Comlink from "comlink";
import { transfer } from "comlink";
import { generateNKeysBetween } from "fractional-indexing";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import type {
  Feature,
  FeatureCollection,
  IFolder,
  IWrappedFeature,
} from "types";
import { type Data, dataAtom, fileInfoAtom } from "@/stores/jotai";
import type { ImportOptions } from "@/utils/convert";
import {
  importToExportOptions,
  type RawProgressCb,
  stringToGeoJSON,
} from "@/utils/convert";
import type { ShapefileGroup } from "@/utils/convert/shapefile";
import { Shapefile } from "@/utils/convert/shapefile";
import type { ConvertResult } from "@/utils/convert/utils";
import { newFeatureId } from "@/utils/id";
import { usePersistence } from "@/utils/persistence/context";
import {
  fMoment,
  type Moment,
  type MomentInput,
} from "@/utils/persistence/moment";
import { pluralize, truncate } from "@/utils/utils";
import { lib } from "@/utils/worker";

function resultToTransact({
  result,
  file,
  track,
  existingFolderId,
}: {
  result: ConvertResult;
  file: Pick<File, "name">;
  track: [
    string,
    {
      format: string;
    },
  ];
  existingFolderId?: string | undefined;
}): Partial<MomentInput> {
  const folderId = newFeatureId();

  const putFolders: MomentInput["putFolders"] = existingFolderId
    ? []
    : [
        {
          name: file?.name || "Imported file",
          visibility: true,
          id: folderId,
          expanded: true,
          locked: false,
          folderId: null,
        },
      ];

  switch (result.type) {
    case "geojson": {
      const { features } = result.geojson;
      const ats = generateNKeysBetween(null, null, features.length);
      return {
        note: `Imported ${file?.name ? file.name : "a file"}`,
        track: track,
        putFolders,
        putFeatures: result.geojson.features.map((feature, i) => {
          return {
            at: ats[i],
            folderId: existingFolderId || folderId,
            id: newFeatureId(),
            feature,
          };
        }),
      };
    }
    case "root": {
      const flat = flattenRoot(result.root, [], [], null);
      return flat;
    }
  }
}

export function flattenRoot(
  root: Root | Folder,
  features: IWrappedFeature[],
  folders: IFolder[],
  parentFolder: string | null,
): Pick<Moment, "note" | "putFolders" | "putFeatures"> {
  const ats = generateNKeysBetween(null, null, root.children.length);
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    switch (child.type) {
      case "Feature": {
        features.push({
          at: ats[i],
          folderId: parentFolder,
          id: newFeatureId(),
          feature: child,
        });
        break;
      }
      case "folder": {
        const id = newFeatureId();
        folders.push({
          at: ats[i],
          folderId: parentFolder,
          id,
          expanded: child.meta.visibility !== "0",
          locked: false,
          visibility: true,
          name: (child.meta.name as string) || "Folder",
        });
        flattenRoot(child, features, folders, id);
        break;
      }
    }
  }

  return {
    note: "Imported a file",
    putFolders: folders,
    putFeatures: features,
  };
}

export function useImportString() {
  const rep = usePersistence();
  const transact = rep.useTransact();

  return useCallback(
    async (
      text: string,
      options: ImportOptions,
      progress: RawProgressCb,
      name: string = "Imported text",
      existingFolderId?: string,
    ) => {
      return (await stringToGeoJSON(text, options, Comlink.proxy(progress)))
        .map(async (result) => {
          await transact(
            resultToTransact({
              result,
              file: { name },
              track: [
                "import-string",
                {
                  format: "geojson",
                },
              ],
              existingFolderId,
            }),
          );
          return result;
        })
        .mapLeft((e) => {
          console.error(e);
          return e;
        });
    },
    [transact],
  );
}

export function getTargetMap(
  { featureMap }: Pick<Data, "featureMap">,
  joinTargetHeader: string,
) {
  const targetMap = new Map<string, IWrappedFeature[]>();
  let sourceMissingFieldCount = 0;

  for (const wrappedFeature of featureMap.values()) {
    const value = wrappedFeature.feature.properties?.[joinTargetHeader];
    if (value !== undefined) {
      const valueStr = String(value);
      const oldTarget = targetMap.get(valueStr);
      if (oldTarget) {
        targetMap.set(valueStr, [wrappedFeature].concat(oldTarget));
      } else {
        targetMap.set(valueStr, [wrappedFeature]);
      }
    } else {
      sourceMissingFieldCount++;
    }
  }

  return { targetMap, sourceMissingFieldCount };
}

function momentForJoin(
  features: Feature[],
  targetMap: ReturnType<typeof getTargetMap>["targetMap"],
  joinSourceHeader: string,
  result: ConvertResult,
) {
  const moment: MomentInput = {
    ...fMoment("Joined data"),
    track: "import-data-join",
  };

  for (const feature of features) {
    const value = feature.properties?.[joinSourceHeader];
    if (value === undefined) continue;
    const target = targetMap.get(String(value));

    if (!target) {
      result.notes.push(
        `No feature on the map found for ${truncate(
          joinSourceHeader,
        )} = "${truncate(String(value))}"`,
      );
      continue;
    }

    for (const wrappedFeature of target) {
      moment.putFeatures.push({
        ...wrappedFeature,
        feature: {
          ...wrappedFeature.feature,
          properties: {
            ...(wrappedFeature.feature.properties || {}),
            ...(feature.properties || {}),
          },
        },
      });
    }
  }
  return moment;
}

function useJoinFeatures() {
  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        {
          options,
          geojson,
          result,
        }: {
          options: ImportOptions;
          geojson: FeatureCollection;
          result: ConvertResult;
        },
      ) => {
        const { features } = geojson;
        const { joinTargetHeader, joinSourceHeader } = options.csvOptions;
        const data = get(dataAtom);

        const { targetMap, sourceMissingFieldCount } = getTargetMap(
          data,
          joinTargetHeader,
        );

        if (sourceMissingFieldCount > 0) {
          result.notes.push(
            `${pluralize(
              "feature",
              sourceMissingFieldCount,
            )} in existing map data missing the join column.`,
          );
        }

        return momentForJoin(features, targetMap, joinSourceHeader, result);
      },
      [],
    ),
  );
}

export function useImportFile() {
  const rep = usePersistence();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const transact = rep.useTransact();
  const joinFeatures = useJoinFeatures();

  return useCallback(
    async (
      file: FileWithHandle,
      options: ImportOptions,
      progress: RawProgressCb,
    ) => {
      const arrayBuffer = await file.arrayBuffer();

      const either = (
        await lib.fileToGeoJSON(
          transfer(arrayBuffer, [arrayBuffer]),
          options,
          Comlink.proxy(progress),
        )
      ).bimap(
        (err) => {
          return err;
        },
        async (result) => {
          if (
            options.csvOptions.kind === "join" &&
            (options.type === "csv" || options.type === "xls") &&
            result.type === "geojson"
          ) {
            const { geojson } = result;
            const moment = joinFeatures({
              options,
              geojson,
              result,
            });
            await transact(moment);
            return result;
          } else {
            const exportOptions = importToExportOptions(options);
            if (file.handle && exportOptions) {
              setFileInfo({ handle: file.handle, options: exportOptions });
            }
            const moment = resultToTransact({
              result,
              file,
              track: [
                "import",
                {
                  format: options.type,
                },
              ],
            });
            await transact(moment);
            return result;
          }
        },
      );

      return either;
    },
    [setFileInfo, transact, joinFeatures],
  );
}

export function useImportShapefile() {
  const rep = usePersistence();
  const transact = rep.useTransact();

  return useCallback(
    async (file: ShapefileGroup, options: ImportOptions) => {
      const either = (await Shapefile.forwardLoose(file, options)).map(
        async (result) => {
          await transact(
            resultToTransact({
              result,
              file: file.files.shp,
              track: [
                "import",
                {
                  format: "shapefile",
                },
              ],
            }),
          );
          return result;
        },
      );

      return either;
    },
    [transact],
  );
}
