import { initDataTable } from "../dataset/mapshaper-layer-utils";
import { addUtils } from "../expressions/mapshaper-expression-utils";
import { initFeatureProxy } from "../expressions/mapshaper-feature-proxy";
import { addLayerGetters } from "../expressions/mapshaper-layer-proxy";
import { getStateVar } from "../mapshaper-state";
import { message, stop } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function compileValueExpression(exp, lyr, arcs, opts) {
  opts = opts || {};
  opts.returns = true;
  return compileFeatureExpression(exp, lyr, arcs, opts);
}

function cleanExpression(exp) {
  return exp.replace(/\\\n/g, " ");
}

export function compileFeaturePairFilterExpression(exp, lyr, arcs) {
  var func = compileFeaturePairExpression(exp, lyr, arcs);
  return function (idA, idB) {
    var val = func(idA, idB);
    if (val !== true && val !== false) {
      stop("where expression must return true or false");
    }
    return val;
  };
}

export function compileFeaturePairExpression(rawExp, lyr, arcs) {
  var exp = cleanExpression(rawExp);

  var ctx = getExpressionContext({});
  var getA = getProxyFactory(lyr, arcs);
  var getB = getProxyFactory(lyr, arcs);
  var vars = getAssignedVars(exp);
  var functionBody = `with($$env){with($$record){return ${exp}}}`;
  var func;

  try {
    func = new Function("$$record,$$env", functionBody);
  } catch (e) {
    console.error(e);
    stop(e.name, `in expression [${exp}]`);
  }

  nullifyUnsetProperties(vars, ctx);

  function getProxyFactory(lyr, arcs) {
    var records = lyr.data ? lyr.data.getRecords() : [];
    var getFeatureById = initFeatureProxy(lyr, arcs);
    function Proxy() {}

    return function (id) {
      var proxy;
      if (id === -1) return null;
      Proxy.prototype = records[id] || {};
      proxy = new Proxy();
      proxy.$ = getFeatureById(id);
      return proxy;
    };
  }

  return function (idA, idB, rec) {
    var val;
    ctx.A = getA(idA);
    ctx.B = getB(idB);
    if (rec) {
      nullifyUnsetProperties(vars, rec);
    }
    try {
      val = func.call(ctx, rec || {}, ctx);
    } catch (e) {
      stop(e.name, `in expression [${exp}]:`, e.message);
    }
    return val;
  };
}

export function compileFeatureExpression(rawExp, lyr, arcs, opts_) {
  var opts = utils.extend({}, opts_),
    exp = cleanExpression(rawExp || ""),
    mutable = !opts.no_assign,
    vars = getAssignedVars(exp),
    func,
    records;

  if (mutable && vars.length > 0 && !lyr.data) {
    initDataTable(lyr);
  }

  if (!mutable) {
    opts.context = opts.context || {};
    nullifyUnsetProperties(vars, opts.context);
  }

  records = lyr.data ? lyr.data.getRecords() : [];
  func = getExpressionFunction(exp, lyr, arcs, opts);

  return function (recId, destRec) {
    var record;
    if (destRec) {
      record = destRec;
    } else {
      record = records[recId] || (records[recId] = {});
    }

    if (mutable) {
      nullifyUnsetProperties(vars, record);
    }
    return func(record, recId);
  };
}

function getAssignedVars(exp, hasDot) {
  var rxp = /[a-z_$][.a-z0-9_$]*(?= *=[^>=])/gi;
  var matches = exp.match(rxp) || [];
  var f = function (s) {
    var i = s.indexOf(".");
    return hasDot ? i > -1 : i === -1;
  };
  var vars = utils.uniq(matches.filter(f));
  return vars;
}

function _getAssignmentObjects(exp) {
  var matches = getAssignedVars(exp, true),
    names = [];
  matches.forEach(function (s) {
    var match = /^([^.]+)\.[^.]+$/.exec(s);
    var name = match ? match[1] : null;
    if (name && name !== "this") {
      names.push(name);
    }
  });
  return utils.uniq(names);
}

export function compileExpressionToFunction(exp, opts) {
  var functionBody =
    "with($$env){with($$record){ " +
    (opts.returns ? "return " : "") +
    exp +
    "}}";
  var func;
  try {
    func = new Function("$$record,$$env", functionBody);
  } catch (e) {
    stop(e.name, `in expression [${exp}]`);
  }
  return func;
}

function getExpressionFunction(exp, lyr, arcs, opts) {
  var getFeatureById = initFeatureProxy(lyr, arcs, opts);
  var layerOnlyProxy = addLayerGetters({}, lyr, arcs);
  var ctx = getExpressionContext(lyr, opts.context, opts);
  var func = compileExpressionToFunction(exp, opts);
  return function (rec, i) {
    var val;

    ctx.$ = i >= 0 ? getFeatureById(i) : layerOnlyProxy;
    ctx._ = ctx;
    ctx.d = rec || null;
    try {
      val = func.call(ctx.$, rec, ctx);
    } catch (e) {
      stop(e.name, `in expression [${exp}]:`, e.message);
    }
    return val;
  };
}

function nullifyUnsetProperties(vars, obj) {
  for (var i = 0; i < vars.length; i++) {
    if (vars[i] in obj === false) {
      obj[vars[i]] = null;
    }
  }
}

function getExpressionContext(lyr, mixins, opts) {
  var defs = getStateVar("defs");
  var env = getBaseContext();
  var ctx = {};
  var fields = lyr.data ? lyr.data.getFields() : [];
  opts = opts || {};
  addUtils(env);
  if (fields.length > 0) {
    nullifyUnsetProperties(fields, env);
  }

  mixins = utils.defaults(mixins || {}, defs);

  env.global = defs;
  Object.keys(mixins).forEach(function (key) {
    var d = Object.getOwnPropertyDescriptor(mixins, key);
    if (d.get) {
      Object.defineProperty(ctx, key, { get: d.get });
    } else {
      Object.defineProperty(ctx, key, { value: mixins[key] });
    }
  });

  return Object.keys(env).reduce(function (memo, key) {
    if (key in memo) {
      if (!opts.no_warn) {
        if (typeof memo[key] === "function" && fields.indexOf(key) > -1) {
          message(
            "Warning: " +
              key +
              "() function is hiding a data field with the same name",
          );
        } else {
          message(`Warning: "${key}" has multiple definitions`);
        }
      }
    } else {
      Object.defineProperty(memo, key, { value: env[key] });
    }
    return memo;
  }, ctx);
}

export function getBaseContext() {
  var obj = { globalThis: void 0 };
  (function () {
    for (var key in this) {
      obj[key] = void 0;
    }
  })();
  obj.console = console;
  return obj;
}
