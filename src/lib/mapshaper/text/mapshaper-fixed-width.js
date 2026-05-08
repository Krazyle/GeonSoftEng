import utils from "../utils/mapshaper-utils";

export function exportRecordsAsFixedWidthString(fields, records, opts) {
  var rows = [],
    col;
  for (var i = 0; i < fields.length; i++) {
    col = formatFixedWidthColumn(fields[i], records, opts);
    if (i === 0) {
      rows = col;
    } else
      for (var j = 0; j < rows.length; j++) {
        rows[j] += ` ${col[j]}`;
      }
  }
  return rows.join("\n");
}

function formatFixedWidthColumn(field, records, opts) {
  var arr = [],
    maxLen = field.length,
    n = records.length,
    i,
    val;
  arr.push(field);
  for (i = 0; i < n; i++) {
    val = formatFixedWidthValue(records[i][field], opts);
    maxLen = Math.max(maxLen, val.length);
    arr.push(val);
  }
  for (i = 0; i < arr.length; i++) {
    arr[i] = arr[i].padEnd(maxLen, " ");
  }
  return arr;
}

function formatFixedWidthValue(val, opts) {
  var s;
  if (val == null) {
    s = "";
  } else if (utils.isString(val)) {
    s = val;
  } else if (utils.isNumber(val)) {
    s = opts.decimal_comma
      ? utils.formatIntlNumber(val)
      : utils.formatNumber(val);
  } else if (utils.isObject(val)) {
    s = JSON.stringify(val);
  } else {
    s = `${val}`;
  }
  return s;
}

export function readFixedWidthRecords(reader, opts) {
  var str = reader.toString(opts.encoding || "ascii");
  return readFixedWidthRecordsFromString(str, opts);
}

export function readFixedWidthRecordsFromString(str, _ops) {
  var fields = parseFixedWidthInfo(str.substring(0, 2000));
  if (!fields) return [];
  var lines = utils.splitLines(str);
  if (lines[lines.length - 1] === "") lines.pop();
  var records = [];
  for (var i = 1; i < lines.length; i++) {
    records.push(parseFixedWidthLine(lines[i], fields));
  }
  return records;
}

function parseFixedWidthInfo(sample) {
  var lines = utils.splitLines(sample);
  if (lines.length > 2) lines.pop();
  var n = getMaxLineLength(lines);
  var headerLine = lines[0];
  var colInfo = [];
  var colStart = 0;
  var inContent = false;
  var inHeader = false;
  var isContentChar, isHeaderChar, isColStart, colEnd;
  for (var i = 0; i <= n; i++) {
    isHeaderChar = testContentChar(headerLine, i);
    isContentChar = !testEmptyCol(lines, i);
    isColStart = isHeaderChar && !inHeader;
    if (isColStart && inContent) {
      return null;
    }
    if (i === n || (i > 0 && isColStart)) {
      colEnd = i === n ? undefined : i - 1;
      colInfo.push({
        name: readValue(headerLine, colStart, colEnd),
        end: colEnd,
        start: colStart,
      });
      colStart = i;
    }
    inContent = isContentChar;
    inHeader = isHeaderChar;
  }
  return colInfo.length > 0 ? colInfo : null;
}

function getMaxLineLength(lines) {
  var max = 0;
  for (var i = 0; i < lines.length; i++) {
    max = Math.max(max, lines[i].length);
  }
  return max;
}

function readValue(line, start, end) {
  return line.substring(start, end).trim();
}

function parseFixedWidthLine(str, fields) {
  var obj = {},
    field;
  for (var i = 0; i < fields.length; i++) {
    field = fields[i];
    obj[field.name] = readValue(str, field.start, field.end);
  }
  return obj;
}

function testContentChar(str, i) {
  return i < str.length && str[i] !== " ";
}

function testEmptyCol(samples, i) {
  var line;
  for (var j = 0; j < samples.length; j++) {
    line = samples[j];
    if (testContentChar(line, i)) return false;
  }
  return true;
}
