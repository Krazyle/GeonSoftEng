import iconv from "iconv-lite";
import { formatStringsAsGrid, print, stop } from "../utils/mapshaper-logging";
import { Buffer } from "../utils/mapshaper-node-buffer";
import utils from "../utils/mapshaper-utils";
import "iconv-lite/encodings";
var toUtf8 = getNativeEncoder("utf8");
var fromUtf8 = getNativeDecoder("utf8");

function getEncodings() {
  iconv.encodingExists("ascii");
  return Object.keys(iconv.encodings);
}

function _validateEncoding(enc) {
  if (!encodingIsSupported(enc)) {
    stop(
      "Unknown encoding:",
      enc,
      "\nRun the -encodings command see a list of supported encodings",
    );
  }
  return enc;
}

function _stringsAreAscii(arr) {
  return stringIsAscii(arr.join(""));
}

export function stringIsAscii(str) {
  var c;
  for (var i = 0, n = str.length; i < n; i++) {
    c = str.charCodeAt(i);
    if (c >= 128) return false;
  }
  return true;
}

export function encodingIsUtf8(enc) {
  return !enc || /^utf-?8$/i.test(String(enc));
}

export function encodingIsAsciiCompat(enc) {
  enc = standardizeEncodingName(enc);

  return !enc || /^(win|latin|utf8|ascii|iso88|gb)/.test(enc);
}

export function standardizeEncodingName(enc) {
  return (enc || "").toLowerCase().replace(/[_-]/g, "");
}

export function bufferToString(buf, enc, start, end) {
  if (start >= 0) {
    buf = buf.slice(start, end);
  }
  return decodeString(buf, enc);
}

function getNativeEncoder(enc) {
  var encoder = null;
  enc = standardizeEncodingName(enc);
  if (enc !== "utf8") {
    return null;
  }
  if (typeof TextEncoder !== "undefined") {
    encoder = new TextEncoder(enc);
  }
  return function (str) {
    return encoder
      ? Buffer.from(encoder.encode(str).buffer)
      : utils.createBuffer(str, enc);
  };
}

export function encodeString(str, enc) {
  var buf;
  if (encodingIsUtf8(enc)) {
    buf = toUtf8(str);
  } else {
    buf = iconv.encode(str, enc);
  }
  return buf;
}

function getNativeDecoder(enc) {
  var decoder = null;
  enc = standardizeEncodingName(enc);
  if (enc !== "utf8") {
    return null;
  }
  if (typeof TextDecoder !== "undefined") {
    decoder = new TextDecoder(enc);
  }
  return function (buf) {
    return decoder ? decoder.decode(buf) : buf.toString(enc);
  };
}

export function decodeString(buf, enc) {
  var str;
  if (encodingIsUtf8(enc)) {
    str = fromUtf8(buf);
  } else {
    str = iconv.decode(buf, enc);
  }
  return str;
}

function encodingIsSupported(raw) {
  var enc = standardizeEncodingName(raw);
  return getEncodings().includes(enc);
}

export function trimBOM(str) {
  if (str.charCodeAt(0) === 0xfeff) {
    str = str.substr(1);
  }
  return str;
}

function _printEncodings() {
  var encodings = getEncodings().filter(function (name) {
    return !/^(_|cs|internal|ibm|isoir|singlebyte|table|[0-9]|l[0-9]|windows)/.test(
      name,
    );
  });
  encodings.sort();
  print(`Supported encodings:\n${formatStringsAsGrid(encodings)}`);
}
