import { decodeString } from "../text/mapshaper-encodings";

export function detectEncodingFromBOM(bytes) {
  var n = bytes.length;
  if (n >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf16be";
  if (n >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf16le";
  if (n >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return "utf8";
  return "";
}

export function detectEncoding(samples) {
  var encoding = null;
  if (looksLikeUtf8(samples)) {
    encoding = "utf8";
  } else if (looksLikeWin1252(samples)) {
    encoding = "win1252";
  }
  return encoding;
}

export function decodeSamples(enc, samples) {
  return samples
    .map(function (buf) {
      return decodeString(buf, enc).trim();
    })
    .join("\n");
}

function looksLikeWin1252(samples) {
  var ascii = "abcdefghijklmnopqrstuvwxyz0123456789.'\"?+-\n,:;/|_$% ",
    extended = "ßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿ°–±’‘",
    str = decodeSamples("win1252", samples),
    asciiScore = getCharScore(str, ascii),
    totalScore = getCharScore(str, extended + ascii);
  return totalScore > 0.97 && asciiScore >= 0.6;
}

function looksLikeUtf8(samples) {
  var str = decodeSamples("utf8", samples);
  return str.indexOf("\ufffd") === -1;
}

function getCharScore(str, chars) {
  var index = {},
    count = 0,
    _score;
  str = str.toLowerCase();
  for (var i = 0, n = chars.length; i < n; i++) {
    index[chars[i]] = 1;
  }
  for (i = 0, n = str.length; i < n; i++) {
    count += index[str[i]] || 0;
  }
  return count / str.length;
}
