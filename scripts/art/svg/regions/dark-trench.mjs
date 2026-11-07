// @ts-check
/**
 * Temný příkop (region 10, grade 4): the egg of Klipka Vzorná, the region's sticker icons and its
 * cosmetics (docs/art.md §9). Klipka's egg carries her memory hook: rows of diamond patterns (vzory).
 */
import { darken } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const KLIPKA = '#fad246';
const OCTO = '#966446';
const GLOW = '#8fd3ff';

/**
 * A diamond centred at (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 */
function diamondD(x, y, r) {
  return M(x, y - r) + L(x + r * 0.8, y) + L(x, y + r) + L(x - r * 0.8, y) + Z;
}

// ------------------------------------------------------------------------------------------- eggs

/** Klipka Vzorná: sunny yellow with rows of white and blue diamonds and a dark eye band. */
function eggKlipka() {
  /** @type {[number, number][]} */
  const spots = [];
  for (const [y, xs] of /** @type {[number, number[]][]} */ ([
    [48, [44, 76]],
    [72, [28, 60, 92]],
    [96, [44, 76]],
    [120, [28, 60, 92]],
  ]))
    for (const x of xs) spots.push([x, y]);
  return (
    h('path', { d: M(0, 0) + L(22, 0) + L(22, 160) + L(0, 160) + Z, fill: '#283250' }) +
    spots
      .map(([x, y], i) =>
        ink(diamondD(x, y, 9), i % 2 ? '#78b4e6' : '#fcf8ec', { 'stroke-width': SW * 0.45 }),
      )
      .join('')
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const DARK_TRENCH_EGGS = [{ id: 'klipka-vzorna', base: KLIPKA, motif: eggKlipka }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerButterflyfish() {
  const s = scope('sticker-butterflyfish');
  return (
    h('defs', null, shade(s.id('body'), KLIPKA, { light: 0.5, dark: 0.15 })) +
    ink(M(70, 52) + L(84, 42) + L(84, 62) + Z, KLIPKA, { 'stroke-width': SW * 0.5 }) +
    ink(circleD(48, 52, 24), s.url('body')) +
    h('path', { d: M(30, 38) + L(36, 36) + L(36, 68) + L(30, 64) + Z, fill: '#283250' }) +
    [
      [48, 42],
      [60, 46],
      [46, 56],
      [58, 60],
      [52, 68],
    ]
      .map(([x, y], i) =>
        ink(diamondD(x ?? 0, y ?? 0, 4.6), i % 2 ? '#78b4e6' : '#fcf8ec', {
          'stroke-width': SW * 0.35,
        }),
      )
      .join('') +
    ink(M(26, 50) + L(18, 52) + L(26, 54) + Z, KLIPKA, { 'stroke-width': SW * 0.4 }) +
    h('circle', {
      cx: 33,
      cy: 48,
      r: 2.8,
      fill: '#ffffff',
      stroke: INK,
      'stroke-width': SW * 0.35,
    }) +
    h('circle', { cx: 32.6, cy: 48.4, r: 1.4, fill: INK }) +
    sparkle(76, 28, 5)
  );
}

function stickerHappyOctopus() {
  const s = scope('sticker-happy-octopus');
  const arms = Array.from({ length: 8 }, (_, i) => {
    const a = 20 + i * 20;
    const p = polar(50, 56, 12, a);
    const q = polar(50, 56, 25, a);
    return M(p.x, p.y) + Q((p.x + q.x) / 2 + 4, (p.y + q.y) / 2, q.x, q.y);
  }).join('');
  return (
    h('defs', null, shade(s.id('head'), OCTO, { light: 0.45, dark: 0.18 })) +
    line(arms, OCTO, 6, { 'stroke-linecap': 'round' }) +
    line(arms, '#f0dcb4', 2, { 'stroke-linecap': 'round', 'stroke-dasharray': '3 3' }) +
    ink(ellipseD(50, 44, 20, 18), s.url('head')) +
    h('circle', { cx: 43, cy: 46, r: 2.6, fill: INK }) +
    h('circle', { cx: 57, cy: 46, r: 2.6, fill: INK }) +
    line(M(44, 52) + Q(50, 57, 56, 52), INK, SW * 0.5) +
    h('ellipse', { cx: 39, cy: 51, rx: 3, ry: 2, fill: '#ff9db0', opacity: 0.8 }) +
    h('ellipse', { cx: 61, cy: 51, rx: 3, ry: 2, fill: '#ff9db0', opacity: 0.8 }) +
    gleam(M(40, 34) + Q(44, 30, 50, 29), 1.8)
  );
}

function stickerFourteenScales() {
  /** @type {[number, number][]} */
  const spots = [];
  for (const [y, xs] of /** @type {[number, number[]][]} */ ([
    [28, [38, 50, 62]],
    [40, [32, 44, 56, 68]],
    [52, [26, 38, 50, 62, 74]],
    [64, [44, 56]],
  ]))
    for (const x of xs) spots.push([x, y]);
  return (
    spots
      .map(([x, y], i) =>
        ink(diamondD(x, y, 6), ['#fcf8ec', '#78b4e6', '#fad246'][i % 3] ?? '#ffffff', {
          'stroke-width': SW * 0.4,
        }),
      )
      .join('') + sparkle(50, 78, 6)
  );
}

function stickerDolphinTrophy() {
  const s = scope('sticker-dolphin-trophy');
  return (
    h('defs', null, shade(s.id('gold'), '#ffcc4d', { light: 0.5, dark: 0.22 })) +
    ink(
      M(34, 28) + L(66, 28) + C(66, 48, 58, 56, 50, 58) + C(42, 56, 34, 48, 34, 28) + Z,
      s.url('gold'),
    ) +
    line(M(34, 32) + Q(24, 34, 28, 44) + M(66, 32) + Q(76, 34, 72, 44), INK, SW * 0.7) +
    ink(roundRectD(46, 58, 8, 10, 2), s.url('gold')) +
    ink(roundRectD(36, 68, 28, 8, 3), s.url('gold')) +
    ink(
      M(42, 42) +
        C(44, 36, 52, 34, 58, 38) +
        L(62, 38) +
        Q(58, 42, 54, 42) +
        C(50, 44, 46, 46, 42, 42) +
        Z,
      '#6ea6d8',
      {
        'stroke-width': SW * 0.4,
      },
    ) +
    gleam(M(38, 32) + L(38, 42), 1.6) +
    sparkle(78, 26, 5)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const DARK_TRENCH_STICKERS = [
  { id: 'butterflyfish', draw: stickerButterflyfish },
  { id: 'happy-octopus', draw: stickerHappyOctopus },
  { id: 'fourteen-scales', draw: stickerFourteenScales },
  { id: 'dolphin-trophy', draw: stickerDolphinTrophy },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A headband with a row of patterned diamonds; the band's centre is (50, 50). */
function headbandPattern() {
  const band = M(10, 60) + Q(50, 36, 90, 60);
  return (
    line(band, INK, 9) +
    line(band, '#5c6bc0', 5.4) +
    [-2, -1, 0, 1, 2]
      .map((k) => {
        const x = 50 + k * 15;
        const y = 48 + Math.abs(k) * 2.6;
        return ink(diamondD(x, y - 4, 8), k % 2 ? '#78b4e6' : KLIPKA, { 'stroke-width': SW * 0.5 });
      })
      .join('')
  );
}

/** A deep-sea mask with glowing round lenses; the bridge is (50, 50). */
function maskDeep() {
  const s = scope('mask-deep');
  const frame =
    M(14, 42) +
    C(14, 34, 22, 32, 32, 32) +
    L(68, 32) +
    C(78, 32, 86, 34, 86, 42) +
    L(86, 56) +
    C(86, 64, 78, 68, 70, 66) +
    C(60, 64, 56, 58, 50, 58) +
    C(44, 58, 40, 64, 30, 66) +
    C(22, 68, 14, 64, 14, 56) +
    Z;
  return (
    h('defs', null, shade(s.id('frame'), '#3f51b5', { light: 0.4, dark: 0.25 })) +
    tube(M(14, 48) + L(4, 46), '#3f51b5', 3.6) +
    tube(M(86, 48) + L(96, 46), '#3f51b5', 3.6) +
    ink(frame, s.url('frame')) +
    ink(circleD(32, 48, 10), GLOW, { 'stroke-width': SW * 0.6 }) +
    ink(circleD(68, 48, 10), GLOW, { 'stroke-width': SW * 0.6 }) +
    h('circle', { cx: 29, cy: 45, r: 2.4, fill: '#ffffff' }) +
    h('circle', { cx: 65, cy: 45, r: 2.4, fill: '#ffffff' })
  );
}

/** A pile of round stones glowing blue and pink, standing at the bottom. */
function stonesGlowing() {
  const s = scope('stones-glowing');
  /** @type {[number, number, number, number, string][]} */
  const stones = [
    [32, 82, 18, 11, GLOW],
    [68, 82, 18, 11, '#f096e6'],
    [50, 84, 16, 10, '#b4a0ff'],
    [41, 68, 14, 9, '#f096e6'],
    [60, 68, 13, 9, GLOW],
    [50, 56, 11, 8, '#b4a0ff'],
  ];
  return (
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#b4a0ff', 'stop-opacity': '0.6' }),
        h('stop', { offset: '1', 'stop-color': '#5c6bc0', 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 70, r: 40, fill: s.url('glow') }) +
    groundShadow(50, 93, 36, 4) +
    stones
      .map(
        ([x, y, rx, ry, c]) =>
          ink(ellipseD(x, y, rx, ry), darken(c, 0.35)) +
          h('ellipse', {
            cx: x - rx * 0.2,
            cy: y - ry * 0.2,
            rx: rx * 0.55,
            ry: ry * 0.5,
            fill: c,
            opacity: 0.9,
          }),
      )
      .join('')
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const DARK_TRENCH_COSMETICS = [
  { id: 'headband-pattern', slot: 'head', draw: headbandPattern },
  { id: 'mask-deep', slot: 'eyes', draw: maskDeep },
  { id: 'stones-glowing', slot: 'grotto', draw: stonesGlowing },
];
