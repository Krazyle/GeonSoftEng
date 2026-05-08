import { getUniqFieldNames } from "../datatable/mapshaper-data-utils";
import {
  decodeSamples,
  detectEncoding,
} from "../text/mapshaper-encoding-detection";
import {
  bufferToString,
  decodeString,
  standardizeEncodingName,
} from "../text/mapshaper-encodings";
import { BinArray } from "../utils/mapshaper-binarray";
import {
  error,
  formatStringsAsGrid,
  message,
  stop,
} from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

var languageIds = [
  0x01,
  "437",
  0x02,
  "850",
  0x03,
  "1252",
  0x08,
  "865",
  0x09,
  "437",
  0x0a,
  "850",
  0x0b,
  "437",
  0x0d,
  "437",
  0x0e,
  "850",
  0x0f,
  "437",
  0x10,
  "850",
  0x11,
  "437",
  0x12,
  "850",
  0x13,
  "932",
  0x14,
  "850",
  0x15,
  "437",
  0x16,
  "850",
  0x17,
  "865",
  0x18,
  "437",
  0x19,
  "437",
  0x1a,
  "850",
  0x1b,
  "437",
  0x1c,
  "863",
  0x1d,
  "850",
  0x1f,
  "852",
  0x22,
  "852",
  0x23,
  "852",
  0x24,
  "860",
  0x25,
  "850",
  0x26,
  "866",
  0x37,
  "850",
  0x40,
  "852",
  0x4d,
  "936",
  0x4e,
  "949",
  0x4f,
  "950",
  0x50,
  "874",
  0x57,
  "1252",
  0x58,
  "1252",
  0x59,
  "1252",
  0x64,
  "852",
  0x65,
  "866",
  0x66,
  "865",
  0x67,
  "861",
  0x6a,
  "737",
  0x6b,
  "857",
  0x6c,
  "863",
  0x78,
  "950",
  0x79,
  "949",
  0x7a,
  "936",
  0x7b,
  "932",
  0x7c,
  "874",
  0x86,
  "737",
  0x87,
  "852",
  0x88,
  "857",
  0xc8,
  "1250",
  0xc9,
  "1251",
  0xca,
  "1254",
  0xcb,
  "1253",
  0xcc,
  "1257",
];

var encodingNames = {
  932: "Japanese",
  936: "Simplified Chinese",
  950: "Traditional Chinese",
  1252: "Western European",
  949: "Korean",
  874: "Thai",
  1250: "Eastern European",
  1251: "Russian",
  1254: "Turkish",
  1253: "Greek",
  1257: "Baltic",
};

var ENCODING_PROMPT =
  'To avoid corrupted text, re-import using the "encoding=" option.\n' +
  'To see a list of supported encodings, run the "encodings" command.';

function lookupCodePage(lid) {
  var i = languageIds.indexOf(lid);
  return i === -1 ? null : languageIds[i + 1];
}

function readStringBytes(bin, size, buf) {
  var start = bin.position();
  var count = 0,
    c;
  for (var i = 0; i < size; i++) {
    c = bin.readUint8();

    if (c === 0) break;
    if (count > 0 || c !== 32) {
      buf[count++] = c;
    }
  }

  while (count > 0 && buf[count - 1] === 32) {
    count--;
  }
  bin.position(start + size);
  return count;
}

function getStringReader(arg) {
  var encoding = arg || "ascii";
  var slug = standardizeEncodingName(encoding);
  var buf = utils.createBuffer(256);
  var inNode = typeof module === "object";

  if (inNode && (slug === "utf8" || slug === "ascii")) {
    return function (bin, size) {
      var n = readStringBytes(bin, size, buf);
      return buf.toString(slug, 0, n);
    };
  }

  return function readEncodedString(bin, size) {
    var n = readStringBytes(bin, size, buf),
      str = "",
      i,
      c;

    for (i = 0; i < n; i++) {
      c = buf[i];
      if (c > 127) {
        return bufferToString(buf, encoding, 0, n);
      }
      str += String.fromCharCode(c);
    }
    return str;
  };
}

function bufferContainsHighBit(buf, n) {
  for (var i = 0; i < n; i++) {
    if (buf[i] >= 128) return true;
  }
  return false;
}

function getNumberReader() {
  var read = getStringReader("ascii");
  return function readNumber(bin, size) {
    var str = read(bin, size);
    var val;
    if (str.indexOf(",") >= 0) {
      str = str.replace(",", ".");
    }
    val = parseFloat(str);
    return Number.isNaN(val) ? null : val;
  };
}

function readInt(bin, _size) {
  return bin.readInt32();
}

function readBool(bin, size) {
  var c = bin.readCString(size),
    val = null;
  if (/[ty]/i.test(c)) val = true;
  else if (/[fn]/i.test(c)) val = false;
  return val;
}

function readDate(bin, size) {
  var str = bin.readCString(size),
    yr = str.substr(0, 4),
    mo = str.substr(4, 2),
    day = str.substr(6, 2);
  return new Date(Date.UTC(+yr, +mo - 1, +day));
}

export default function DbfReader(src, encodingArg) {
  if (utils.isString(src)) {
    error("[DbfReader] Expected a buffer, not a string");
  }
  var bin = new BinArray(src);
  var header = readHeader(bin);

  var fields;
  var encoding;

  this.size = function () {
    return header.recordCount;
  };

  this.readRow = function (i) {
    return getRecordReader()(i);
  };

  this.getFields = getFieldNames;

  this.getBuffer = function () {
    return bin.buffer();
  };

  this.deleteField = function (f) {
    prepareToRead();
    fields = fields.filter(function (field) {
      return field.name !== f;
    });
  };

  this.readRows = function () {
    var reader = getRecordReader();
    var data = [];
    for (var r = 0, n = this.size(); r < n; r++) {
      data.push(reader(r));
    }
    return data;
  };

  function prepareToRead() {
    if (fields) return;
    var headerEncoding = "ascii";
    initEncoding();
    if (getNonAsciiHeaders().length > 0) {
      headerEncoding = getEncoding();
    }
    fields = header.fields.map(function (f) {
      var copy = utils.extend({}, f);
      copy.name = decodeString(f.namebuf, headerEncoding);
      return copy;
    });

    getUniqFieldNames(utils.pluck(fields, "name")).forEach(function (name2, i) {
      fields[i].name = name2;
    });
  }

  function readHeader(bin) {
    bin.position(0).littleEndian();
    var header = {
      version: bin.readInt8(),
      updateYear: bin.readUint8(),
      updateMonth: bin.readUint8(),
      updateDay: bin.readUint8(),
      recordCount: bin.readUint32(),
      dataOffset: bin.readUint16(),
      recordSize: bin.readUint16(),
      incompleteTransaction: bin.skipBytes(2).readUint8(),
      encrypted: bin.readUint8(),
      mdx: bin.skipBytes(12).readUint8(),
      ldid: bin.readUint8(),
    };
    var colOffs = 1;
    var field;
    bin.skipBytes(2);
    header.fields = [];

    while (
      bin.peek() !== 0x0d &&
      bin.peek() !== 0x0a &&
      bin.position() < header.dataOffset - 1
    ) {
      field = readFieldHeader(bin);
      field.columnOffset = colOffs;
      header.fields.push(field);
      colOffs += field.size;
    }
    if (colOffs !== header.recordSize) {
      error(
        "Record length mismatch; header:",
        header.recordSize,
        "detected:",
        colOffs,
      );
    }
    if (bin.peek() !== 0x0d) {
      message(
        "Found a non-standard DBF header terminator (" +
          bin.peek() +
          "). DBF file may be corrupted.",
      );
    }

    return header;
  }

  function readFieldHeader(bin) {
    var buf = utils.createBuffer(11);
    var chars = readStringBytes(bin, 11, buf);
    return {
      namebuf: utils.createBuffer(buf.slice(0, chars)),
      type: String.fromCharCode(bin.readUint8()),
      address: bin.readUint32(),
      size: bin.readUint8(),
      decimals: bin.readUint8(),
      id: bin.skipBytes(2).readUint8(),
      position: bin.skipBytes(2).readUint8(),
      indexFlag: bin.skipBytes(7).readUint8(),
    };
  }

  function getFieldNames() {
    prepareToRead();
    return utils.pluck(fields, "name");
  }

  function getRowOffset(r) {
    return header.dataOffset + header.recordSize * r;
  }

  function initEncoding() {
    encoding = encodingArg || findStringEncoding();
    if (!encoding) {
      encoding = "utf8";
      stop(
        "Unable to auto-detect the text encoding of the DBF file.\n" +
          ENCODING_PROMPT,
      );
    }
  }

  function getEncoding() {
    if (!encoding) initEncoding();
    return encoding;
  }

  function getRecordConstructor() {
    var args = getFieldNames().map(function (name, i) {
      return `${JSON.stringify(name)}: arguments[${i}]`;
    });
    return new Function(`return {${args.join(",")}};`);
  }

  function findEofPos(bin) {
    var pos = bin.size() - 1;
    if (bin.peek(pos) !== 0x1a) {
      pos++;
    }
    return pos;
  }

  function getRecordReader() {
    prepareToRead();
    var readers = fields.map(getFieldReader),
      eofOffs = findEofPos(bin),
      create = getRecordConstructor(),
      values = [];

    return function readRow(r) {
      var offs = getRowOffset(r),
        fieldOffs,
        field;
      for (var c = 0, cols = fields.length; c < cols; c++) {
        field = fields[c];
        fieldOffs = offs + field.columnOffset;
        if (fieldOffs + field.size > eofOffs) {
          stop("Invalid DBF file: encountered end-of-file while reading data");
        }
        bin.position(fieldOffs);
        values[c] = readers[c](bin, field.size);
      }
      return create.apply(null, values);
    };
  }

  function getFieldReader(f) {
    var type = f.type,
      r = null;
    if (type === "I") {
      r = readInt;
    } else if (type === "F" || type === "N") {
      r = getNumberReader();
    } else if (type === "L") {
      r = readBool;
    } else if (type === "D") {
      r = readDate;
    } else if (type === "C") {
      r = getStringReader(getEncoding());
    } else {
      message(
        'Field "' +
          f.name +
          '" has an unsupported type (' +
          f.type +
          ") -- converting to null values",
      );
      r = function () {
        return null;
      };
    }
    return r;
  }

  function findStringEncoding() {
    var ldid = header.ldid,
      codepage = lookupCodePage(ldid),
      samples = getNonAsciiSamples(),
      only7bit = samples.length === 0,
      encoding,
      msg;

    if (codepage && ldid !== 87) {
      encoding = codepage;
    } else if (only7bit) {
      encoding = "ascii";
    }

    if (!encoding) {
      encoding = detectEncoding(samples);
    }

    if (encoding && samples.length > 0) {
      msg = decodeSamples(encoding, samples);
      msg = formatStringsAsGrid(msg.split("\n"));
      msg =
        "\nSample text containing non-ascii characters:" +
        (msg.length > 60 ? "\n" : "") +
        msg;
      msg =
        "Detected DBF text encoding: " +
        encoding +
        (encoding in encodingNames ? ` (${encodingNames[encoding]})` : "") +
        msg;
      message(msg);
    }
    return encoding;
  }

  function getNonAsciiHeaders() {
    var arr = [];
    header.fields.forEach(function (f) {
      if (bufferContainsHighBit(f.namebuf, f.namebuf.length)) {
        arr.push(f.namebuf);
      }
    });
    return arr;
  }

  function getNonAsciiSamples() {
    var samples = [];
    var stringFields = header.fields.filter(function (f) {
      return f.type === "C";
    });
    var cols = stringFields.length;

    var rows = Math.min(header.recordCount, 10000);
    var maxSamples = 50;
    var buf = utils.createBuffer(256);
    var index = {};
    var f, chars, sample, hash;

    samples = getNonAsciiHeaders();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (samples.length >= maxSamples) break;
        f = stringFields[c];
        bin.position(getRowOffset(r) + f.columnOffset);
        chars = readStringBytes(bin, f.size, buf);
        if (chars > 0 && bufferContainsHighBit(buf, chars)) {
          sample = utils.createBuffer(buf.slice(0, chars));
          hash = sample.toString("hex");
          if (hash in index === false) {
            index[hash] = true;
            samples.push(sample);
          }
        }
      }
    }
    return samples;
  }
}
