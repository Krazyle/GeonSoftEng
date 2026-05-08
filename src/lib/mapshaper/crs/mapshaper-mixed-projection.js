import mproj from "mproj";
import { Bounds } from "../geom/mapshaper-bounds";
import { Matrix2D } from "../geom/mapshaper-matrix2d";
import utils from "../utils/mapshaper-utils";

export function MixedProjection(mainParams, options) {
  var mainFrame = initFrame(mainParams);
  var mainP = mainFrame.crs;
  var frames = [mainFrame];
  var mixedP = initMixedProjection(mproj);

  mainP.__mixed_crs = mixedP;

  mainP.addFrame = function (paramsArg) {
    var params = getFrameParams(paramsArg, options);
    var frame = initFrame(params);
    var m = new Matrix2D();

    var originXY = params.origin
      ? projectFrameOrigin(params.origin, frame.crs)
      : [0, 0];
    var placementXY = params.placement || [0, 0];
    var dx = placementXY[0] - originXY[0] + (+params.dx || 0);
    var dy = placementXY[1] - originXY[1] + (+params.dy || 0);

    if (params.rotation) {
      m.rotate((params.rotation * Math.PI) / 180.0, originXY[0], originXY[1]);
    }
    if (params.scale) {
      m.scale(params.scale, params.scale, originXY[0], originXY[1]);
    }
    m.translate(dx, dy);

    frame.matrix = m;
    frames.push(frame);
    return this;
  };

  function initFrame(params) {
    return {
      bounds: new Bounds(bboxToRadians(params.bbox)),
      crs: mproj.pj_init(params.proj),
    };
  }

  function bboxToRadians(bbox) {
    var D2R = Math.PI / 180;
    return bbox.map(function (deg) {
      return deg * D2R;
    });
  }

  function projectFrameOrigin(origin, P) {
    var xy = mproj.pj_fwd_deg({ lam: origin[0], phi: origin[1] }, P);
    return [xy.x, xy.y];
  }

  mixedP.fwd = function (lp, xy) {
    var frame, xy2;
    for (var i = 0, n = frames.length; i < n; i++) {
      frame = frames[i];
      if (frame.bounds.containsPoint(lp.lam, lp.phi)) {
        xy2 = mproj.pj_fwd(lp, frame.crs);
        if (frame.matrix) {
          frame.matrix.transformXY(xy2.x, xy2.y, xy2);
        }
        break;
      }
    }
    xy.x = xy2 ? xy2.x : Infinity;
    xy.y = xy2 ? xy2.y : Infinity;
  };

  return mainP;
}

function initMixedProjection(mproj) {
  if (!mproj.internal.pj_list.mixed) {
    mproj.pj_add(
      function (P) {
        P.a = 1;
      },
      "mixed",
      "Mapshaper Mixed Projection",
    );
  }
  return mproj.pj_init("+proj=mixed");
}

function getFrameParams(params, options) {
  var opts = options[params.name];
  utils.defaults(params, { scale: 1, dx: 0, dy: 0, rotation: 0 });
  if (!opts) return params;
  Object.keys(opts).forEach(function (key) {
    var val = opts[key];
    if (key in params) {
      params[key] = opts[key];
    } else {
      params.proj = replaceProjParam(params.proj, key, val);
    }
  });
  return params;
}

function replaceProjParam(proj, key, val) {
  var param = `+${key}=`;
  return proj
    .split(" ")
    .map(function (str) {
      if (str.indexOf(param) === 0) {
        str = str.substr(0, param.length) + val;
      }
      return str;
    })
    .join(" ");
}
