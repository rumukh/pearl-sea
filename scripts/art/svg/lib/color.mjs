// @ts-check
/** Colour math on `#rrggbb` strings, in sRGB (ported from Dragon Valley). */

const HEX = /^#[0-9a-f]{6}$/;

/** @typedef {{ r: number; g: number; b: number }} Rgb */

/** @param {string} hex @returns {Rgb} */
export function parseHex(hex) {
  if (!HEX.test(hex)) throw new Error(`Invalid colour: ${hex}`);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** @param {number} n */
function hex2(n) {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return (v < 16 ? '0' : '') + v.toString(16);
}

/** @param {Rgb} c */
export function toHex(c) {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

/**
 * A linear mix: `t` 0 gives `a`, 1 gives `b`.
 *
 * @param {string} a @param {string} b @param {number} t
 */
export function mix(a, b, t) {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** Highlights lean to warm cream, as the paintings' do. */
export const CREAM = '#fff7e4';
/** Shadows lean to the paintings' deep plum, never grey. */
export const PLUM_DARK = '#2b0a1d';

/** @param {string} c @param {number} t */
export function lighten(c, t) {
  return mix(c, CREAM, t);
}

/** @param {string} c @param {number} t */
export function darken(c, t) {
  return mix(c, PLUM_DARK, t);
}
