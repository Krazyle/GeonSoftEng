import { Transform } from "../geom/mapshaper-transform";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function Bounds() {
  if (arguments.length > 0) {
    this.setBounds.apply(this, arguments);
  }
}

Bounds.from = function () {
  var b = new Bounds();
  return b.setBounds.apply(b, arguments);
};

Bounds.prototype.toString = function () {
  return JSON.stringify({
    xmin: this.xmin,
    xmax: this.xmax,
    ymin: this.ymin,
    ymax: this.ymax,
  });
};

Bounds.prototype.toArray = function () {
  return this.hasBounds() ? [this.xmin, this.ymin, this.xmax, this.ymax] : [];
};

Bounds.prototype.hasBounds = function () {
  return this.xmin <= this.xmax && this.ymin <= this.ymax;
};

Bounds.prototype.sameBounds = Bounds.prototype.equals = function (bb) {
  return (
    bb &&
    this.xmin === bb.xmin &&
    this.xmax === bb.xmax &&
    this.ymin === bb.ymin &&
    this.ymax === bb.ymax
  );
};

Bounds.prototype.width = function () {
  return this.xmax - this.xmin || 0;
};

Bounds.prototype.height = function () {
  return this.ymax - this.ymin || 0;
};

Bounds.prototype.area = function () {
  return this.width() * this.height() || 0;
};

Bounds.prototype.empty = function () {
  this.xmin = this.ymin = this.xmax = this.ymax = void 0;
  return this;
};

Bounds.prototype.setBounds = function (a, b, c, d) {
  if (arguments.length === 1) {
    if (utils.isArrayLike(a)) {
      b = a[1];
      c = a[2];
      d = a[3];
      a = a[0];
    } else {
      b = a.ymin;
      c = a.xmax;
      d = a.ymax;
      a = a.xmin;
    }
  }

  this.xmin = a;
  this.ymin = b;
  this.xmax = c;
  this.ymax = d;
  if (a > c || b > d) this.update();

  return this;
};

Bounds.prototype.centerX = function () {
  var x = (this.xmin + this.xmax) * 0.5;
  return x;
};

Bounds.prototype.centerY = function () {
  var y = (this.ymax + this.ymin) * 0.5;
  return y;
};

Bounds.prototype.containsPoint = function (x, y) {
  if (x >= this.xmin && x <= this.xmax && y <= this.ymax && y >= this.ymin) {
    return true;
  }
  return false;
};

Bounds.prototype.containsBufferedPoint = Bounds.prototype.containsCircle =
  function (x, y, buf) {
    if (x + buf > this.xmin && x - buf < this.xmax) {
      if (y - buf < this.ymax && y + buf > this.ymin) {
        return true;
      }
    }
    return false;
  };

Bounds.prototype.intersects = function (bb) {
  if (
    bb.xmin <= this.xmax &&
    bb.xmax >= this.xmin &&
    bb.ymax >= this.ymin &&
    bb.ymin <= this.ymax
  ) {
    return true;
  }
  return false;
};

Bounds.prototype.contains = function (bb) {
  if (
    bb.xmin >= this.xmin &&
    bb.ymax <= this.ymax &&
    bb.xmax <= this.xmax &&
    bb.ymin >= this.ymin
  ) {
    return true;
  }
  return false;
};

Bounds.prototype.shift = function (x, y) {
  this.setBounds(this.xmin + x, this.ymin + y, this.xmax + x, this.ymax + y);
};

Bounds.prototype.padBounds = function (a, b, c, d) {
  this.xmin -= a;
  this.ymin -= b;
  this.xmax += c;
  this.ymax += d;
};

Bounds.prototype.scale = function (pct, pctY) {
  var halfWidth = (this.xmax - this.xmin) * 0.5;
  var halfHeight = (this.ymax - this.ymin) * 0.5;
  var kx = pct - 1;
  var ky = pctY === undefined ? kx : pctY - 1;
  this.xmin -= halfWidth * kx;
  this.ymin -= halfHeight * ky;
  this.xmax += halfWidth * kx;
  this.ymax += halfHeight * ky;
};

Bounds.prototype.cloneBounds = Bounds.prototype.clone = function () {
  return new Bounds(this.xmin, this.ymin, this.xmax, this.ymax);
};

Bounds.prototype.clearBounds = function () {
  this.setBounds(new Bounds());
};

Bounds.prototype.mergePoint = function (x, y) {
  if (this.xmin === void 0) {
    this.setBounds(x, y, x, y);
  } else {
    if (x < this.xmin) this.xmin = x;
    else if (x > this.xmax) this.xmax = x;

    if (y < this.ymin) this.ymin = y;
    else if (y > this.ymax) this.ymax = y;
  }
};

Bounds.prototype.fillOut = function (aspect, focusX, focusY) {
  if (arguments.length < 3) {
    focusX = 0.5;
    focusY = 0.5;
  }
  var w = this.width(),
    h = this.height(),
    currAspect = w / h,
    pad;
  if (Number.isNaN(aspect) || aspect <= 0) {
  } else if (currAspect < aspect) {
    pad = h * aspect - w;
    this.xmin -= (1 - focusX) * pad;
    this.xmax += focusX * pad;
  } else {
    pad = w / aspect - h;
    this.ymin -= (1 - focusY) * pad;
    this.ymax += focusY * pad;
  }
  return this;
};

Bounds.prototype.update = function () {
  var tmp;
  if (this.xmin > this.xmax) {
    tmp = this.xmin;
    this.xmin = this.xmax;
    this.xmax = tmp;
  }
  if (this.ymin > this.ymax) {
    tmp = this.ymin;
    this.ymin = this.ymax;
    this.ymax = tmp;
  }
};

Bounds.prototype.transform = function (t) {
  this.xmin = this.xmin * t.mx + t.bx;
  this.xmax = this.xmax * t.mx + t.bx;
  this.ymin = this.ymin * t.my + t.by;
  this.ymax = this.ymax * t.my + t.by;
  this.update();
  return this;
};

Bounds.prototype.getTransform = function (b2, flipY) {
  var t = new Transform();
  t.mx = b2.width() / this.width() || 1;
  t.bx = b2.xmin - t.mx * this.xmin;
  if (flipY) {
    t.my = -b2.height() / this.height() || 1;
    t.by = b2.ymax - t.my * this.ymin;
  } else {
    t.my = b2.height() / this.height() || 1;
    t.by = b2.ymin - t.my * this.ymin;
  }
  return t;
};

Bounds.prototype.mergeCircle = function (x, y, r) {
  if (r < 0) r = -r;
  this.mergeBounds([x - r, y - r, x + r, y + r]);
};

Bounds.prototype.mergeBounds = function (bb) {
  var a, b, c, d;
  if (bb instanceof Bounds) {
    a = bb.xmin;
    b = bb.ymin;
    c = bb.xmax;
    d = bb.ymax;
  } else if (arguments.length === 4) {
    a = arguments[0];
    b = arguments[1];
    c = arguments[2];
    d = arguments[3];
  } else if (bb.length === 4) {
    a = bb[0];
    b = bb[1];
    c = bb[2];
    d = bb[3];
  } else {
    error("Bounds#mergeBounds() invalid argument:", bb);
  }

  if (this.xmin === void 0) {
    this.setBounds(a, b, c, d);
  } else {
    if (a < this.xmin) this.xmin = a;
    if (b < this.ymin) this.ymin = b;
    if (c > this.xmax) this.xmax = c;
    if (d > this.ymax) this.ymax = d;
  }
  return this;
};
