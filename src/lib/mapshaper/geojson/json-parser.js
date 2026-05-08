import { BufferReader } from "../io/mapshaper-file-reader";
import { stop } from "../utils/mapshaper-logging";

var LBRACE = 123,
  RBRACE = 125,
  LBRACK = 91,
  RBRACK = 93,
  DQUOTE = 34,
  COMMA = 44;

var EOF;

var RESERVE = 0x1000;
var BUFLEN = 1e7;
var MAX_STRLEN = 5e6;

function _parse(buf) {
  var reader = new BufferReader(buf);
  var src = ByteReader(reader, 0);
  skipWS(src);
  var val = readValue(src);
  skipWS(src);
  if (src.peek() !== EOF) {
    unexpectedCharAt(src.peek(), src.index());
  }
  return val;
}

export function parseObjects(reader, offset, cb) {
  var src = ByteReader(reader, offset);
  seekObjectStart(src);
  while (src.peek() === LBRACE) {
    cb(readObject(src));
    readToken(src, COMMA);
  }
}

function parseError(msg, i) {
  if (i >= 0) {
    msg += ` at position ${i}`;
  }
  stop(msg);
}

function unexpectedCharAt(tok, i) {
  var msg;
  if (tok === EOF) {
    return parseError("Unexpected end of JSON input");
  }
  if (tok === DQUOTE) {
    msg = "Unexpected string in JSON";
  } else if (tok < 33 || tok > 126) {
    msg = "Unexpected token in JSON";
  } else {
    msg = `Unexpected token ${String.fromCharCode(tok)} in JSON`;
  }
  parseError(msg, i);
}

function stringOverflow(i, c) {
  if (c === EOF) {
    parseError("Unterminated string in JSON", i);
  }
  parseError("Too-long string in JSON", i);
}

function seekObjectStart(src) {
  var c = src.getChar();
  var i = 0;
  while (c !== EOF && i < RESERVE) {
    i++;
    if (c === LBRACE) {
      src.back();
      return true;
    }
    c = src.getChar();
  }
  return false;
}

function isWS(c) {
  return c === 32 || c === 10 || c === 13 || c === 9;
}

function skipWS(src) {
  while (isWS(src.peek())) src.advance();
}

function readArray(src) {
  var arr = [],
    c;
  eatChar(src, LBRACK);
  c = readToken(src, RBRACK);
  while (c !== RBRACK) {
    src.refresh();
    arr.push(readArrayElement(src));
    c = readAorB(src, COMMA, RBRACK);
  }
  return arr;
}

function readArrayElement(src) {
  var i = src.index();
  var x, y, a, b;
  if (src.getChar() === LBRACK && isFirstNumChar(src.peek())) {
    x = readNumber(src);
    a = src.getChar();
    skipWS(src);
    if (a === COMMA && isFirstNumChar(src.peek())) {
      y = readNumber(src);
      b = src.getChar();
      if (b === RBRACK) {
        return [x, y];
      } else if (b === COMMA) {
        return extendArray(src, [x, y]);
      }
    }
  }

  src.index(i);
  return readValue(src);
}

function extendArray(src, arr) {
  skipWS(src);
  do {
    src.refresh();
    arr.push(readValue(src));
  } while (readAorB(src, COMMA, RBRACK) === COMMA);
  return arr;
}

function eatChars(src, str) {
  for (var i = 0; i < str.length; i++) {
    eatChar(src, str.charCodeAt(i));
  }
  return true;
}

function eatChar(src, char) {
  var c = src.getChar();
  if (c !== char) {
    unexpectedCharAt(c, src.index() - 1);
  }
}

function readToken(src, tok) {
  skipWS(src);
  var c = src.peek();
  if (c === tok) {
    src.advance();
    skipWS(src);
    return tok;
  }
  return null;
}

function readValue(src) {
  var c = src.peek();
  var val;
  if (isFirstNumChar(c)) val = readNumber(src);
  else if (c === LBRACK) val = readArray(src);
  else if (c === DQUOTE) val = readString(src);
  else if (c === LBRACE) val = readObject(src);
  else if (c === 110) val = eatChars(src, "null") && null;
  else if (c === 116) val = eatChars(src, "true") && true;
  else if (c === 102) val = eatChars(src, "false") && false;
  else unexpectedCharAt(c, src.index());
  return val;
}

function readAorB(src, a, b) {
  skipWS(src);
  var c = src.getChar();
  if (c !== a && c !== b) unexpectedCharAt(c, src.index() - 1);
  skipWS(src);
  return c;
}

function readObject(src) {
  var o = {};
  var key, c;
  eatChar(src, LBRACE);
  c = readToken(src, RBRACE);
  while (c !== RBRACE) {
    src.refresh();
    key = readKey(src);
    skipWS(src);
    eatChar(src, 58);
    skipWS(src);

    o[key] =
      key === "type" && src.peek() === DQUOTE ? readKey(src) : readValue(src);
    c = readAorB(src, COMMA, RBRACE);
  }
  return o;
}

function growReserve() {
  RESERVE *= 2;
  return RESERVE <= MAX_STRLEN;
}

function readKey(src) {
  var MAXLEN = 2000;
  var i = src.index();
  var cache = src.cache;
  var escapeNext = false;
  var n = 0;
  eatChar(src, DQUOTE);
  var c = src.getChar();
  while (c !== DQUOTE || escapeNext === true) {
    n++;
    if (n > MAXLEN) {
      stringOverflow(i, c);
    }
    if (escapeNext) {
      escapeNext = false;
    } else if (c === 92) {
      escapeNext = true;
    }
    if (!cache[c]) {
      cache[c] = [];
    }
    cache = cache[c];
    c = src.getChar();
  }
  if (cache[0]) {
    return cache[0];
  }
  src.index(i);
  cache[0] = readString(src);
  return cache[0];
}

function readString(src) {
  var i = src.index();
  eatChar(src, DQUOTE);
  var LIMIT = 256;
  var n = 0;
  var str = "";
  var c = src.getChar();
  while (c !== DQUOTE) {
    n++;
    if (n > LIMIT || c === 92 || c < 32 || c > 126) {
      src.index(i);
      return readString_slow(src);
    }

    str += String.fromCharCode(c);
    c = src.getChar();
  }
  return str;
}

function readString_slow(src) {
  src.refresh();
  var LIMIT = RESERVE - 2;
  var i = src.index();
  var n = 0;
  var escapeNext = false;
  eatChar(src, DQUOTE);
  var c = src.getChar();
  var str;
  while (c !== DQUOTE || escapeNext === true) {
    n++;
    if (n > LIMIT) {
      if (c === EOF || !growReserve()) {
        stringOverflow(i, c);
      }
      src.index(i);
      return readString_slow(src);
    }
    if (escapeNext) {
      escapeNext = false;
    } else if (c === 92) {
      escapeNext = true;
    }
    c = src.getChar();
  }

  str = JSON.parse(src.toString(i, n + 2));
  src.refresh();
  return str;
}

function isDigit(c) {
  return c >= 48 && c <= 57;
}

function isFirstNumChar(c) {
  return (c >= 48 && c <= 57) || c === 45;
}

function isNumChar(c) {
  return (
    (c >= 48 && c <= 57) ||
    c === 45 ||
    c === 46 ||
    c === 43 ||
    c === 69 ||
    c === 101
  );
}

function readNumber_slow(src) {
  var i = src.index();
  var n = 0;
  while (isNumChar(src.getChar())) {
    n++;
  }
  src.back();
  var str = src.toString(i, n);
  var num = Number(str);
  if (Number.isNaN(num)) parseError("Invalid number in JSON", i);
  return num;
}

function readNumber(src) {
  var i = src.index();
  var num = 0;
  var den = 1;
  var sign = 1;
  var oflo = false;
  var invalid = false;
  var c = src.getChar();
  var d0, d;
  if (c === 45) {
    sign = -1;
    c = src.getChar();
  }
  d0 = c;
  while (isDigit(c)) {
    d = c - 48;
    num = num * 10 + d;
    c = src.getChar();
  }
  if (num > 0 && d0 === 48) {
    invalid = true;
  }
  if (c === 46) {
    while (isDigit((c = src.getChar()))) {
      d = c - 48;
      den *= 10;
      num = num * 10 + d;
    }
    if (den === 1 || d0 === 46) {
      invalid = true;
    }
  }
  if (num === 0 && d0 !== 48) {
    invalid = true;
  }
  if (invalid) parseError("Invalid number in JSON", i);
  if (den > 1e22) oflo = true;
  if (num >= 0x20000000000000) {
    if (num >= 0x40000000000000 || (d & 1) === 1) {
      oflo = true;
    }
  }
  if (oflo || c === 69 || c === 101) {
    src.index(i);
    return readNumber_slow(src);
  }
  src.back();
  return (sign * num) / den;
}

function ByteReader(reader, start) {
  var fileLen = reader.size();
  var bufOffs = start;
  var buf = reader.readSync(bufOffs, BUFLEN);
  var i = 0;
  var obj = { peek, getChar, advance, back, toString, index, refresh };
  obj.cache = [];
  refresh();
  return obj;

  function refresh() {
    if (buf.length - i >= RESERVE) return;

    if (bufOffs + buf.length >= fileLen) return;

    bufOffs += i;
    i = 0;
    buf = reader.readSync(bufOffs, BUFLEN);
  }
  function peek() {
    return buf[i];
  }
  function getChar() {
    return buf[i++];
  }
  function advance() {
    i++;
  }
  function back() {
    i--;
  }
  function index(idx) {
    if (idx >= 0 === false) return i + bufOffs;
    i = idx - bufOffs;
  }
  function toString(idx, n) {
    var i = idx - bufOffs;
    return buf.toString("utf8", i, i + n);
  }
}
