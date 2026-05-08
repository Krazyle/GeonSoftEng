import DataSlice from "./dataslice";
import DataView64 from "./dataview64";
import GeoTIFFImage from "./geotiffimage";
import { arrayFields, fieldTagNames, fieldTypes, geoKeyNames } from "./globals";
import type { Source } from "./source";

type FileDirectory = {
  GeoKeyDirectory?: {
    [key: string]: number;
  };
} & {
  [key: string]: string | number | Uint8Array;
};

function getFieldTypeLength(fieldType: number) {
  switch (fieldType) {
    case fieldTypes.BYTE:
    case fieldTypes.ASCII:
    case fieldTypes.SBYTE:
    case fieldTypes.UNDEFINED:
      return 1;
    case fieldTypes.SHORT:
    case fieldTypes.SSHORT:
      return 2;
    case fieldTypes.LONG:
    case fieldTypes.SLONG:
    case fieldTypes.FLOAT:
    case fieldTypes.IFD:
      return 4;
    case fieldTypes.RATIONAL:
    case fieldTypes.SRATIONAL:
    case fieldTypes.DOUBLE:
    case fieldTypes.LONG8:
    case fieldTypes.SLONG8:
    case fieldTypes.IFD8:
      return 8;
    default:
      throw new RangeError(`Invalid field type: ${fieldType}`);
  }
}

function parseGeoKeyDirectory(fileDirectory: FileDirectory) {
  const rawGeoKeyDirectory = fileDirectory.GeoKeyDirectory;
  if (!rawGeoKeyDirectory) {
    return null;
  }

  const geoKeyDirectory: {
    [key: string]: number | string | Uint8Array;
  } = {};
  for (let i = 4; i <= rawGeoKeyDirectory[3] * 4; i += 4) {
    const key = geoKeyNames[rawGeoKeyDirectory[i]];
    const location = rawGeoKeyDirectory[i + 1]
      ? fieldTagNames[rawGeoKeyDirectory[i + 1]]
      : null;
    const count = rawGeoKeyDirectory[i + 2];
    const offset = rawGeoKeyDirectory[i + 3];

    let value: number | string | Uint8Array | null = null;
    if (!location) {
      value = offset;
    } else {
      value = fileDirectory[location];
      if (typeof value === "undefined" || value === null) {
        throw new Error(`Could not get value of geoKey '${key}'.`);
      } else if (typeof value === "string") {
        value = value.substring(offset, offset + count - 1);
      } else if (typeof value === "object" && "subarray" in value) {
        value = value.subarray(offset, offset + count);
        if (count === 1) {
          value = value[0];
        }
      }
    }
    geoKeyDirectory[key] = value;
  }
  return geoKeyDirectory;
}

function getValues(
  dataSlice: DataSlice,
  fieldType: number,
  count: number,
  offset: number,
) {
  let values = null;
  let readMethod = null;
  const fieldTypeLength = getFieldTypeLength(fieldType);

  switch (fieldType) {
    case fieldTypes.BYTE:
    case fieldTypes.ASCII:
    case fieldTypes.UNDEFINED:
      values = new Uint8Array(count);
      readMethod = dataSlice.readUint8;
      break;
    case fieldTypes.SBYTE:
      values = new Int8Array(count);
      readMethod = dataSlice.readInt8;
      break;
    case fieldTypes.SHORT:
      values = new Uint16Array(count);
      readMethod = dataSlice.readUint16;
      break;
    case fieldTypes.SSHORT:
      values = new Int16Array(count);
      readMethod = dataSlice.readInt16;
      break;
    case fieldTypes.LONG:
    case fieldTypes.IFD:
      values = new Uint32Array(count);
      readMethod = dataSlice.readUint32;
      break;
    case fieldTypes.SLONG:
      values = new Int32Array(count);
      readMethod = dataSlice.readInt32;
      break;
    case fieldTypes.LONG8:
    case fieldTypes.IFD8:
      values = new Array(count);
      readMethod = dataSlice.readUint64;
      break;
    case fieldTypes.SLONG8:
      values = new Array(count);
      readMethod = dataSlice.readInt64;
      break;
    case fieldTypes.RATIONAL:
      values = new Uint32Array(count * 2);
      readMethod = dataSlice.readUint32;
      break;
    case fieldTypes.SRATIONAL:
      values = new Int32Array(count * 2);
      readMethod = dataSlice.readInt32;
      break;
    case fieldTypes.FLOAT:
      values = new Float32Array(count);
      readMethod = dataSlice.readFloat32;
      break;
    case fieldTypes.DOUBLE:
      values = new Float64Array(count);
      readMethod = dataSlice.readFloat64;
      break;
    default:
      throw new RangeError(`Invalid field type: ${fieldType}`);
  }

  if (
    !(fieldType === fieldTypes.RATIONAL || fieldType === fieldTypes.SRATIONAL)
  ) {
    for (let i = 0; i < count; ++i) {
      values[i] = readMethod.call(dataSlice, offset + i * fieldTypeLength);
    }
  } else {
    for (let i = 0; i < count; i += 2) {
      values[i] = readMethod.call(dataSlice, offset + i * fieldTypeLength);
      values[i + 1] = readMethod.call(
        dataSlice,
        offset + (i * fieldTypeLength + 4),
      );
    }
  }

  if (fieldType === fieldTypes.ASCII) {
    return new TextDecoder("utf-8").decode(values as BufferSource);
  }
  return values;
}

class ImageFileDirectory {
  fileDirectory: FileDirectory;
  geoKeyDirectory: FileDirectory;
  nextIFDByteOffset: number;
  constructor(
    fileDirectory: FileDirectory,
    geoKeyDirectory: FileDirectory,
    nextIFDByteOffset: number,
  ) {
    this.fileDirectory = fileDirectory;
    this.geoKeyDirectory = geoKeyDirectory;
    this.nextIFDByteOffset = nextIFDByteOffset;
  }
}

class GeoTIFFImageIndexError extends Error {
  index: number;
  constructor(index: number) {
    super(`No image at index ${index}`);
    this.index = index;
  }
}

class GeoTIFF {
  source: Source;
  littleEndian: boolean;
  bigTiff: boolean;
  firstIFDOffset: number;
  ifdRequests: Promise<ImageFileDirectory>[];
  cache: boolean;

  constructor(
    source: Source,
    littleEndian: boolean,
    bigTiff: boolean,
    firstIFDOffset: number,
    options = { cache: false },
  ) {
    this.source = source;
    this.littleEndian = littleEndian;
    this.bigTiff = bigTiff;
    this.firstIFDOffset = firstIFDOffset;
    this.cache = options.cache || false;
    this.ifdRequests = [];
  }

  async getSlice(offset: number, size: number | undefined = undefined) {
    const fallbackSize = this.bigTiff ? 4048 : 1024;
    return new DataSlice(
      await this.source.fetch(
        offset,
        typeof size !== "undefined" ? size : fallbackSize,
      ),
      offset,
      this.littleEndian,
      this.bigTiff,
    );
  }

  async parseFileDirectoryAt(offset: number): Promise<ImageFileDirectory> {
    const entrySize = this.bigTiff ? 20 : 12;
    const offsetSize = this.bigTiff ? 8 : 2;

    let dataSlice = await this.getSlice(offset);
    const numDirEntries = this.bigTiff
      ? dataSlice.readUint64(offset)
      : dataSlice.readUint16(offset);

    const byteSize = numDirEntries * entrySize + (this.bigTiff ? 16 : 6);
    if (!dataSlice.covers(offset, byteSize)) {
      dataSlice = await this.getSlice(offset, byteSize);
    }

    const fileDirectory: {
      [key: string]: any;
    } = {};

    let i = offset + (this.bigTiff ? 8 : 2);
    for (
      let entryCount = 0;
      entryCount < numDirEntries;
      i += entrySize, ++entryCount
    ) {
      const fieldTag = dataSlice.readUint16(i);
      const fieldType = dataSlice.readUint16(i + 2);
      const typeCount = this.bigTiff
        ? dataSlice.readUint64(i + 4)
        : dataSlice.readUint32(i + 4);

      let fieldValues;
      let value;
      const fieldTypeLength = getFieldTypeLength(fieldType);
      const valueOffset = i + (this.bigTiff ? 12 : 8);

      if (fieldTypeLength * typeCount <= (this.bigTiff ? 8 : 4)) {
        fieldValues = getValues(dataSlice, fieldType, typeCount, valueOffset);
      } else {
        const actualOffset = dataSlice.readOffset(valueOffset);
        const length = getFieldTypeLength(fieldType) * typeCount;

        if (dataSlice.covers(actualOffset, length)) {
          fieldValues = getValues(
            dataSlice,
            fieldType,
            typeCount,
            actualOffset,
          );
        } else {
          const fieldDataSlice = await this.getSlice(actualOffset, length);
          fieldValues = getValues(
            fieldDataSlice,
            fieldType,
            typeCount,
            actualOffset,
          );
        }
      }

      if (
        typeCount === 1 &&
        arrayFields.indexOf(fieldTag) === -1 &&
        !(
          fieldType === fieldTypes.RATIONAL ||
          fieldType === fieldTypes.SRATIONAL
        )
      ) {
        value = fieldValues[0];
      } else {
        value = fieldValues;
      }

      fileDirectory[fieldTagNames[fieldTag]] = value;
    }
    const geoKeyDirectory = parseGeoKeyDirectory(fileDirectory);
    const nextIFDByteOffset = dataSlice.readOffset(
      offset + offsetSize + entrySize * numDirEntries,
    );

    return new ImageFileDirectory(
      fileDirectory,
      geoKeyDirectory as FileDirectory,
      nextIFDByteOffset,
    );
  }

  requestIFD(index: number) {
    if (this.ifdRequests[index] !== undefined) {
      return this.ifdRequests[index];
    } else if (index === 0) {
      this.ifdRequests[index] = this.parseFileDirectoryAt(this.firstIFDOffset);
      return this.ifdRequests[index];
    } else if (this.ifdRequests[index - 1] === undefined) {
      try {
        this.ifdRequests[index - 1] = this.requestIFD(index - 1);
      } catch (e) {
        if (e instanceof GeoTIFFImageIndexError) {
          throw new GeoTIFFImageIndexError(index);
        }

        throw e;
      }
    }

    this.ifdRequests[index] = (async () => {
      const previousIfd = await this.ifdRequests[index - 1];
      if (previousIfd.nextIFDByteOffset === 0) {
        throw new GeoTIFFImageIndexError(index);
      }
      return this.parseFileDirectoryAt(previousIfd.nextIFDByteOffset);
    })();
    return this.ifdRequests[index];
  }

  async getImage(index = 0) {
    const ifd = await this.requestIFD(index);
    return new GeoTIFFImage(
      ifd.fileDirectory,
      ifd.geoKeyDirectory,
      this.littleEndian,
      this.cache,
      this.source,
    );
  }

  async getImageCount(): Promise<number> {
    let index = 0;

    let hasNext = true;
    while (hasNext) {
      try {
        await this.requestIFD(index);
        ++index;
      } catch (e) {
        if (e instanceof GeoTIFFImageIndexError) {
          hasNext = false;
        } else {
          throw e;
        }
      }
    }
    return index;
  }

  static async fromSource(source: Source) {
    const headerData = await source.fetch(0, 1024);
    const dataView = new DataView64(headerData);

    const BOM = dataView.getUint16(0, false);
    let littleEndian: boolean;
    if (BOM === 0x4949) {
      littleEndian = true;
    } else if (BOM === 0x4d4d) {
      littleEndian = false;
    } else {
      throw new TypeError("Invalid byte order value.");
    }

    const magicNumber = dataView.getUint16(2, littleEndian);
    let bigTiff: boolean;
    if (magicNumber === 42) {
      bigTiff = false;
    } else if (magicNumber === 43) {
      bigTiff = true;
      const offsetByteSize = dataView.getUint16(4, littleEndian);
      if (offsetByteSize !== 8) {
        throw new Error("Unsupported offset byte-size.");
      }
    } else {
      throw new TypeError("Invalid magic number.");
    }

    const firstIFDOffset = bigTiff
      ? dataView.getUint64(8, littleEndian)
      : dataView.getUint32(4, littleEndian);
    return new GeoTIFF(source, littleEndian, bigTiff, firstIFDOffset);
  }

  close() {
    return false;
  }
}

export default GeoTIFF;
