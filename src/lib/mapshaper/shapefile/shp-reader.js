import { BufferReader } from "../io/mapshaper-file-reader";
import { isSupportedShapefileType } from "../shapefile/shp-common";
import ShpRecordClass from "../shapefile/shp-record";
import { error, message, stop, verbose } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function ShpReader(shpSrc, shxSrc) {
  if (this instanceof ShpReader === false) {
    return new ShpReader(shpSrc, shxSrc);
  }
  var shpFile = utils.isString(shpSrc)
    ? new FileReader(shpSrc)
    : new BufferReader(shpSrc);
  var header = parseHeader(shpFile.readToBinArray(0, 100));
  var shpType = header.type;
  var shpOffset = 100;
  var recordCount = 0;
  var badRecordNumberCount = 0;
  var RecordClass = new ShpRecordClass(shpType);
  var shxBin, shxFile;

  if (shxSrc) {
    shxFile = utils.isString(shxSrc)
      ? new FileReader(shxSrc)
      : new BufferReader(shxSrc);
    shxBin = shxFile.readToBinArray(0, shxFile.size()).bigEndian();
  }

  this.header = function () {
    return header;
  };

  this.forEachShape = function (callback) {
    var shape = this.nextShape();
    while (shape) {
      callback(shape);
      shape = this.nextShape();
    }
  };

  this.nextShape = function () {
    var shape;
    if (!shpFile) {
      error("Tried to read from a used ShpReader");
    }
    shape = readNextShape(recordCount);
    if (!shape) {
      done();
      return null;
    }
    recordCount++;
    return shape;
  };

  function readNextShape(i) {
    return shxBin
      ? readIndexedShape(shpFile, shxBin, i)
      : readNonIndexedShape(shpFile, shpOffset, i);
  }

  function done() {
    shpFile.close();
    shpFile = shxFile = shxBin = null;
    if (badRecordNumberCount > 0) {
      message(
        `Warning: ${badRecordNumberCount}/${recordCount} features have non-standard record numbers in the .shp file.`,
      );
    }
  }

  function parseHeader(bin) {
    var header = {
      signature: bin.bigEndian().readUint32(),
      byteLength: bin.skipBytes(20).readUint32() * 2,
      version: bin.littleEndian().readUint32(),
      type: bin.readUint32(),
      bounds: bin.readFloat64Array(4),
      zbounds: bin.readFloat64Array(2),
      mbounds: bin.readFloat64Array(2),
    };

    if (header.signature !== 9994) {
      error("Not a valid .shp file");
    }

    if (!isSupportedShapefileType(header.type)) {
      error("Unsupported .shp type:", header.type);
    }

    if (header.byteLength !== shpFile.size()) {
      error("File size of .shp doesn't match size in header");
    }

    return header;
  }

  function readShapeAtOffset(shpFile, offset) {
    var fileSize = shpFile.size();
    if (offset + 12 > fileSize) return null;
    var bin = shpFile.readToBinArray(offset, 12);
    var _recordId = bin.bigEndian().readUint32();

    var recordSize = bin.readUint32() * 2 + 8;
    var recordType = bin.littleEndian().readUint32();
    var goodSize = offset + recordSize <= fileSize && recordSize >= 12;
    var goodType = recordType === 0 || recordType === shpType;
    if (!goodSize || !goodType) {
      return null;
    }
    bin = shpFile.readToBinArray(offset, recordSize);
    return new RecordClass(bin, recordSize);
  }

  function readIndexedShape(shpFile, shxBin, i) {
    if (shxBin.size() <= 100 + i * 8) return null;
    shxBin.position(100 + i * 8);
    var expectedId = i + 1;
    var offset = shxBin.readUint32() * 2;
    var _recLen = shxBin.readUint32() * 2;
    var shape = readShapeAtOffset(shpFile, offset);
    if (!shape) {
      stop(
        "Index of Shapefile record",
        expectedId,
        "in the .shx file is invalid.",
      );
    }
    if (shape.id !== expectedId) {
      badRecordNumberCount++;
      verbose(
        `Warning: A feature has a different record number in .shx (${expectedId}) and .shp (${shape.id}).`,
      );
    }

    return shape;
  }

  function readNonIndexedShape(shpFile, start, i) {
    var expectedId = i + 1,
      offset = start,
      fileSize = shpFile.size(),
      shape = null,
      bin,
      recordId,
      recordType,
      isValidType;
    while (offset + 12 <= fileSize) {
      bin = shpFile.readToBinArray(offset, 12);
      recordId = bin.bigEndian().readUint32();
      recordType = bin.littleEndian().skipBytes(4).readUint32();
      isValidType = recordType === shpType || recordType === 0;
      if (!isValidType || (recordId !== expectedId && recordType === 0)) {
        offset += 4;
        continue;
      }
      shape = readShapeAtOffset(shpFile, offset);
      if (!shape) break;
      shpOffset = offset + shape.byteLength;
      if (recordId === expectedId) break;
      if (recordId < expectedId) {
        message(
          "Found a Shapefile record with the same id as a previous record (" +
            shape.id +
            ") -- skipping.",
        );
        offset += shape.byteLength;
      } else {
        stop(
          "Shapefile contains an out-of-sequence record. Possible data corruption -- bailing.",
        );
      }
    }
    if (shape && offset > start) {
      verbose(
        "Skipped over " +
          (offset - start) +
          " non-data bytes in the .shp file.",
      );
    }
    return shape;
  }
}

ShpReader.prototype.type = function () {
  return this.header().type;
};
