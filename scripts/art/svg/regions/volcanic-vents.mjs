// @ts-check
/**
 * Sopečné prameny (region 6): the egg of Kalmar Desetiruký, the region's sticker icons and its
 * cosmetics (docs/art.md §9). Kalmar's egg carries his memory hook: ten little arms round the
 * bottom of the shell.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { g, h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const KALMAR = '#dc78aa';
const EEL = '#5fb4d6';
const FLAME = '#ff8a3c';
const FLAME_CORE = '#ffd45c';
const ROCK = '#5a5060';

/**
 * A rounded flame standing on (x, y), `size` tall.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} size
 */
function flameD(x, y, size) {
  const w = size * 0.42;
  return (
    M(x, y) +
    C(x - w, y, x - w * 1.05, y - size * 0.45, x - w * 0.35, y - size * 0.62) +
    Q(x - w * 0.2, y - size * 0.45, x, y - size * 0.5) +
    C(x - w * 0.1, y - size * 0.8, x + w * 0.3, y - size * 0.9, x + w * 0.1, y - size) +
    C(x + w * 1.1, y - size * 0.6, x + w * 1.05, y, x, y) +
    Z
  );
}

/**
 * A flame with its yellow core.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {number} [stroke]
 */
function flame(x, y, size, stroke = SW * 0.5) {
  return (
    ink(flameD(x, y, size), FLAME, { 'stroke-width': stroke }) +
    h('path', { d: flameD(x, y - size * 0.06, size * 0.55), fill: FLAME_CORE })
  );
}

// ------------------------------------------------------------------------------------------- eggs

/** Kalmar Desetiruký: rosy pink-purple, pale spots and ten little arms round the bottom. */
function eggKalmar() {
  const arms = Array.from({ length: 10 }, (_, i) => {
    const x = 6 + i * 12;
    return M(x, 160) + L(x, 130) + Q(x + 6, 118, x + 12, 130) + L(x + 12, 160) + Z;
  }).join('');
  /** @type {[number, number, number][]} */
  const spots = [
    [44, 40, 5],
    [70, 52, 6],
    [52, 72, 4.5],
    [80, 86, 4],
  ];
  return (
    ink(arms, lighten(KALMAR, 0.18), { 'stroke-width': SW * 0.55 }) +
    Array.from({ length: 10 }, (_, i) =>
      h('circle', { cx: 12 + i * 12, cy: 142, r: 1.8, fill: '#fde0ee' }),
    ).join('') +
    spots.map(([x, y, r]) => h('circle', { cx: x, cy: y, r, fill: '#fbd0e4' })).join('')
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const VOLCANIC_VENTS_EGGS = [{ id: 'kalmar-desetiruky', base: KALMAR, motif: eggKalmar }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

/**
 * A squid facing the viewer: mantle up, `arms` arms fanned below.
 *
 * @param {string} key
 * @param {number} arms
 * @param {readonly string[]} tips
 */
function squid(key, arms, tips) {
  const s = scope(key);
  const mantle = M(50, 14) + C(60, 20, 64, 36, 64, 54) + L(36, 54) + C(36, 36, 40, 20, 50, 14) + Z;
  const fins = M(40, 26) + L(28, 20) + L(38, 34) + Z + M(60, 26) + L(72, 20) + L(62, 34) + Z;
  const armD = Array.from({ length: arms }, (_, i) => {
    const t = (i - (arms - 1) / 2) / ((arms - 1) / 2);
    const base = { x: 50 + t * 10, y: 58 };
    const tip = { x: 50 + t * 30, y: 84 - Math.abs(t) * 8 };
    return { d: M(base.x, base.y) + Q(50 + t * 22, 70, tip.x, tip.y), tip };
  });
  return (
    h('defs', null, shade(s.id('body'), KALMAR, { light: 0.45, dark: 0.18 })) +
    armD.map((a) => tube(a.d, KALMAR, 3.6)).join('') +
    armD
      .map((a, i) =>
        ink(circleD(a.tip.x, a.tip.y, 2.6), tips[i % tips.length] ?? '#ffffff', {
          'stroke-width': SW * 0.35,
        }),
      )
      .join('') +
    ink(fins, darken(KALMAR, 0.08)) +
    ink(mantle, s.url('body')) +
    ink(ellipseD(50, 58, 15, 7), s.url('body')) +
    h('circle', { cx: 44, cy: 48, r: 4, fill: '#ffffff', stroke: INK, 'stroke-width': SW * 0.4 }) +
    h('circle', { cx: 56, cy: 48, r: 4, fill: '#ffffff', stroke: INK, 'stroke-width': SW * 0.4 }) +
    h('circle', { cx: 44.4, cy: 48.6, r: 2.2, fill: INK }) +
    h('circle', { cx: 56.4, cy: 48.6, r: 2.2, fill: INK }) +
    line(M(47, 56) + Q(50, 58.5, 53, 56), INK, SW * 0.4) +
    h('circle', { cx: 48, cy: 30, r: 1.8, fill: '#fbd0e4' }) +
    h('circle', { cx: 53, cy: 38, r: 1.4, fill: '#fbd0e4' }) +
    gleam(M(42, 28) + Q(44, 22, 48, 19), 1.6)
  );
}

function stickerSquid() {
  return squid('sticker-squid', 10, ['#fbd0e4']) + sparkle(78, 22, 5);
}

function stickerTenArms() {
  return squid('sticker-ten-arms', 10, [
    '#ff6b6b',
    '#ffa94d',
    '#ffd43b',
    '#69db7c',
    '#38d9a9',
    '#4dabf7',
    '#748ffc',
    '#b197fc',
    '#f783ac',
    '#ffffff',
  ]);
}

function stickerCoolEel() {
  const s = scope('sticker-cool-eel');
  const body =
    M(20, 50) +
    C(20, 40, 34, 36, 44, 42) +
    C(54, 48, 62, 62, 74, 58) +
    C(82, 56, 84, 48, 80, 42) +
    C(88, 48, 88, 62, 76, 68) +
    C(62, 74, 50, 60, 42, 54) +
    C(34, 48, 26, 58, 20, 50) +
    Z;
  const flake = [0, 60, 120]
    .map((a) => {
      const p = polar(68, 30, 8, a);
      const q = polar(68, 30, 8, a + 180);
      return M(p.x, p.y) + L(q.x, q.y);
    })
    .join('');
  return g(
    { transform: 'translate(50 50) scale(0.9) translate(-50 -50)' },
    h('defs', null, shade(s.id('eel'), EEL, { light: 0.45, dark: 0.18 })) +
      ink(body, s.url('eel')) +
      line(M(36, 41) + C(46, 44, 56, 56, 70, 58), lighten(EEL, 0.45), 1.6) +
      h('circle', {
        cx: 28,
        cy: 46,
        r: 3.2,
        fill: '#ffffff',
        stroke: INK,
        'stroke-width': SW * 0.4,
      }) +
      h('circle', { cx: 27.4, cy: 46.6, r: 1.8, fill: INK }) +
      line(M(21, 52) + Q(24, 54, 27, 52.5), INK, SW * 0.4) +
      h('ellipse', { cx: 33, cy: 52, rx: 3, ry: 2, fill: '#ff9db0', opacity: 0.8 }) +
      line(flake, INK, 4.4) +
      line(flake, '#e6f6ff', 2.4) +
      ink(circleD(68, 30, 2.4), '#bfe9ff', { 'stroke-width': SW * 0.35 }) +
      sparkle(84, 74, 4),
  );
}

function stickerFlameRow() {
  return (
    /** @type {[number, number, number][]} */ ([
      [22, 66, 22],
      [36, 64, 26],
      [50, 62, 30],
      [64, 64, 26],
      [78, 66, 22],
    ])
      .map(([x, y, size]) => flame(x, y, size))
      .join('') + ink(roundRectD(16, 66, 68, 8, 4), ROCK, { 'stroke-width': SW * 0.6 })
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const VOLCANIC_VENTS_STICKERS = [
  { id: 'squid', draw: stickerSquid },
  { id: 'cool-eel', draw: stickerCoolEel },
  { id: 'ten-arms', draw: stickerTenArms },
  { id: 'flame-row', draw: stickerFlameRow },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A red cap with a peak to the right and three flames painted on; the brim centre is (50, 50). */
function capFlames() {
  const s = scope('cap-flames');
  const crown =
    M(24, 50) + C(24, 30, 36, 22, 50, 22) + C(64, 22, 76, 30, 76, 50) + Q(50, 54, 24, 50) + Z;
  const peak = M(66, 48) + Q(84, 44, 94, 52) + Q(86, 58, 70, 55) + Z;
  return (
    h('defs', null, shade(s.id('cap'), '#e8513f', { light: 0.4, dark: 0.22 })) +
    ink(peak, darken('#e8513f', 0.15)) +
    ink(crown, s.url('cap')) +
    flame(38, 48, 16, SW * 0.4) +
    flame(50, 48, 20, SW * 0.4) +
    flame(62, 48, 16, SW * 0.4) +
    ink(circleD(50, 22, 3), '#ffd166', { 'stroke-width': SW * 0.45 }) +
    gleam(M(30, 38) + Q(33, 30, 40, 26), 2)
  );
}

/** Brass steam goggles with round smoky-blue lenses; the bridge is (50, 50). */
function gogglesSteam() {
  const s = scope('goggles-steam');
  const rivets = (/** @type {number} */ cx) =>
    [0, 90, 180, 270]
      .map((a) => {
        const p = polar(cx, 50, 14.5, a + 45);
        return h('circle', { cx: p.x, cy: p.y, r: 1.3, fill: INK });
      })
      .join('');
  return (
    h(
      'defs',
      null,
      shade(s.id('brass'), '#d9a441', { light: 0.5, dark: 0.25 }),
      shade(s.id('lens'), '#6fa8c8', { light: 0.5, dark: 0.25 }),
    ) +
    tube(M(12, 50) + L(3, 47), '#6b4a34', 4.4) +
    tube(M(88, 50) + L(97, 47), '#6b4a34', 4.4) +
    tube(M(44, 50) + L(56, 50), '#d9a441', 4) +
    ink(circleD(29, 50, 17), s.url('brass')) +
    ink(circleD(71, 50, 17), s.url('brass')) +
    ink(circleD(29, 50, 11), s.url('lens'), { 'stroke-width': SW * 0.6 }) +
    ink(circleD(71, 50, 11), s.url('lens'), { 'stroke-width': SW * 0.6 }) +
    rivets(29) +
    rivets(71) +
    gleam(M(23, 48) + Q(24, 44, 28, 43), 2) +
    gleam(M(65, 48) + Q(66, 44, 70, 43), 2) +
    /** @type {[number, number, number][]} */ ([
      [40, 28, 4],
      [46, 20, 5.5],
      [54, 13, 7],
    ])
      .map(([x, y, r]) =>
        ink(circleD(x, y, r), '#eef2f6', { 'stroke-width': SW * 0.4, opacity: 0.9 }),
      )
      .join('')
  );
}

/** A pile of warm stones glowing orange in their cracks, with a puff of steam. */
function stonesWarm() {
  const s = scope('stones-warm');
  /** @type {[number, number, number, number][]} */
  const stones = [
    [30, 82, 18, 11],
    [70, 82, 18, 11],
    [50, 84, 16, 10],
    [40, 68, 15, 10],
    [62, 68, 14, 9],
    [51, 55, 12, 8],
  ];
  return (
    h(
      'defs',
      null,
      shade(s.id('rock'), ROCK, { light: 0.4, dark: 0.2 }),
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#ffb05c', 'stop-opacity': '0.7' }),
        h('stop', { offset: '1', 'stop-color': '#ff8a3c', 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 72, r: 40, fill: s.url('glow') }) +
    groundShadow(50, 93, 40, 4) +
    stones
      .map(
        ([x, y, rx, ry]) =>
          ink(ellipseD(x, y, rx, ry), s.url('rock')) +
          line(
            M(x - rx * 0.5, y) + L(x - rx * 0.1, y + ry * 0.3) + L(x + rx * 0.4, y - ry * 0.2),
            FLAME,
            2.2,
          ),
      )
      .join('') +
    /** @type {[number, number, number][]} */ ([
      [54, 40, 5],
      [48, 30, 7],
      [56, 18, 9],
    ])
      .map(([x, y, r]) =>
        ink(circleD(x, y, r), '#eef2f6', { 'stroke-width': SW * 0.4, opacity: 0.9 }),
      )
      .join('')
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const VOLCANIC_VENTS_COSMETICS = [
  { id: 'cap-flames', slot: 'head', draw: capFlames },
  { id: 'goggles-steam', slot: 'eyes', draw: gogglesSteam },
  { id: 'stones-warm', slot: 'grotto', draw: stonesWarm },
];
