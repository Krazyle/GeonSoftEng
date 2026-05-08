import { getLayerSelection } from "../dataset/mapshaper-command-utils";
import {
  getFeatureCount,
  getLayerBounds,
} from "../dataset/mapshaper-layer-utils";
import { compileFeatureExpression } from "../expressions/mapshaper-expressions";
import cmd from "../mapshaper-cmd";
import { getStateVar } from "../mapshaper-state";
import { getMode } from "../utils/mapshaper-calc-utils";
import { error, message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

cmd.calc = function (lyr, arcs, opts) {
  var msg = opts.expression,
    result,
    compiled,
    defs;
  if (opts.where) {
    lyr = getLayerSelection(lyr, arcs, opts);
    msg += ` where ${opts.where}`;
  }

  defs = getStateVar("defs");
  compiled = compileCalcExpression(lyr, arcs, opts.expression);
  result = compiled(null, defs);
  message(`${msg}:  ${result}`);
  return result;
};

function _evalCalcExpression(lyr, arcs, exp) {
  return compileCalcExpression(lyr, arcs, exp)();
}

export function compileCalcExpression(lyr, arcs, exp) {
  var rowNo = 0,
    colNo = 0,
    cols = [];
  var ctx1 = {
      count: assign,
      sum: captureNum,
      sums: capture,
      average: captureNum,
      median: captureNum,
      min: captureNum,
      max: captureNum,
      mode: capture,
      collect: capture,
      first: assignOnce,
      every: every,
      some: some,
      last: assign,
    },
    ctx2 = {
      count: wrap(function () {
        return rowNo;
      }, 0),
      sum: wrap(utils.sum, 0),
      sums: wrap(sums),
      median: wrap(utils.findMedian),
      min: wrap(min),
      max: wrap(max),
      average: wrap(utils.mean),
      mode: wrap(getMode),
      collect: wrap(pass),
      first: wrap(pass),
      every: wrap(pass, false),
      some: wrap(pass, false),
      last: wrap(pass),
    },
    len = getFeatureCount(lyr),
    calc1,
    calc2,
    _result;

  if (lyr.geometry_type) {
    ctx1.width = ctx1.height = noop;
    ctx2.width = function () {
      return getLayerBounds(lyr, arcs).width();
    };
    ctx2.height = function () {
      return getLayerBounds(lyr, arcs).height();
    };
  }

  calc1 = compileFeatureExpression(exp, lyr, arcs, {
    context: ctx1,
    no_assign: true,
    no_warn: true,
  });

  calc2 = compileFeatureExpression(exp, lyr, arcs, {
    returns: true,
    context: ctx2,
    no_warn: true,
  });

  return function (ids, destRec) {
    var result;

    if (ids) procRecords(ids);
    else procAll();

    result = calc2(undefined, destRec);
    reset();
    return result;
  };

  function pass(o) {
    return o;
  }

  function max(arr) {
    return utils.getArrayBounds(arr).max;
  }

  function sums(arr) {
    var n = arr?.length ? arr[0].length : 0;
    var output = utils.initializeArray(Array(n), 0);
    arr.forEach(function (arr) {
      if (!arr?.length) return;
      for (var i = 0; i < n; i++) {
        output[i] += +arr[i] || 0;
      }
    });
    return output;
  }

  function min(arr) {
    return utils.getArrayBounds(arr).min;
  }

  function wrap(proc, nullVal) {
    var nodata = arguments.length > 1 ? nullVal : null;
    return function () {
      var c = colNo++;
      return rowNo > 0 ? proc(cols[c]) : nodata;
    };
  }

  function procAll() {
    for (var i = 0; i < len; i++) {
      procRecord(i);
    }
  }

  function procRecords(ids) {
    ids.forEach(procRecord);
  }

  function procRecord(i) {
    if (i < 0 || i >= len) error("Invalid record index");
    calc1(i);
    rowNo++;
    colNo = 0;
  }

  function noop() {}

  function reset() {
    rowNo = 0;
    colNo = 0;
    cols = [];
  }

  function captureNum(val) {
    if (Number.isNaN(val) && val) {
      stop("Expected a number, received:", val);
    }
    return capture(val);
  }

  function assignOnce(val) {
    if (rowNo === 0) cols[colNo] = val;
    colNo++;
    return val;
  }

  function every(val) {
    val = !!val;
    cols[colNo] = rowNo === 0 ? val : cols[colNo] && val;
    colNo++;
  }

  function some(val) {
    val = !!val;
    cols[colNo] = cols[colNo] || val;
    colNo++;
  }

  function assign(val) {
    cols[colNo++] = val;
    return val;
  }

  function capture(val) {
    var col;
    if (rowNo === 0) {
      cols[colNo] = [];
    }
    col = cols[colNo];
    if (col.length !== rowNo) {
      stop("Evaluation failed");
    }
    col.push(val);
    colNo++;
    return val;
  }
}
