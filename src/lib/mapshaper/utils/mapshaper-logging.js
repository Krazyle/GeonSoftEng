import { getStateVar } from "../mapshaper-state";
import utils from "../utils/mapshaper-utils";

var LOGGING = false;
var STDOUT = false;

var _error = function () {
  var msg = utils.toArray(arguments).join(" ");
  throw new Error(msg);
};

var _stop = function () {
  throw new UserError(formatLogArgs(arguments));
};

var _interrupt = function () {
  throw new NonFatalError(formatLogArgs(arguments));
};

var _message = function () {
  logArgs(arguments);
};

function _enableLogging() {
  LOGGING = true;
}

function _loggingEnabled() {
  return !!LOGGING;
}

export function error() {
  _error.apply(null, utils.toArray(arguments));
}

export function stop() {
  _stop.apply(null, utils.toArray(arguments));
}

function interrupt() {
  _interrupt.apply(null, utils.toArray(arguments));
}

export function message() {
  _message.apply(null, messageArgs(arguments));
}

function _setLoggingFunctions(message, error, stop) {
  _message = message;
  _error = error;
  _stop = stop;
}

export function print() {
  STDOUT = true;
  message.apply(null, arguments);
  STDOUT = false;
}

export function verbose() {
  if (getStateVar("VERBOSE") || getStateVar("verbose")) {
    message.apply(null, arguments);
  }
}

export function debug() {
  if (getStateVar("DEBUG") || getStateVar("debug")) {
    logArgs(arguments);
  }
}

function _printError(err) {
  var msg;
  if (!LOGGING) return;
  if (utils.isString(err)) {
    err = new UserError(err);
  }
  if (err.name === "NonFatalError") {
    console.error(messageArgs([err.message]).join(" "));
  } else if (err.name === "UserError") {
    msg = err.message;
    if (!/Error/.test(msg)) {
      msg = `Error: ${msg}`;
    }
    console.error(messageArgs([msg]).join(" "));
    console.error("Run mapshaper -h to view help");
  } else {
    console.error(err);
  }
}

function UserError(msg) {
  var err = new Error(msg);
  err.name = "UserError";
  return err;
}

function NonFatalError(msg) {
  var err = new Error(msg);
  err.name = "NonFatalError";
  return err;
}

function _formatColumns(arr, alignments) {
  var widths = arr.reduce(function (memo, line) {
    return line.map(function (str, i) {
      return memo ? Math.max(memo[i], str.length) : str.length;
    });
  }, null);
  return arr
    .map(function (line) {
      line = line.map(function (str, i) {
        var rt = alignments && alignments[i] === "right";
        var pad = (rt ? str.padStart : str.padEnd).bind(str);
        return pad(widths[i], " ");
      });
      return `  ${line.join(" ")}`;
    })
    .join("\n");
}

export function formatStringsAsGrid(arr) {
  var longest = arr.reduce(function (len, str) {
      return Math.max(len, str.length);
    }, 0),
    colWidth = longest + 2,
    perLine = Math.floor(80 / colWidth) || 1;
  return arr.reduce(function (memo, name, i) {
    var col = i % perLine;
    if (i > 0 && col === 0) memo += "\n";
    if (col < perLine - 1) {
      name = utils.rpad(name, colWidth - 2, " ");
    }
    return `${memo}  ${name}`;
  }, "");
}

function formatLogArgs(args) {
  return utils.toArray(args).join(" ");
}

function messageArgs(args) {
  var arr = utils.toArray(args);
  var cmd = getStateVar("current_command");
  if (cmd && cmd !== "help") {
    arr.unshift(`[${cmd}]`);
  }
  return arr;
}

function logArgs(args) {
  if (!LOGGING || getStateVar("QUIET") || !utils.isArrayLike(args)) return;
  var msg = formatLogArgs(args);
  if (STDOUT) console.log(msg);
  else console.error(msg);
}
