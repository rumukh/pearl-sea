// @ts-check
/**
 * Deterministic numbers for the SVG generator (docs/assets.md §7): trigonometry from
 * `@aegis/core/math`, never the platform's `Math.sin` family, and coordinates printed with at most
 * two decimals, so every OS writes the same bytes.
 */
import { atan2, cos, sin, sqrt } from '@aegis/core/math';

export const PI = 3.141592653589793;

/**
 * A coordinate with at most two decimals: never `-0`, never exponent notation.
 *
 * @param {number} n
 */
export function f(n) {
  if (!Number.isFinite(n)) throw new Error(`Non-finite SVG number: ${n}`);
  const r = Math.round(n * 100) / 100;
  return r === 0 ? '0' : String(r);
}

/** @param {number} deg */
export function sinDeg(deg) {
  return sin((deg * PI) / 180);
}

/** @param {number} deg */
export function cosDeg(deg) {
  return cos((deg * PI) / 180);
}

/**
 * @param {number} y
 * @param {number} x
 */
export function atan2Deg(y, x) {
  return (atan2(y, x) * 180) / PI;
}

/** @typedef {{ x: number; y: number }} Pt */

/**
 * A point on a circle: 0° points right and 90° down (SVG orientation).
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} deg
 * @returns {Pt}
 */
export function polar(cx, cy, r, deg) {
  return { x: cx + r * cosDeg(deg), y: cy + r * sinDeg(deg) };
}

/**
 * @param {Pt} a
 * @param {Pt} b
 */
export function dist(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return sqrt(dx * dx + dy * dy);
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * @param {Pt} a
 * @param {Pt} b
 * @param {number} [t]
 * @returns {Pt}
 */
export function mid(a, b, t = 0.5) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/**
 * Rotates `p` about `c` by `deg`.
 *
 * @param {Pt} p
 * @param {Pt} c
 * @param {number} deg
 * @returns {Pt}
 */
export function rotate(p, c, deg) {
  const s = sinDeg(deg);
  const k = cosDeg(deg);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k };
}

/**
 * A small deterministic generator (mulberry32) for scattered details such as speckles.
 *
 * @param {number} seed
 * @returns {() => number} numbers in [0, 1)
 */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
