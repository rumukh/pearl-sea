// @ts-check
/** The shared scarf shape of the neck cosmetics (cosmetics.mjs and the region modules). */
import { L, M, Q, Z, roundRectD } from './lib/path.mjs';
import { g, h } from './lib/xml.mjs';
import { INK, gleam, ink, line, scope, shade } from './style.mjs';

/**
 * A scarf: the wrap round the neck, the knot at the centre and two hanging tails, filled by
 * `pattern` (drawn under a clip of the scarf's shape).
 *
 * @param {string} key
 * @param {string} base
 * @param {(clip: string) => string} pattern
 */
export function scarf(key, base, pattern) {
  const s = scope(key);
  const wrap = M(5, 33) + Q(50, 54, 95, 33) + L(94, 46) + Q(50, 67, 6, 46) + Z;
  const tailA = M(43, 54) + Q(40, 72, 31, 90) + L(44, 94) + Q(50, 74, 52, 56) + Z;
  const tailB = M(52, 55) + Q(58, 70, 60, 87) + L(72, 84) + Q(64, 68, 58, 53) + Z;
  const knot = roundRectD(42.5, 43, 15, 14, 5.5);
  const fringe = (
    /** @type {number} */ x0,
    /** @type {number} */ y0,
    /** @type {number} */ x1,
    /** @type {number} */ y1,
  ) =>
    [0.15, 0.38, 0.62, 0.85]
      .map((t) => {
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        return M(x, y) + L(x - 0.6, y + 5.5);
      })
      .join('');
  const pieces = [wrap, tailB, tailA, knot];
  return (
    h(
      'defs',
      null,
      shade(s.id('shade'), base, { light: 0.25, dark: 0.25 }),
      ...pieces.map((d, i) => h('clipPath', { id: s.id(`c${i}`) }, h('path', { d }))),
    ) +
    pieces
      .map(
        (d, i) =>
          h('path', { d, fill: base }) +
          g({ 'clip-path': s.url(`c${i}`) }, pattern(s.id(`c${i}`))) +
          h('path', { d, fill: s.url('shade'), opacity: 0.45 }) +
          ink(d, 'none'),
      )
      .join('') +
    line(fringe(31.5, 90, 44, 94) + fringe(60, 87, 72, 84), INK, 1.8) +
    gleam(M(12, 38) + Q(26, 45, 36, 47), 2, 0.6)
  );
}
