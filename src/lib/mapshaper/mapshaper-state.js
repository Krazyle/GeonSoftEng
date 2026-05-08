import utils from "./utils/mapshaper-utils";

var context = createContext();

export function runningInBrowser() {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}

export function getStateVar(key) {
  return context[key];
}

export function setStateVar(key, val) {
  context[key] = val;
}

function createContext() {
  return {
    DEBUG: false,
    QUIET: false,
    VERBOSE: false,
    defs: {},
    input_files: [],
  };
}

function _createAsyncContext(cb) {
  context = createContext();
  return function () {
    cb.apply(null, utils.toArray(arguments));

    context = createContext();
  };
}

export function preserveContext(cb) {
  var ctx = context;
  return function () {
    context = ctx;
    cb.apply(null, utils.toArray(arguments));
  };
}
