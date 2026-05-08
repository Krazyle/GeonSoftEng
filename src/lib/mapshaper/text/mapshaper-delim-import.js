import { DataTable } from "../datatable/mapshaper-data-table";
import {
  deleteFields,
  isInvalidFieldName,
} from "../datatable/mapshaper-data-utils";
import {
  BufferReader,
  FileReader,
  readFirstChars,
} from "../io/mapshaper-file-reader";
import {
  readDelimRecords,
  readDelimRecordsFromString,
} from "../text/mapshaper-delim-reader";
import { detectEncodingFromBOM } from "../text/mapshaper-encoding-detection";
import { encodingIsAsciiCompat, trimBOM } from "../text/mapshaper-encodings";
import { error, message } from "../utils/mapshaper-logging";
import { Buffer } from "../utils/mapshaper-node-buffer";
import utils from "../utils/mapshaper-utils";

function _importDelim(str, opts) {
  return importDelim2({ content: str }, opts);
}

export function importDelim2(data, opts) {
  var readFromFile = !data.content && data.content !== "",
    content = data.content,
    _filter,
    reader,
    records,
    delimiter,
    table,
    encoding;
  opts = opts || {};

  if (readFromFile) {
    reader = new FileReader(data.filename);
  } else if (content instanceof ArrayBuffer || content instanceof Buffer) {
    reader = new BufferReader(content);
    content = null;
  } else if (utils.isString(content)) {
  } else {
    error("Unexpected object type");
  }

  if (reader) {
    encoding = detectEncodingFromBOM(
      reader.readSync(0, Math.min(reader.size(), 3)),
    );

    if (encoding === "utf16be" || encoding === "utf16le") {
      content = trimBOM(reader.toString(encoding));
      reader = null;
    } else if (opts.encoding && !encodingIsAsciiCompat(opts.encoding)) {
      content = reader.toString(opts.encoding);
      reader = null;
    }
  }

  if (reader) {
    delimiter = guessDelimiter(readFirstChars(reader, 2000));
    records = readDelimRecords(reader, delimiter, opts);
  } else {
    delimiter = guessDelimiter(content);
    records = readDelimRecordsFromString(content, delimiter, opts);
  }
  if (records.length === 0) {
    message("Unable to read any data records");
  }
  adjustRecordTypes(records, opts);
  table = new DataTable(records);
  deleteFields(table, isInvalidFieldName);
  return {
    layers: [{ data: table }],
    info: { input_delimiter: delimiter },
  };
}

var supportedDelimiters = ["|", "\t", ",", ";", " "];

function _isSupportedDelimiter(d) {
  return utils.contains(supportedDelimiters, d);
}

function guessDelimiter(content) {
  return (
    utils.find(supportedDelimiters, function (delim) {
      var rxp = getDelimiterRxp(delim);
      return rxp.test(content);
    }) || ","
  );
}

function getDelimiterRxp(delim) {
  var rxp = `^[^\\n\\r]+${utils.regexEscape(delim)}`;
  return new RegExp(rxp);
}

function getFieldTypeHints(opts) {
  var hints = {};
  opts = opts || {};
  if (opts.string_fields) {
    opts.string_fields.forEach(function (f) {
      hints[f] = "string";
    });
  }
  if (opts.field_types) {
    opts.field_types.forEach(function (raw) {
      var parts, name, type;
      if (raw.indexOf(":") !== -1) {
        parts = raw.split(":");
        name = parts[0];
        type = validateFieldType(parts[1]);
      } else if (raw[0] === "+") {
        name = raw.substr(1);
        type = "number";
      }
      if (type) {
        hints[name] = type;
      } else {
        message(`Invalid type hint (expected :str or :num) [${raw}]`);
      }
    });
  }
  return hints;
}

function adjustRecordTypes(records, optsArg) {
  var opts = optsArg || {},
    typeIndex = getFieldTypeHints(opts),
    singleType = typeIndex["*"],
    fields = Object.keys(records[0] || []),
    detectedNumFields = [],
    parseNumber = opts.decimal_comma
      ? utils.parseIntlNumber
      : utils.parseNumber,
    replacements = {};
  fields.forEach(function (key) {
    var typeHint = typeIndex[key];
    var values = null;
    if (typeHint === "number" || singleType === "number") {
      values = convertDataField(key, records, parseNumber);
    } else if (typeHint === "string" || singleType === "string") {
      values = null;
    } else {
      values = tryNumericField(key, records, parseNumber);
      if (values) detectedNumFields.push(key);
    }
    if (values) replacements[key] = values;
  });
  if (Object.keys(replacements).length > 0) {
    updateFieldsInRecords(fields, records, replacements);
  }
  if (detectedNumFields.length > 0) {
    message(
      utils.format(
        "Auto-detected number field%s: %s",
        detectedNumFields.length === 1 ? "" : "s",
        detectedNumFields.join(", "),
      ),
    );
  }
}

function updateFieldsInRecords(fields, records, replacements) {
  var convertBody =
    "return {" +
    fields
      .map(function (name) {
        var key = JSON.stringify(name);
        return (
          key +
          ": " +
          (replacements[name] ? `replacements[${key}][i]` : `rec[${key}]`)
        );
      })
      .join(", ") +
    "}";
  var convert = new Function("rec", "replacements", "i", convertBody);
  records.forEach(function (rec, i) {
    records[i] = convert(rec, replacements, i);
  });
}

function tryNumericField(key, records, parseNumber) {
  var arr = [],
    count = 0,
    raw,
    str,
    num;
  for (var i = 0, n = records.length; i < n; i++) {
    raw = records[i][key];
    num = parseNumber(raw);
    if (num === null) {
      str = raw ? raw.trim() : "";
      if (str.length > 0 && str !== "NA" && str !== "NaN") {
        return null;
      }
    } else {
      count++;
    }
    arr.push(num);
  }
  return count > 0 ? arr : null;
}

function convertDataField(name, records, f) {
  var values = [];
  for (var i = 0, n = records.length; i < n; i++) {
    values.push(f(records[i][name]));
  }
  return values;
}

function validateFieldType(hint) {
  var str = hint.toLowerCase(),
    type = null;
  if (str[0] === "n") {
    type = "number";
  } else if (str[0] === "s") {
    type = "string";
  }
  return type;
}
