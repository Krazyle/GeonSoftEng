import {
  compileExpressionToFunction,
  getBaseContext,
} from "../expressions/mapshaper-expressions";
import { Reader2 } from "../io/mapshaper-file-reader";
import { decodeString, trimBOM } from "../text/mapshaper-encodings";
import {
  readFixedWidthRecords,
  readFixedWidthRecordsFromString,
} from "../text/mapshaper-fixed-width";
import { stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function readDelimRecords(reader, delim, optsArg) {
  var opts = optsArg || {};
  if (delim === " ") return readFixedWidthRecords(reader, opts);
  var reader2 = new Reader2(reader),
    headerStr = readLinesAsString(
      reader2,
      getDelimHeaderLines(opts),
      opts.encoding,
    ),
    header = parseDelimHeaderSection(headerStr, delim, opts),
    convertRowArr = getRowConverter(header.import_fields),
    batchSize = opts.batch_size || 1000,
    records = [],
    str,
    batch;
  if (header.import_fields.length === 0) return [];

  while ((str = readLinesAsString(reader2, batchSize, opts.encoding))) {
    batch = parseDelimText(
      str,
      delim,
      convertRowArr,
      header.column_filter || false,
      header.row_filter || false,
    );
    records.push.apply(records, batch);
    if (opts.csv_lines && records.length >= opts.csv_lines) {
      return records.slice(0, opts.csv_lines);
    }
  }
  return records;
}

export function readDelimRecordsFromString(str, delim, opts) {
  if (delim === " ") return readFixedWidthRecordsFromString(str, opts);
  var header = parseDelimHeaderSection(str, delim, opts);
  if (header.import_fields.length === 0 || !header.remainder) return [];
  var convert = getRowConverter(header.import_fields);
  var records = parseDelimText(
    header.remainder,
    delim,
    convert,
    header.column_filter,
    header.row_filter,
  );
  if (opts.csv_lines > 0) {
    records = records.slice(0, opts.csv_lines);
  }
  return records;
}

function indexOfLine(str, nth) {
  var rxp = /\r\n|[\r\n]|.$/g;
  var i = 1;
  if (nth === 1) return 0;
  if (nth > 1 === false) return -1;
  while (rxp.exec(str)) {
    i++;
    if (i < nth === false) return rxp.lastIndex;
  }
  return -1;
}

function getDelimHeaderLines(opts) {
  var skip = opts.csv_skip_lines || 0;
  if (!opts.csv_field_names) skip++;
  return skip;
}

function getRowConverter(fields) {
  return new Function(
    "arr",
    "return {" +
      fields
        .map(function (name, i) {
          return `${JSON.stringify(name)}: arr[${i}] || ""`;
        })
        .join(",") +
      "}",
  );
}

function parseDelimHeaderSection(str, delim, opts) {
  var nodata = { headers: [], import_fields: [] },
    retn = {},
    i;
  str = str || "";
  if (opts.csv_skip_lines > 0) {
    i = indexOfLine(str, opts.csv_skip_lines + 1);
    if (i === -1) return nodata;
    str = str.substr(i);
  }
  if (opts.csv_field_names) {
    retn.headers = opts.csv_field_names;
  } else {
    i = indexOfLine(str, 2);
    if (i === -1) return nodata;
    retn.headers = parseDelimText(str.slice(0, i), delim)[0];
    str = str.substr(i);
  }
  if (opts.csv_dedup_fields) {
    retn.headers = utils.uniqifyNames(retn.headers);
  }
  if (opts.csv_filter) {
    retn.row_filter = getDelimRecordFilterFunction(opts.csv_filter);
  }
  if (opts.csv_fields) {
    retn.column_filter = getDelimFieldFilter(retn.headers, opts.csv_fields);
    retn.import_fields = retn.headers.filter(function (_name, i) {
      return retn.column_filter(i);
    });
  } else {
    retn.import_fields = retn.headers;
  }
  retn.remainder = str;
  return retn;
}

function getDelimRecordFilterFunction(expression) {
  var rowFilter = compileExpressionToFunction(expression, { returns: true });
  var ctx = getBaseContext();
  return function (rec) {
    var val;
    try {
      val = rowFilter.call(null, rec, ctx);
    } catch (e) {
      stop(e.name, `in expression [${expression}]:`, e.message);
    }
    if (val !== true && val !== false) {
      stop("Filter expression must return true or false");
    }
    return val;
  };
}

function getDelimFieldFilter(header, fieldsToKeep) {
  var index = utils.arrayToIndex(fieldsToKeep);
  var map = header.map(function (name) {
    return name in index;
  });
  var missing = utils.difference(fieldsToKeep, header);
  if (missing.length > 0) {
    var foundStr = [""].concat(header).join("\n  ");
    var missingStr = [""].concat(missing).join("\n  ");
    stop(
      "csv-fields option has",
      missing.length === 1 ? "a name" : `${missing.length} names`,
      "not found in the file\nFields:",
      foundStr,
      "\nMissing:",
      missingStr,
    );
  }
  return function (colIdx) {
    return map[colIdx];
  };
}

function _skipDelimLines(reader, lines) {
  var buf = reader.readSync();
  var retn = readLinesFromBuffer(buf, lines);
  if (retn.bytesRead === buf.length && retn.bytesRead < reader.remaining()) {
    reader.expandBuffer();
    return _skipDelimLines(reader, lines);
  }
  reader.advance(retn.bytesRead);
}

function readLinesAsString(reader, lines, encoding) {
  var buf = reader.readSync();
  var retn = readLinesFromBuffer(buf, lines);
  var str;
  if (retn.bytesRead === buf.length && retn.bytesRead < reader.remaining()) {
    reader.expandBuffer();
    return readLinesAsString(reader, lines, encoding);
  }

  str = retn.bytesRead > 0 ? decodeString(retn.buffer, encoding) : "";
  if (reader.position() === 0) {
    str = trimBOM(str);
  }
  reader.advance(retn.bytesRead);
  return str;
}

function readLinesFromBuffer(buf, linesToRead) {
  var CR = 13,
    LF = 10,
    DQUOTE = 34,
    inQuotedText = false,
    lineCount = 0,
    bufLen = buf.length,
    i,
    c;

  lineCount++;
  for (i = 0; i < bufLen && lineCount <= linesToRead; i++) {
    c = buf[i];
    if (c === DQUOTE) {
      inQuotedText = !inQuotedText;
    } else if ((c === CR || c === LF) && !inQuotedText) {
      if (c === CR && i + 1 < bufLen && buf[i + 1] === LF) {
        i++;
      }
      lineCount++;
    }
  }
  return {
    bytesRead: i,
    buffer: buf.slice(0, i),
  };
}

function parseDelimText(text, delim, convert, colFilter, rowFilter) {
  var CR = 13,
    LF = 10,
    DQUOTE = 34,
    DELIM = delim.charCodeAt(0),
    inQuotedText = false,
    capturing = false,
    srcCol = -1,
    records = [],
    fieldStart,
    i,
    c,
    len,
    record;

  if (!convert)
    convert = function (d) {
      return d;
    };

  function endLine() {
    var rec = convert ? convert(record) : record;
    if (!rowFilter || rowFilter(rec)) records.push(rec);
    srcCol = -1;
  }

  function startFieldAt(j) {
    fieldStart = j;
    srcCol++;
    if (srcCol === 0) record = [];
    if (!colFilter || colFilter(srcCol)) {
      capturing = true;
    }
  }

  function captureField(start, end) {
    var s;
    if (!capturing) return;
    capturing = false;
    if (start === end) {
      s = "";
    } else if (text.charCodeAt(start) === DQUOTE) {
      s = text.slice(start + 1, end - 1).replace(/""/g, '"');
    } else {
      s = text.slice(start, end);
    }
    record.push(s);
  }

  startFieldAt(0);
  for (i = 0, len = text.length; i < len; i++) {
    c = text.charCodeAt(i);
    if (c === DQUOTE) {
      inQuotedText = !inQuotedText;
    } else if (inQuotedText) {
    } else if (c === DELIM) {
      captureField(fieldStart, i);
      startFieldAt(i + 1);
    } else if (c === CR || c === LF) {
      captureField(fieldStart, i);
      endLine();
      if (c === CR && text.charCodeAt(i + 1) === LF) {
        i++;
      }
      if (i + 1 < len) startFieldAt(i + 1);
    }
  }

  if (srcCol > -1) {
    if (capturing) captureField(fieldStart, i);
    endLine();
  }

  return records;
}
