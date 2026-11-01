// @ts-check
/** SVG path builders with deterministic number formatting (ported from Dragon Valley). */
import { dist, f, polar } from './num.mjs';

/** @typedef {import('./num.mjs').Pt} Pt */

/** @param {number} x @param {number} y */
export const M = (x, y) => `M${f(x)} ${f(y)}`;
/** @param {number} x @param {number} y */
export const L = (x, y) => `L${f(x)} ${f(y)}`;
/**
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @param {number} x @param {number} y
 */
export const C = (x1, y1, x2, y2, x, y) => `C${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x)} ${f(y)}`;
/** @param {number} x1 @param {number} y1 @param {number} x @param {number} y */
export const Q = (x1, y1, x, y) => `Q${f(x1)} ${f(y1)} ${f(x)} ${f(y)}`;
/**
 * @param {number} rx @param {number} ry @param {number} rot @param {0 | 1} large
 * @param {0 | 1} sweep @param {number} x @param {number} y
 */
export const A = (rx, ry, rot, large, sweep, x, y) =>
  `A${f(rx)} ${f(ry)} ${f(rot)} ${large} ${sweep} ${f(x)} ${f(y)}`;
export const Z = 'Z';

/** @param {Pt} p */
export const Mp = (p) => M(p.x, p.y);
/** @param {Pt} p */
export const Lp = (p) => L(p.x, p.y);
/** @param {Pt} a @param {Pt} b @param {Pt} p */
export const Cp = (a, b, p) => C(a.x, a.y, b.x, b.y, p.x, p.y);
/** @param {Pt} a @param {Pt} p */
export const Qp = (a, p) => Q(a.x, a.y, p.x, p.y);

/** An ellipse as a path (two arcs). @param {number} cx @param {number} cy @param {number} rx @param {number} ry */
export function ellipseD(cx, cy, rx, ry) {
  return `${M(cx - rx, cy)}${A(rx, ry, 0, 1, 0, cx + rx, cy)}${A(rx, ry, 0, 1, 0, cx - rx, cy)}Z`;
}

/** @param {number} cx @param {number} cy @param {number} r */
export function circleD(cx, cy, r) {
  return ellipseD(cx, cy, r, r);
}

/** @param {readonly Pt[]} points @param {boolean} [close] */
export function polyD(points, close = true) {
  return points.map((p, i) => (i === 0 ? Mp(p) : Lp(p))).join('') + (close ? Z : '');
}

/**
 * A closed Catmull-Rom spline through the points, as cubic Béziers.
 *
 * @param {readonly Pt[]} points
 * @param {number} [tension]
 */
export function smoothClosedD(points, tension = 1) {
  const n = points.length;
  if (n < 3) return polyD(points);
  let d = Mp(/** @type {Pt} */ (points[0]));
  for (let i = 0; i < n; i++) {
    const p0 = /** @type {Pt} */ (points[(i - 1 + n) % n]);
    const p1 = /** @type {Pt} */ (points[i]);
    const p2 = /** @type {Pt} */ (points[(i + 1) % n]);
    const p3 = /** @type {Pt} */ (points[(i + 2) % n]);
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += Cp(c1, c2, p2);
  }
  return d + Z;
}

/**
 * An open Catmull-Rom spline through the points.
 *
 * @param {readonly Pt[]} points
 * @param {number} [tension]
 */
export function smoothOpenD(points, tension = 1) {
  const n = points.length;
  if (n < 2) return '';
  let d = Mp(/** @type {Pt} */ (points[0]));
  for (let i = 0; i < n - 1; i++) {
    const p0 = /** @type {Pt} */ (points[Math.max(0, i - 1)]);
    const p1 = /** @type {Pt} */ (points[i]);
    const p2 = /** @type {Pt} */ (points[i + 1]);
    const p3 = /** @type {Pt} */ (points[Math.min(n - 1, i + 2)]);
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += Cp(c1, c2, p2);
  }
  return d;
}

/**
 * The corners of a star; `rot` is the angle of the first outer point (-90 points up).
 *
 * @param {number} cx @param {number} cy @param {number} n @param {number} rOuter
 * @param {number} rInner @param {number} [rot]
 * @returns {Pt[]}
 */
export function starPoints(cx, cy, n, rOuter, rInner, rot = -90) {
  /** @type {Pt[]} */
  const pts = [];
  for (let i = 0; i < n * 2; i++)
    pts.push(polar(cx, cy, i % 2 === 0 ? rOuter : rInner, rot + (i * 180) / n));
  return pts;
}

/**
 * A star with softly rounded tips and valleys.
 *
 * @param {number} cx @param {number} cy @param {number} n @param {number} rOuter
 * @param {number} rInner @param {number} [rot] @param {number} [roundness]
 */
export function roundStarD(cx, cy, n, rOuter, rInner, rot = -90, roundness = 0.18) {
  return roundCornersD(starPoints(cx, cy, n, rOuter, rInner, rot), roundness);
}

/**
 * A closed polygon whose corners are rounded by cutting `roundness` of each edge.
 *
 * @param {readonly Pt[]} pts
 * @param {number} roundness
 */
export function roundCornersD(pts, roundness) {
  const m = pts.length;
  let d = '';
  for (let i = 0; i < m; i++) {
    const prev = /** @type {Pt} */ (pts[(i - 1 + m) % m]);
    const cur = /** @type {Pt} */ (pts[i]);
    const next = /** @type {Pt} */ (pts[(i + 1) % m]);
    const a = { x: cur.x + (prev.x - cur.x) * roundness, y: cur.y + (prev.y - cur.y) * roundness };
    const b = { x: cur.x + (next.x - cur.x) * roundness, y: cur.y + (next.y - cur.y) * roundness };
    d += (i === 0 ? Mp(a) : Lp(a)) + Qp(cur, b);
  }
  return d + Z;
}

/**
 * A closed polygon with each corner rounded by `r` units (at most half an edge).
 *
 * @param {readonly Pt[]} points
 * @param {number} r
 */
export function roundPolyD(points, r) {
  const m = points.length;
  /** @param {Pt} from @param {Pt} to @returns {Pt} */
  const cut = (from, to) => {
    const len = dist(from, to);
    const k = Math.min(r, len / 2) / len;
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  };
  let d = '';
  for (let i = 0; i < m; i++) {
    const cur = /** @type {Pt} */ (points[i]);
    const a = cut(cur, /** @type {Pt} */ (points[(i - 1 + m) % m]));
    const b = cut(cur, /** @type {Pt} */ (points[(i + 1) % m]));
    d += (i === 0 ? Mp(a) : Lp(a)) + Qp(cur, b);
  }
  return d + Z;
}

/** @param {number} x @param {number} y @param {number} w @param {number} hgt @param {number} r */
export function roundRectD(x, y, w, hgt, r) {
  const rr = Math.min(r, w / 2, hgt / 2);
  return (
    M(x + rr, y) +
    L(x + w - rr, y) +
    Q(x + w, y, x + w, y + rr) +
    L(x + w, y + hgt - rr) +
    Q(x + w, y + hgt, x + w - rr, y + hgt) +
    L(x + rr, y + hgt) +
    Q(x, y + hgt, x, y + hgt - rr) +
    L(x, y + rr) +
    Q(x, y, x + rr, y) +
    Z
  );
}

/** A heart centred at (cx, cy), `w` wide. @param {number} cx @param {number} cy @param {number} w */
export function heartD(cx, cy, w) {
  const s = w / 2;
  return (
    M(cx, cy + s * 0.9) +
    C(cx - s * 0.2, cy + s * 0.72, cx - s, cy + s * 0.2, cx - s, cy - s * 0.3) +
    C(cx - s, cy - s * 0.85, cx - s * 0.2, cy - s, cx, cy - s * 0.45) +
    C(cx + s * 0.2, cy - s, cx + s, cy - s * 0.85, cx + s, cy - s * 0.3) +
    C(cx + s, cy + s * 0.2, cx + s * 0.2, cy + s * 0.72, cx, cy + s * 0.9) +
    Z
  );
}

/** An egg centred at (cx, cy): narrower top, fuller bottom. @param {number} cx @param {number} cy @param {number} w @param {number} hgt */
export function eggD(cx, cy, w, hgt) {
  const rx = w / 2;
  const top = cy - hgt / 2;
  const bot = cy + hgt / 2;
  const waist = cy + hgt * 0.1;
  return (
    M(cx, top) +
    C(cx + rx * 0.62, top, cx + rx, waist - hgt * 0.32, cx + rx, waist) +
    C(cx + rx, bot - hgt * 0.12, cx + rx * 0.56, bot, cx, bot) +
    C(cx - rx * 0.56, bot, cx - rx, bot - hgt * 0.12, cx - rx, waist) +
    C(cx - rx, waist - hgt * 0.32, cx - rx * 0.62, top, cx, top) +
    Z
  );
}

/**
 * A point on an ellipse at `deg`.
 *
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry @param {number} deg
 * @returns {Pt}
 */
export function ellipsePoint(cx, cy, rx, ry, deg) {
  const p = polar(0, 0, 1, deg);
  return { x: cx + p.x * rx, y: cy + p.y * ry };
}

/**
 * A ring of bumps around an ellipse (clouds, frills, a shell's rim).
 *
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry
 * @param {number} bumps @param {number} depth @param {number} [rot]
 */
export function scallopD(cx, cy, rx, ry, bumps, depth, rot = -90) {
  let d = '';
  for (let i = 0; i < bumps; i++) {
    const p0 = ellipsePoint(cx, cy, rx, ry, rot + (i * 360) / bumps);
    const pm = ellipsePoint(cx, cy, rx + depth, ry + depth, rot + ((i + 0.5) * 360) / bumps);
    const p1 = ellipsePoint(cx, cy, rx, ry, rot + ((i + 1) * 360) / bumps);
    const c = { x: 2 * pm.x - (p0.x + p1.x) / 2, y: 2 * pm.y - (p0.y + p1.y) / 2 };
    d += (i === 0 ? Mp(p0) : '') + Qp(c, p1);
  }
  return d + Z;
}

/**
 * A translate, rotate and scale transform (identity parts omitted).
 *
 * @param {number} x @param {number} y @param {number} [rot] @param {number} [sx] @param {number} [sy]
 */
export function tf(x, y, rot = 0, sx = 1, sy = sx) {
  let s = `translate(${f(x)} ${f(y)})`;
  if (rot !== 0) s += ` rotate(${f(rot)})`;
  if (sx !== 1 || sy !== 1) s += sx === sy ? ` scale(${f(sx)})` : ` scale(${f(sx)} ${f(sy)})`;
  return s;
}
