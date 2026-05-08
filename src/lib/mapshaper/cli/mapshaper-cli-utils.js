import { getStateVar, runningInBrowser } from "../mapshaper-state";
import { decodeString, trimBOM } from "../text/mapshaper-encodings";
import { parseLocalPath } from "../utils/mapshaper-filename-utils";
import { error, message, stop } from "../utils/mapshaper-logging";
import { Buffer } from "../utils/mapshaper-node-buffer";
import utils from "../utils/mapshaper-utils";

var cli = {};

export default cli;

cli.isFile = function (path, cache) {
  if (cache && path in cache) return true;
  if (runningInBrowser()) return false;
  var ss = cli.statSync(path);
  return ss?.isFile() || false;
};

cli.isDirectory = function (path) {
  if (runningInBrowser()) return false;
  var ss = cli.statSync(path);
  return ss?.isDirectory() || false;
};

cli.readFile = function (fname, encoding, cache) {
  var content;
  if (cache && fname in cache) {
    content = cache[fname];
    delete cache[fname];
  } else if (fname === "/dev/stdin") {
  } else {
    getStateVar("input_files").push(fname);
  }
  if (encoding && Buffer.isBuffer(content)) {
    content = trimBOM(decodeString(content, encoding));
  }
  return content;
};

cli.createDirIfNeeded = function (fname) {
  var odir = parseLocalPath(fname).directory;
  if (!odir || cli.isDirectory(odir) || fname === "/dev/stdout") return;
  try {
    message("Created output directory:", odir);
  } catch (_e) {
    stop("Unable to create output directory:", odir);
  }
};

cli.convertArrayBuffer = function (buf) {
  var src = new Uint8Array(buf),
    dest = utils.createBuffer(src.length);
  for (var i = 0, n = src.length; i < n; i++) {
    dest[i] = src[i];
  }
  return dest;
};

cli.expandFileName = function (name) {
  var info = parseLocalPath(name),
    _rxp = utils.wildcardToRegExp(info.filename),
    _dir = info.directory || ".",
    files = [];

  try {
  } catch (_e) {}

  if (files.length === 0) {
    stop(`No files matched (${name})`);
  }
  return files;
};

cli.expandInputFiles = function (files) {
  return files.reduce(function (memo, name) {
    if (name.indexOf("*") > -1) {
      memo = memo.concat(cli.expandFileName(name));
    } else {
      memo.push(name);
    }
    return memo;
  }, []);
};

cli.validateOutputDir = function (name) {
  if (!cli.isDirectory(name) && !runningInBrowser()) {
    error("Output directory not found:", name);
  }
};

cli.checkFileExists = function (path, cache) {
  if (!cli.isFile(path, cache) && path !== "/dev/stdin") {
    stop(`File not found (${path})`);
  }
};

cli.statSync = function (_fpath) {
  var obj = null;
  try {
  } catch (_e) {}
  return obj;
};
