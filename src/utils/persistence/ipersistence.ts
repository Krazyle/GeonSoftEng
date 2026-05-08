import type { Promisable } from "type-fest";
import type { ISymbolization } from "types";
import { z } from "zod";
import type { IDMap } from "@/utils/id_mapper";
import type { MomentInput } from "./moment";

export type PersistenceMetadataMemory = {
  type: "memory";
  symbolization: ISymbolization;
  label: string | null;
  layer: any;
};

type PersistenceMetadata = PersistenceMetadataMemory;

export interface TransactOptions {
  quiet?: boolean;
}

const EditWrappedFeatureCollection = z.object({
  id: z.string(),
  name: z.optional(z.string()),
  label: z.optional(z.string()),
  layerId: z.optional(z.number().int().nullable()),
  defaultLayer: z.any(),
  access: z.any(),
  symbolization: z.any(),
  wrappedFeatureCollectionFolderId: z.string().uuid().nullable().optional(),
});

export type MetaUpdatesInput = Partial<
  Omit<z.infer<typeof EditWrappedFeatureCollection>, "id">
>;

export type MetaPair = [
  PersistenceMetadata,
  (updates: MetaUpdatesInput) => Promisable<void>,
];

export interface IPersistence {
  idMap: IDMap;

  putPresence(presence: unknown): Promise<void>;

  useLastPresence(): null;

  useHistoryControl(): (direction: "undo" | "redo") => Promise<void>;

  useTransact(): (
    moment: Partial<MomentInput> & TransactOptions,
  ) => Promise<void>;

  useMetadata(): MetaPair;
}
