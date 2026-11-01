// @ts-check
/**
 * The look shared by every static SVG (docs/art.md §9): the paintings' deep plum outline, never
 * black; shading lit from the top left, as in the paintings; cream highlights; round caps and
 * joins.
 */
import { darken, lighten } from './lib/color.mjs';
import { h } from './lib/xml.mjs';

/** The outline: the paintings' plum-wine (their outline band measures about #55002c). */
export const INK = '#5a1232';
/** The outline width in a 100-unit box. */
export const SW = 3;
export const CREAM = '#fff7e4';

/** @typedef {import('./lib/xml.mjs').Attrs} Attrs */

/**
 * IDs scoped to one file, so that pages which inline several SVGs never collide.
 *
 * @param {string} prefix
 */
export function scope(prefix) {
  return {
    /** @param {string} name */
    id: (name) => `${prefix}-${name}`,
    /** @param {string} name */
    url: (name) => `url(#${prefix}-${name})`,
  };
}

/**
 * A radial gradient lit from the top left: light, the colour, then a plum-tinted shade.
 *
 * @param {string} id
 * @param {string} base
 * @param {{ light?: number; dark?: number; cx?: number; cy?: number; r?: number }} [options]
 */
export function shade(id, base, options = {}) {
  const { light = 0.5, dark = 0.18, cx = 0.34, cy = 0.28, r = 0.9 } = options;
  return h(
    'radialGradient',
    { id, cx, cy, r, fx: cx, fy: cy },
    h('stop', { offset: 0, 'stop-color': lighten(base, light) }),
    h('stop', { offset: 0.55, 'stop-color': base }),
    h('stop', { offset: 1, 'stop-color': darken(base, dark) }),
  );
}

/**
 * A filled shape with the plum outline.
 *
 * @param {string} d
 * @param {string} fill
 * @param {Attrs} [extra]
 */
export function ink(d, fill, extra = {}) {
  return h('path', {
    d,
    fill,
    stroke: INK,
    'stroke-width': SW,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
    ...extra,
  });
}

/**
 * A stroke without a fill.
 *
 * @param {string} d
 * @param {string} color
 * @param {number} width
 * @param {Attrs} [extra]
 */
export function line(d, color, width, extra = {}) {
  return h('path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': width,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
    ...extra,
  });
}

/**
 * A thick outlined stroke (a rope, a coral branch, a strap): the outline, then the colour.
 *
 * @param {string} d
 * @param {string} color
 * @param {number} width
 */
export function tube(d, color, width) {
  return line(d, INK, width + SW * 1.6) + line(d, color, width);
}

/**
 * A soft cream highlight stroke.
 *
 * @param {string} d
 * @param {number} [width]
 * @param {number} [opacity]
 */
export function gleam(d, width = 2.4, opacity = 0.85) {
  return line(d, CREAM, width, { opacity });
}

/**
 * A soft plum shadow under an object.
 *
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry
 */
export function groundShadow(cx, cy, rx, ry) {
  return h('ellipse', { cx, cy, rx, ry, fill: INK, opacity: 0.16 });
}
