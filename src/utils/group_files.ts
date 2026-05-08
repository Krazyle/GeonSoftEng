import remove from "lodash/remove";
import type { ShapefileGroup } from "@/utils/convert/shapefile";
import { getExtension } from "@/utils/convert/utils";

export type FileGroups = Array<FileGroup | ShapefileGroup>;

export type { ShapefileGroup };

export interface FileGroup {
  type: "file";
  file: File;
}

function asFileGroup(file: File): FileGroup {
  return { type: "file" as const, file };
}

function asShapefileGroup(file: File): ShapefileGroup {
  return {
    type: "shapefile",
    files: {
      shp: file,
    },
  };
}

function isShp(file: File): boolean {
  return getExtension(file.name) === ".shp";
}

export function groupFiles(files: readonly File[]): FileGroups {
  const pool = Array.from(files);

  const shapefileGroups = remove(pool, (file) => isShp(file)).map((file) =>
    asShapefileGroup(file),
  );

  function addGroup(group: ShapefileGroup, ext: keyof ShapefileGroup["files"]) {
    const base = group.files.shp.name.replace(/\.shp$/, "");
    const toAdd = remove(pool, (file) => file.name === `${base}.${ext}`);
    if (toAdd.length) {
      group.files[ext] = toAdd[0];
    }
  }

  for (const group of shapefileGroups) {
    addGroup(group, "shx");
    addGroup(group, "prj");
    addGroup(group, "dbf");
    addGroup(group, "cpg");
  }

  return [...pool.map((file) => asFileGroup(file)), ...shapefileGroups];
}
