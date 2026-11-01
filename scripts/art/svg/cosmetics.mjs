// @ts-check
/**
 * Cosmetics (`cosmetic/<item>`) and the crowned stage's crown (`cosmetic/shell-crown`): 100 × 100
 * SVGs whose attachment point is the centre (50, 50), the contract's cosmetic anchor scale
 * (`COSMETIC_VIEWBOX`, media.ts): a hat's brim centre, the goggles' bridge, a scarf's knot, the
 * crown's base. Grotto decorations share the box and stand on their spot's centre.
 */
import { lighten } from './lib/color.mjs';
import {
  C,
  L,
  M,
  Q,
  Z,
  circleD,
  ellipseD,
  roundRectD,
  roundStarD,
  smoothOpenD,
} from './lib/path.mjs';
import { polar } from './lib/num.mjs';
import { g, h } from './lib/xml.mjs';
import { CREAM, INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from './style.mjs';

/** @typedef {'head' | 'eyes' | 'neck' | 'grotto' | 'crown'} CosmeticSlot */
/** @typedef {{ id: string; slot: CosmeticSlot; draw: () => string }} CosmeticDesign */

const SIZE = 100;

/**
 * A small scallop shell, hinge down, fan up: `w` wide at (cx, cy).
 *
 * @param {string} key @param {number} cx @param {number} cy @param {number} w
 * @param {string} color @param {number} [rot]
 */
function scallop(key, cx, cy, w, color, rot = 0) {
  const s = scope(key);
  const r = w / 2;
  const stroke = Math.min(SW * 0.8, w * 0.13);
  const fan =
    M(cx - r * 0.28, cy + r * 0.62) +
    C(cx - r * 1.05, cy + r * 0.2, cx - r * 1.02, cy - r * 0.62, cx - r * 0.5, cy - r * 0.86) +
    Q(cx, cy - r * 1.12, cx + r * 0.5, cy - r * 0.86) +
    C(cx + r * 1.02, cy - r * 0.62, cx + r * 1.05, cy + r * 0.2, cx + r * 0.28, cy + r * 0.62) +
    Z;
  const hinge = roundRectD(cx - r * 0.42, cy + r * 0.5, r * 0.84, r * 0.36, r * 0.12);
  const ribs = [-0.62, -0.31, 0, 0.31, 0.62]
    .map(
      (k) =>
        M(cx + k * r * 0.25, cy + r * 0.52) +
        Q(cx + k * r * 0.9, cy - r * 0.2, cx + k * r * 1.1, cy - r * 0.78),
    )
    .join('');
  return g(
    rot ? { transform: `rotate(${rot} ${cx} ${cy})` } : null,
    h('defs', null, shade(s.id('fan'), color, { light: 0.6, dark: 0.12 })),
    ink(hinge, lighten(color, 0.2), { 'stroke-width': stroke * 0.85 }),
    ink(fan, s.url('fan'), { 'stroke-width': stroke }),
    line(ribs, INK, stroke * 0.55, { opacity: 0.5 }),
  );
}

/** A pearl: a cream ball with a gleam. @param {number} cx @param {number} cy @param {number} r */
function pearl(cx, cy, r) {
  return (
    h('circle', { cx, cy, r, fill: '#fbf4ea', stroke: INK, 'stroke-width': SW * 0.55 }) +
    h('circle', {
      cx: cx - r * 0.35,
      cy: cy - r * 0.35,
      r: r * 0.32,
      fill: '#ffffff',
      opacity: 0.9,
    })
  );
}

// ---------------------------------------------------------------------------------------- head

function capSailor() {
  const s = scope('cap-sailor');
  const crown =
    M(24, 44) + C(21, 27, 34, 15, 50, 15) + C(66, 15, 79, 27, 76, 44) + Q(50, 49, 24, 44) + Z;
  const band = M(22.5, 36) + Q(50, 42, 77.5, 36) + L(77, 45) + Q(50, 51, 23, 45) + Z;
  const brim =
    M(12, 43) + Q(50, 54, 88, 43) + Q(91, 51, 84, 55) + Q(50, 64, 16, 55) + Q(9, 51, 12, 43) + Z;
  const anchor =
    circleD(50, 21.5, 2.2) +
    M(50, 23.7) +
    L(50, 32.5) +
    M(45.5, 26.5) +
    L(54.5, 26.5) +
    M(44.5, 29.5) +
    Q(45.5, 34, 50, 33.5) +
    Q(54.5, 34, 55.5, 29.5);
  return (
    h(
      'defs',
      null,
      shade(s.id('white'), '#f4f1ea', { light: 0.6, dark: 0.22 }),
      shade(s.id('navy'), '#2b4f86'),
    ) +
    ink(crown, s.url('white')) +
    ink(band, s.url('navy')) +
    line(anchor, '#e9b440', 2.2) +
    ink(brim, s.url('white')) +
    gleam(M(17, 47) + Q(30, 52, 42, 53)) +
    gleam(M(30, 26) + Q(36, 19, 44, 18), 2) +
    h('circle', { cx: 50, cy: 10, r: 6.5, fill: '#e8484f', stroke: INK, 'stroke-width': SW }) +
    h('circle', { cx: 48, cy: 8, r: 2, fill: CREAM, opacity: 0.8 })
  );
}

function hatStraw() {
  const s = scope('hat-straw');
  const brim = ellipseD(50, 52, 47, 13);
  const crown =
    M(30, 51) + C(29, 28, 39, 19, 50, 19) + C(61, 19, 71, 28, 70, 51) + Q(50, 56, 30, 51) + Z;
  const band = M(30.2, 42) + Q(50, 47, 69.8, 42) + L(70, 50) + Q(50, 55, 30, 50) + Z;
  const weave = [26, 33, 40]
    .map((y) => M(50 - (y - 14) * 0.62, y) + Q(50, y + 3.5, 50 + (y - 14) * 0.62, y))
    .join('');
  const rings = ellipseD(50, 53, 39, 9.5) + ellipseD(50, 53.5, 31, 7);
  return (
    h(
      'defs',
      null,
      shade(s.id('straw'), '#f0c766', { light: 0.55, dark: 0.2 }),
      shade(s.id('band'), '#ff7f6e'),
    ) +
    ink(brim, s.url('straw')) +
    line(rings, '#c8913c', 1.3, { opacity: 0.6 }) +
    ink(crown, s.url('straw')) +
    line(weave, '#c8913c', 1.3, { opacity: 0.7 }) +
    ink(band, s.url('band')) +
    g(
      { transform: 'translate(64 46) rotate(-12)' },
      ink(roundStarD(0, 0, 5, 7.5, 3.4, -90, 0.22), '#ffd166', { 'stroke-width': SW * 0.7 }),
    ) +
    gleam(M(9, 50) + Q(14, 44, 26, 42)) +
    gleam(M(36, 28) + Q(40, 22, 47, 21), 2)
  );
}

function headbandCoral() {
  const s = scope('headband-coral');
  const band = M(9, 60) + Q(50, 36, 91, 60);
  /** @type {[number, number, number][]} */
  const sprigs = [
    [30, 50.5, -14],
    [50, 48, 0],
    [70, 50.5, 14],
  ];
  const branches = sprigs
    .map(([x, y, tilt], i) => {
      const tall = i === 1 ? 32 : 25;
      const top = polar(x, y, tall, -90 + tilt);
      const left = polar(x, y - tall * 0.45, tall * 0.5, -132 + tilt);
      const right = polar(x, y - tall * 0.6, tall * 0.42, -50 + tilt);
      return (
        smoothOpenD([{ x, y }, polar(x, y, tall * 0.5, -90 + tilt * 0.6), top], 1) +
        smoothOpenD([polar(x, y, tall * 0.45, -90 + tilt), left], 1) +
        smoothOpenD([polar(x, y, tall * 0.6, -90 + tilt), right], 1)
      );
    })
    .join('');
  const tips = sprigs.flatMap(([x, y, tilt], i) => {
    const tall = i === 1 ? 32 : 25;
    return [
      polar(x, y, tall, -90 + tilt),
      polar(x, y - tall * 0.45, tall * 0.5, -132 + tilt),
      polar(x, y - tall * 0.6, tall * 0.42, -50 + tilt),
    ];
  });
  return (
    h('defs', null, shade(s.id('band'), '#ff6f91')) +
    tube(branches, '#ff9775', 5.2) +
    tips
      .map((p) =>
        h('circle', {
          cx: p.x,
          cy: p.y,
          r: 3.4,
          fill: '#ffb39a',
          stroke: INK,
          'stroke-width': SW * 0.6,
        }),
      )
      .join('') +
    tube(band, '#ff6f91', 8.5) +
    gleam(M(18, 53) + Q(32, 44, 44, 42), 2, 0.75) +
    pearl(39.5, 46.5, 2.6) +
    pearl(60.5, 46.5, 2.6)
  );
}

// ---------------------------------------------------------------------------------------- eyes

function gogglesDiving() {
  const s = scope('goggles-diving');
  const strap = M(1, 53) + Q(50, 42, 99, 53);
  const frame = ellipseD(29, 50, 19, 16) + ellipseD(71, 50, 19, 16);
  const lens = (/** @type {number} */ cx) => ellipseD(cx, 50, 13.5, 10.5);
  return (
    h(
      'defs',
      null,
      shade(s.id('frame'), '#ffcf3f', { light: 0.5 }),
      shade(s.id('glass'), '#56c7dd', { light: 0.7, dark: 0.1 }),
    ) +
    tube(strap, '#ff8c42', 5) +
    ink(frame, s.url('frame')) +
    ink(roundRectD(44, 45.5, 12, 9, 3), s.url('frame')) +
    ink(lens(29), s.url('glass')) +
    ink(lens(71), s.url('glass')) +
    gleam(M(20, 47) + Q(22, 42.5, 27, 42), 2.6) +
    gleam(M(62, 47) + Q(64, 42.5, 69, 42), 2.6) +
    gleam(M(33, 56) + L(35.5, 54), 1.8, 0.6) +
    gleam(M(75, 56) + L(77.5, 54), 1.8, 0.6)
  );
}

function glassesSun() {
  const s = scope('glasses-sun');
  const lens = (/** @type {number} */ cx) => roundRectD(cx - 16, 39, 32, 23, 10);
  return (
    h(
      'defs',
      null,
      shade(s.id('lens'), '#2a7f96', { light: 0.35, dark: 0.3 }),
      shade(s.id('frame'), '#ff6b8f'),
    ) +
    tube(M(13, 45) + L(3, 42.5), '#ff6b8f', 3.4) +
    tube(M(87, 45) + L(97, 42.5), '#ff6b8f', 3.4) +
    tube(M(44.5, 46) + Q(50, 40.5, 55.5, 46), '#ff6b8f', 3.6) +
    ink(lens(29), s.url('frame'), { 'stroke-width': SW }) +
    ink(lens(71), s.url('frame'), { 'stroke-width': SW }) +
    h('path', {
      d: roundRectD(16.5, 42.5, 25, 16, 7) + roundRectD(58.5, 42.5, 25, 16, 7),
      fill: s.url('lens'),
    }) +
    gleam(M(20, 50) + L(26, 45.5), 2.4) +
    gleam(M(62, 50) + L(68, 45.5), 2.4) +
    gleam(M(25, 53) + L(28, 51), 1.6, 0.6) +
    gleam(M(67, 53) + L(70, 51), 1.6, 0.6)
  );
}

// ---------------------------------------------------------------------------------------- neck

/**
 * A scarf: the wrap round the neck, the knot at the centre and two hanging tails, filled by
 * `pattern` (drawn under a clip of the scarf's shape).
 *
 * @param {string} key
 * @param {string} base
 * @param {(clip: string) => string} pattern
 */
function scarf(key, base, pattern) {
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

function scarfStripes() {
  const colors = ['#ff7a59', '#fff1d6', '#2bb3c0', '#fff1d6'];
  return scarf('scarf-stripes', '#ff7a59', () =>
    Array.from({ length: 18 }, (_, i) =>
      h('rect', {
        x: -10 + i * 7,
        y: -10,
        width: 7,
        height: 130,
        fill: colors[i % 4],
        transform: 'rotate(18 50 50)',
      }),
    ).join(''),
  );
}

function scarfWaves() {
  return scarf('scarf-waves', '#2f86d6', () =>
    Array.from({ length: 8 }, (_, i) => {
      const y = 28 + i * 9;
      let d = M(-4, y);
      for (let x = -4; x < 104; x += 12)
        d += Q(x + 3, y - 4.5, x + 6, y) + Q(x + 9, y + 4.5, x + 12, y);
      return line(d, i % 2 ? '#bfe9ff' : '#ffffff', 2.2, { opacity: 0.9 });
    }).join(''),
  );
}

function bowShell() {
  const s = scope('bow-shell');
  const wing = (/** @type {number} */ k) =>
    M(50, 50) +
    C(50 - 9 * k, 38, 50 - 30 * k, 27, 50 - 37 * k, 35) +
    C(50 - 42 * k, 41, 50 - 42 * k, 59, 50 - 37 * k, 65) +
    C(50 - 30 * k, 73, 50 - 9 * k, 62, 50, 50) +
    Z;
  const folds = (/** @type {number} */ k) =>
    M(50 - 12 * k, 47) +
    Q(50 - 22 * k, 44, 50 - 28 * k, 41) +
    M(50 - 12 * k, 53) +
    Q(50 - 22 * k, 57, 50 - 28 * k, 60);
  return (
    h('defs', null, shade(s.id('silk'), '#ff8fbd')) +
    ink(wing(1), s.url('silk')) +
    ink(wing(-1), s.url('silk')) +
    line(folds(1) + folds(-1), INK, 1.6, { opacity: 0.5 }) +
    gleam(M(17, 41) + Q(20, 35, 27, 33), 2.2) +
    gleam(M(63, 35) + Q(68, 33, 72, 35), 2) +
    scallop('bow-shell-knot', 50, 50.5, 19, '#fff0e3')
  );
}

function necklaceShells() {
  const p0 = { x: 6, y: 24 };
  const p1 = { x: 50, y: 72 };
  const p2 = { x: 94, y: 24 };
  /** @param {number} t */
  const at = (t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });
  /** @type {[number, number, string][]} */
  const shells = [
    [0.2, 12, '#ffd6c9'],
    [0.35, 13, '#fff4e4'],
    [0.5, 17, '#ffb09c'],
    [0.65, 13, '#fff4e4'],
    [0.8, 12, '#ffd6c9'],
  ];
  return (
    line(M(p0.x, p0.y) + Q(p1.x, p1.y, p2.x, p2.y), INK, 3.2) +
    line(M(p0.x, p0.y) + Q(p1.x, p1.y, p2.x, p2.y), '#e2b273', 1.6) +
    [0.08, 0.92].map((t) => pearl(at(t).x, at(t).y, 2.4)).join('') +
    shells
      .map(([t, w, color], i) => {
        const p = at(t);
        return scallop(`necklace-shells-${i}`, p.x, p.y + w * 0.42, w, color, 180);
      })
      .join('')
  );
}

// ---------------------------------------------------------------------------------------- grotto

function lampAnemone() {
  const s = scope('lamp-anemone');
  const tentacles = Array.from({ length: 9 }, (_, i) => {
    const a = -165 + i * 18.75;
    const base = polar(50, 54, 9, a);
    const tip = polar(50, 50, 31, a);
    const bend = polar(50, 52, 22, a + (i % 2 ? 9 : -9));
    return { d: smoothOpenD([base, bend, tip], 1), tip };
  });
  return (
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: s.id('glow'), cx: 0.5, cy: 0.5, r: 0.5 },
        h('stop', { offset: 0, 'stop-color': '#fff6b0', 'stop-opacity': 0.95 }),
        h('stop', { offset: 0.5, 'stop-color': '#ffe27a', 'stop-opacity': 0.45 }),
        h('stop', { offset: 1, 'stop-color': '#ffe27a', 'stop-opacity': 0 }),
      ),
      shade(s.id('rock'), '#8e7cb0', { light: 0.35 }),
      shade(s.id('body'), '#ff8aa1'),
      shade(s.id('bulb'), '#fff3a6', { light: 0.8, dark: 0.05 }),
    ) +
    groundShadow(50, 94, 30, 4) +
    h('circle', { cx: 50, cy: 46, r: 40, fill: s.url('glow') }) +
    ink(
      M(20, 92) + C(18, 80, 30, 75, 50, 76) + C(70, 75, 82, 80, 80, 92) + Q(50, 96, 20, 92) + Z,
      s.url('rock'),
    ) +
    ink(
      M(44, 78) + C(43, 70, 42, 64, 41, 58) + L(59, 58) + C(58, 64, 57, 70, 56, 78) + Z,
      '#3dbfae',
    ) +
    tentacles.map((t) => tube(t.d, '#ff8aa1', 4.6)).join('') +
    tentacles
      .map((t) =>
        h('circle', {
          cx: t.tip.x,
          cy: t.tip.y,
          r: 3.2,
          fill: '#fff4b8',
          stroke: INK,
          'stroke-width': SW * 0.55,
        }),
      )
      .join('') +
    ink(ellipseD(50, 57, 14, 7), s.url('body')) +
    ink(circleD(50, 49, 9.5), s.url('bulb')) +
    gleam(M(45, 46) + Q(46, 43, 49, 42.5), 2) +
    gleam(M(26, 84) + Q(31, 80, 38, 79), 2, 0.6)
  );
}

function swingShell() {
  const s = scope('swing-shell');
  const rope = (/** @type {number} */ x0, /** @type {number} */ x1) => M(x0, 0) + L(x1, 62);
  const twist = (/** @type {number} */ x0, /** @type {number} */ x1) =>
    Array.from({ length: 9 }, (_, i) => {
      const t = (i + 0.5) / 9;
      const x = x0 + (x1 - x0) * t;
      const y = 62 * t;
      return M(x - 1.6, y - 1.2) + L(x + 1.6, y + 1.2);
    }).join('');
  const seat =
    M(22, 64) +
    Q(50, 54, 78, 64) +
    C(80, 72, 70, 82, 56, 84) +
    L(44, 84) +
    C(30, 82, 20, 72, 22, 64) +
    Z;
  const ribs = [30, 38, 46, 54, 62, 70]
    .map(
      (x) =>
        M(x, 61.5 + Math.abs(x - 50) * 0.05) + Q(x + (x - 50) * 0.1, 74, 50 + (x - 50) * 0.55, 83),
    )
    .join('');
  return (
    h('defs', null, shade(s.id('shell'), '#ffb59c', { light: 0.6 })) +
    tube(rope(28, 26) + rope(72, 74), '#c48a4c', 3.2) +
    line(twist(28, 26) + twist(72, 74), INK, 1, { opacity: 0.5 }) +
    ink(seat, s.url('shell')) +
    line(ribs, INK, 1.4, { opacity: 0.45 }) +
    ink(roundRectD(42, 82, 16, 6, 2.5), '#ffd2c2') +
    gleam(M(28, 65) + Q(36, 60.5, 46, 59.5), 2.2) +
    pearl(26, 62, 3.2) +
    pearl(74, 62, 3.2)
  );
}

// ---------------------------------------------------------------------------------------- crown

function shellCrown() {
  const s = scope('shell-crown');
  const xs = [14, 32, 50, 68, 86];
  const tops = [21, 16, 9, 16, 21];
  let d = M(16, 50) + L(14, 38);
  for (let i = 0; i < xs.length; i++) {
    const x = /** @type {number} */ (xs[i]);
    const y = /** @type {number} */ (tops[i]);
    if (i > 0) d += Q(x - 9, 36, x - 3.5, y + 7);
    d += Q(x, y - 1.5, x + (i === xs.length - 1 ? 0 : 3.5), y + (i === xs.length - 1 ? 0 : 7));
  }
  d += L(86, 38) + L(84, 50) + Q(50, 54, 16, 50) + Z;
  const band = M(15.5, 41) + Q(50, 46, 84.5, 41) + L(84, 50) + Q(50, 54, 16, 50) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('gold'), '#f6c445', { light: 0.6, dark: 0.22 }),
      shade(s.id('band'), '#e9a92a'),
    ) +
    ink(d, s.url('gold')) +
    ink(band, s.url('band')) +
    xs.map((x, i) => pearl(x, /** @type {number} */ (tops[i]) - 1, i === 2 ? 4.4 : 3.6)).join('') +
    h('circle', {
      cx: 31,
      cy: 46.5,
      r: 2.6,
      fill: '#3cc6c9',
      stroke: INK,
      'stroke-width': SW * 0.5,
    }) +
    h('circle', {
      cx: 69,
      cy: 46.5,
      r: 2.6,
      fill: '#3cc6c9',
      stroke: INK,
      'stroke-width': SW * 0.5,
    }) +
    scallop('shell-crown-front', 50, 37, 20, '#ff9f8c') +
    gleam(M(19, 43) + Q(24, 45, 29, 45.5), 1.8, 0.7) +
    gleam(M(36, 28) + Q(38, 22, 42, 20), 1.8, 0.7)
  );
}

/** @type {readonly CosmeticDesign[]} */
export const COSMETIC_DESIGNS = [
  { id: 'cap-sailor', slot: 'head', draw: capSailor },
  { id: 'hat-straw', slot: 'head', draw: hatStraw },
  { id: 'headband-coral', slot: 'head', draw: headbandCoral },
  { id: 'goggles-diving', slot: 'eyes', draw: gogglesDiving },
  { id: 'glasses-sun', slot: 'eyes', draw: glassesSun },
  { id: 'scarf-stripes', slot: 'neck', draw: scarfStripes },
  { id: 'scarf-waves', slot: 'neck', draw: scarfWaves },
  { id: 'bow-shell', slot: 'neck', draw: bowShell },
  { id: 'necklace-shells', slot: 'neck', draw: necklaceShells },
  { id: 'lamp-anemone', slot: 'grotto', draw: lampAnemone },
  { id: 'swing-shell', slot: 'grotto', draw: swingShell },
  { id: 'shell-crown', slot: 'crown', draw: shellCrown },
];

export const COSMETIC_SIZE = SIZE;
