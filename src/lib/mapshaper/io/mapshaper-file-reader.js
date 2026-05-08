import { bufferToString } from "../text/mapshaper-encodings";
import { BinArray } from "../utils/mapshaper-binarray";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function readFirstChars(reader, n) {
  return bufferToString(reader.readSync(0, Math.min(n || 1000, reader.size())));
}

export function Reader2(reader) {
  var offs = 0;

  this.position = function () {
    return offs;
  };

  this.remaining = function () {
    return Math.max(reader.size() - offs, 0);
  };

  this.advance = function (i) {
    offs += i;
  };

  this.readSync = function () {
    return reader.readSync(offs);
  };

  this.expandBuffer = function () {
    reader.expandBuffer();
  };
}

export function BufferReader(src) {
  var bufSize = src.byteLength || src.length,
    binArr,
    buf;

  this.readToBinArray = function (start, length) {
    if (bufSize < start + length) error("Out-of-range error");
    if (!binArr) binArr = new BinArray(src);
    binArr.position(start);
    return binArr;
  };

  this.toString = function (enc) {
    return bufferToString(buffer(), enc);
  };

  this.readSync = function (start, length) {
    return buffer().slice(start, length ? start + length : bufSize);
  };

  function buffer() {
    if (!buf) {
      buf = src instanceof ArrayBuffer ? utils.createBuffer(src) : src;
    }
    return buf;
  }

  this.findString = FileReader.prototype.findString;
  this.expandBuffer = function () {
    return this;
  };
  this.size = function () {
    return bufSize;
  };
  this.close = function () {};
}

export function FileReader() {}
