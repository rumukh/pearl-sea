// @ts-check
/**
 * Pirátský vrak (region 4): the eggs of Ježík Syčík, Vydra Výskalka and Jazyk Jazýček, the
 * region's sticker icons and its cosmetics (docs/art.md §9). Each egg carries its friend's memory
 * hook: Ježík's pale spines and spots, Vydra's cream whisker pads, Jazyk's soft fin rays.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { g, h } from '../lib/xml.mjs';
import { CREAM, INK, SW, gleam, groundShadow, ink, line, scope, shade } from '../style.mjs';

const JEZIK = '#f0cf78';
const VYDRA = '#96664a';
const JAZYK = '#e2c496';
const SPOT = '#b07a4c';
const GOLD = '#ffcc4d';
const PIRATE = '#3a3350';

// ------------------------------------------------------------------------------------------- eggs

/** Ježík Syčík: sandy yellow, a band of pale spines, brown spots and a creamy lower half. */
function eggJezik() {
  const belly = M(0, 110) + C(36, 102, 84, 104, 120, 112) + L(120, 160) + L(0, 160) + Z;
  const spines = Array.from({ length: 7 }, (_, i) => {
    const x = 6 + i * 18;
    return M(x, 112 - (i % 2) * 2) + L(x + 9, 94 - (i % 2) * 2) + L(x + 18, 112 - (i % 2) * 2) + Z;
  }).join('');
  /** @type {[number, number, number][]} */
  const spots = [
    [34, 44, 6],
    [62, 34, 5],
    [86, 56, 6.5],
    [48, 70, 5.5],
    [76, 82, 5],
    [24, 84, 4.5],
  ];
  return (
    ink(spines, '#fbf0d2', { 'stroke-width': SW * 0.55 }) +
    h('path', { d: belly, fill: '#fbf3e0' }) +
    line(M(0, 110) + C(36, 102, 84, 104, 120, 112), INK, SW * 0.7, { opacity: 0.7 }) +
    spots
      .map(([x, y, r]) => h('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: SPOT }))
      .join('')
  );
}

/** Vydra Výskalka: river-otter brown, a cream wavy chest, whisker dots and two paw prints. */
function eggVydra() {
  const chest = M(0, 104) + Q(20, 94, 40, 102) + Q(60, 92, 80, 102) + Q(100, 94, 120, 104);
  const paw = (/** @type {number} */ x, /** @type {number} */ y) =>
    h('ellipse', { cx: x, cy: y + 4, rx: 9, ry: 7.5, fill: '#f1dcba' }) +
    [-6, -2, 2, 6]
      .map((dx, i) =>
        h('circle', {
          cx: x + dx * 1.5,
          cy: y - 7 - (i === 1 || i === 2 ? 2.2 : 0),
          r: 3,
          fill: '#f1dcba',
        }),
      )
      .join('');
  const whiskers = [-1, 1]
    .map((k) =>
      [0, 1, 2]
        .map((i) =>
          h('circle', {
            cx: 60 + k * (14 + i * 8),
            cy: 116 + i * 2.5,
            r: 1.9,
            fill: darken(VYDRA, 0.2),
          }),
        )
        .join(''),
    )
    .join('');
  return (
    h('path', { d: chest + L(120, 160) + L(0, 160) + Z, fill: '#f1dcba' }) +
    line(chest, INK, SW * 0.7, { opacity: 0.7 }) +
    whiskers +
    paw(38, 52) +
    paw(80, 40)
  );
}

/** Jazyk Jazýček: sandy beige, soft fin rays round the top, a middle line and brown spots. */
function eggJazyk() {
  const rays = Array.from({ length: 13 }, (_, i) => {
    const a = -170 + i * 13.3;
    const p = polar(60, 80, 52, a);
    const q = polar(60, 80, 68, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  /** @type {[number, number][]} */
  const spots = [
    [36, 70],
    [62, 62],
    [86, 76],
    [48, 100],
    [76, 106],
  ];
  return (
    line(rays, darken(JAZYK, 0.22), SW * 0.6, { opacity: 0.85 }) +
    line(M(20, 88) + Q(60, 92, 104, 86), darken(JAZYK, 0.15), SW * 0.6) +
    spots
      .map(([x, y]) => h('ellipse', { cx: x, cy: y, rx: 6, ry: 4.4, fill: darken(JAZYK, 0.28) }))
      .join('')
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const PIRATE_WRECK_EGGS = [
  { id: 'jezik-sycik', base: JEZIK, motif: eggJezik },
  { id: 'vydra-vyskalka', base: VYDRA, motif: eggVydra },
  { id: 'jazyk-jazycek', base: JAZYK, motif: eggJazyk },
];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

/**
 * A round cartoon eye looking left.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 */
function eye(x, y, r) {
  return (
    h('circle', { cx: x, cy: y, r, fill: '#ffffff', stroke: INK, 'stroke-width': SW * 0.4 }) +
    h('circle', { cx: x - r * 0.15, cy: y + r * 0.1, r: r * 0.55, fill: INK }) +
    h('circle', { cx: x - r * 0.35, cy: y - r * 0.2, r: r * 0.2, fill: '#ffffff' })
  );
}

function stickerPuffer() {
  const s = scope('sticker-puffer');
  const spines = Array.from({ length: 14 }, (_, i) => {
    const a = i * (360 / 14) + 6;
    const b1 = polar(50, 52, 24, a - 7);
    const tip = polar(50, 52, 34, a);
    const b2 = polar(50, 52, 24, a + 7);
    return M(b1.x, b1.y) + L(tip.x, tip.y) + L(b2.x, b2.y) + Z;
  }).join('');
  return (
    h('defs', null, shade(s.id('body'), JEZIK, { light: 0.5, dark: 0.18 })) +
    ink(spines, '#fbf0d2', { 'stroke-width': SW * 0.5 }) +
    ink(M(74, 52) + L(84, 44) + L(84, 60) + Z, '#e6a95a', { 'stroke-width': SW * 0.55 }) +
    ink(circleD(50, 52, 26), s.url('body')) +
    h('path', { d: M(25, 58) + Q(50, 82, 75, 58) + Q(50, 76, 25, 58) + Z, fill: '#fbf3e0' }) +
    [
      [58, 38],
      [68, 50],
      [62, 64],
      [46, 34],
    ]
      .map(([x, y]) => h('ellipse', { cx: x, cy: y, rx: 3.2, ry: 2.6, fill: SPOT }))
      .join('') +
    eye(36, 46, 6) +
    eye(48, 44, 5.4) +
    ink(ellipseD(28, 58, 2.6, 3.4), '#c25a6c', { 'stroke-width': SW * 0.4 }) +
    h('ellipse', { cx: 38, cy: 56, rx: 3.6, ry: 2.4, fill: '#ff9db0', opacity: 0.8 }) +
    gleam(M(40, 30) + Q(46, 28, 52, 28), 1.8)
  );
}

function stickerOtter() {
  const s = scope('sticker-otter');
  const head =
    M(16, 54) +
    C(16, 34, 32, 26, 50, 26) +
    C(68, 26, 84, 34, 84, 54) +
    C(84, 70, 68, 76, 50, 76) +
    C(32, 76, 16, 70, 16, 54) +
    Z;
  const face =
    M(24, 58) +
    C(28, 50, 40, 48, 50, 52) +
    C(60, 48, 72, 50, 76, 58) +
    C(72, 70, 62, 74, 50, 74) +
    C(38, 74, 28, 70, 24, 58) +
    Z;
  return (
    h('defs', null, shade(s.id('fur'), VYDRA, { light: 0.35, dark: 0.18 })) +
    ink(circleD(20, 40, 5), darken(VYDRA, 0.1), { 'stroke-width': SW * 0.5 }) +
    ink(circleD(80, 40, 5), darken(VYDRA, 0.1), { 'stroke-width': SW * 0.5 }) +
    ink(head, s.url('fur')) +
    h('path', { d: face, fill: '#f4e2c4' }) +
    h('ellipse', { cx: 42, cy: 60, rx: 9, ry: 6, fill: '#fff3de' }) +
    h('ellipse', { cx: 58, cy: 60, rx: 9, ry: 6, fill: '#fff3de' }) +
    ink(ellipseD(50, 54, 6, 4), INK, { 'stroke-width': SW * 0.3 }) +
    ink(ellipseD(50, 67, 4.4, 3.6), '#c25a6c', { 'stroke-width': SW * 0.45 }) +
    line(
      M(36, 60) + L(22, 57) + M(36, 63) + L(22, 64) + M(64, 60) + L(78, 57) + M(64, 63) + L(78, 64),
      INK,
      0.9,
      { opacity: 0.7 },
    ) +
    eye(38, 42, 4.6) +
    eye(62, 42, 4.6) +
    h('ellipse', { cx: 28, cy: 52, rx: 3.6, ry: 2.4, fill: '#ff9db0', opacity: 0.8 }) +
    h('ellipse', { cx: 72, cy: 52, rx: 3.6, ry: 2.4, fill: '#ff9db0', opacity: 0.8 }) +
    gleam(M(32, 32) + Q(40, 29, 48, 29), 1.8)
  );
}

function stickerSole() {
  const s = scope('sticker-sole');
  const fin =
    M(14, 52) +
    C(14, 34, 40, 30, 60, 36) +
    C(72, 40, 78, 46, 80, 52) +
    C(78, 58, 72, 64, 60, 68) +
    C(40, 74, 14, 70, 14, 52) +
    Z;
  const body =
    M(19, 52) +
    C(19, 39, 40, 36, 58, 41) +
    C(68, 44, 73, 48, 74, 52) +
    C(73, 56, 68, 60, 58, 63) +
    C(40, 68, 19, 65, 19, 52) +
    Z;
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = i * 22.5;
    const p = polar(46, 52, 24, a);
    const q = polar(46, 52, 30, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  return (
    h(
      'defs',
      null,
      shade(s.id('body'), JAZYK, { light: 0.4, dark: 0.15 }),
      h('clipPath', { id: s.id('fin') }, h('path', { d: fin })),
    ) +
    ink(M(76, 52) + L(88, 44) + L(88, 60) + Z, darken(JAZYK, 0.12), { 'stroke-width': SW * 0.55 }) +
    ink(fin, darken(JAZYK, 0.12)) +
    g({ 'clip-path': s.url('fin') }, line(rays, darken(JAZYK, 0.35), 1.2, { opacity: 0.7 })) +
    ink(body, s.url('body')) +
    line(M(36, 53) + L(70, 53), darken(JAZYK, 0.2), 1.2) +
    [
      [44, 46],
      [56, 58],
      [62, 47],
    ]
      .map(([x, y]) => h('ellipse', { cx: x, cy: y, rx: 3, ry: 2.2, fill: darken(JAZYK, 0.3) }))
      .join('') +
    eye(28, 46, 4) +
    eye(37, 43, 3.6) +
    line(M(22, 57) + Q(25, 60, 28, 58), INK, SW * 0.4) +
    sparkle(78, 28, 5)
  );
}

function stickerLantern() {
  const s = scope('sticker-lantern');
  return (
    h(
      'defs',
      null,
      shade(s.id('brass'), '#e0a83a', { light: 0.5, dark: 0.22 }),
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#fff6c0', 'stop-opacity': '0.95' }),
        h('stop', { offset: '1', 'stop-color': '#ffd45c', 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 56, r: 34, fill: s.url('glow') }) +
    line(M(40, 22) + Q(50, 8, 60, 22), INK, SW * 1.2) +
    line(M(40, 22) + Q(50, 8, 60, 22), '#e0a83a', SW * 0.5) +
    ink(M(36, 30) + L(64, 30) + L(58, 22) + L(42, 22) + Z, s.url('brass')) +
    ink(roundRectD(36, 30, 28, 36, 5), '#fff3b8', { 'stroke-width': SW * 0.7 }) +
    ink(M(50, 38) + C(56, 46, 56, 54, 50, 58) + C(44, 54, 44, 46, 50, 38) + Z, '#ff9a3c', {
      'stroke-width': SW * 0.45,
    }) +
    h('path', {
      d: M(50, 45) + C(53, 49, 53, 53, 50, 55) + C(47, 53, 47, 49, 50, 45) + Z,
      fill: '#ffe680',
    }) +
    line(M(43, 31) + L(43, 65) + M(57, 31) + L(57, 65), '#e0a83a', 2) +
    ink(roundRectD(33, 66, 34, 8, 3), s.url('brass')) +
    gleam(M(39, 36) + L(39, 48), 1.8)
  );
}

function stickerCalendarWave() {
  const s = scope('sticker-calendar-wave');
  const wave =
    M(24, 42) +
    Q(30, 36, 36, 42) +
    Q(42, 48, 48, 42) +
    Q(54, 36, 60, 42) +
    Q(66, 48, 72, 42) +
    Q(74, 40, 76, 40);
  const checks = Array.from({ length: 10 }, (_, i) => {
    const x = 28 + (i % 5) * 11;
    const y = 56 + Math.floor(i / 5) * 11;
    return M(x - 2.6, y) + L(x - 0.4, y + 2.4) + L(x + 3, y - 2.6);
  }).join('');
  return (
    h('defs', null, shade(s.id('top'), '#ff7a59', { light: 0.35, dark: 0.18 })) +
    ink(roundRectD(18, 22, 64, 58, 6), CREAM) +
    h('path', { d: M(18, 36) + L(82, 36) + L(82, 48) + L(18, 48) + Z, fill: '#bfe9ff' }) +
    line(wave, '#2f86d6', 2.4) +
    ink(
      M(24, 22) +
        L(76, 22) +
        Q(82, 22, 82, 28) +
        L(82, 34) +
        L(18, 34) +
        L(18, 28) +
        Q(18, 22, 24, 22) +
        Z,
      s.url('top'),
    ) +
    [32, 50, 68]
      .map((x) =>
        ink(roundRectD(x - 2.5, 16, 5, 12, 2.5), '#c7ccd8', { 'stroke-width': SW * 0.45 }),
      )
      .join('') +
    Array.from({ length: 10 }, (_, i) =>
      ink(circleD(28 + (i % 5) * 11, 56 + Math.floor(i / 5) * 11, 4.2), lighten('#5fb4c9', 0.55), {
        'stroke-width': SW * 0.35,
      }),
    ).join('') +
    line(checks, '#2f9a6a', 1.8)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const PIRATE_WRECK_STICKERS = [
  { id: 'puffer', draw: stickerPuffer },
  { id: 'otter', draw: stickerOtter },
  { id: 'sole', draw: stickerSole },
  { id: 'lantern', draw: stickerLantern },
  { id: 'calendar-wave', draw: stickerCalendarWave },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A dark tricorne with gold trim and a pearly shell badge; the brim centre is (50, 50). */
function hatPirate() {
  const s = scope('hat-pirate');
  const hat =
    M(8, 46) +
    C(14, 40, 22, 40, 28, 42) +
    C(30, 26, 40, 18, 50, 18) +
    C(60, 18, 70, 26, 72, 42) +
    C(78, 40, 86, 40, 92, 46) +
    C(86, 56, 70, 60, 50, 58) +
    C(30, 60, 14, 56, 8, 46) +
    Z;
  const trim = M(10, 47) + C(16, 55, 30, 58, 50, 56.5) + C(70, 58, 84, 55, 90, 47);
  return (
    h('defs', null, shade(s.id('felt'), PIRATE, { light: 0.35, dark: 0.2 })) +
    ink(hat, s.url('felt')) +
    line(trim, INK, SW * 1.3) +
    line(trim, GOLD, SW * 0.6) +
    ink(roundStarD(50, 38, 5, 8, 4.4, -90, 0.3), '#fff4e6', { 'stroke-width': SW * 0.55 }) +
    h('circle', { cx: 50, cy: 38.5, r: 2.2, fill: '#ffc8d8' }) +
    ink(M(74, 30) + Q(84, 18, 90, 22) + Q(84, 28, 78, 34) + Z, '#ff7a59', {
      'stroke-width': SW * 0.5,
    }) +
    gleam(M(34, 30) + Q(38, 24, 45, 22), 2)
  );
}

/** An eye patch on a band: the band crosses the bridge (50, 50); the patch covers the right eye. */
function eyepatch() {
  const s = scope('eyepatch');
  const patch =
    M(56, 42) +
    C(58, 36, 76, 36, 80, 42) +
    C(84, 50, 78, 62, 68, 62) +
    C(58, 62, 54, 50, 56, 42) +
    Z;
  return (
    h('defs', null, shade(s.id('patch'), PIRATE, { light: 0.35, dark: 0.2 })) +
    line(M(6, 40) + Q(30, 50, 56, 46) + M(80, 44) + Q(88, 42, 94, 36), INK, SW * 1.5) +
    line(M(6, 40) + Q(30, 50, 56, 46) + M(80, 44) + Q(88, 42, 94, 36), '#6b6080', SW * 0.6) +
    ink(patch, s.url('patch')) +
    ink(roundStarD(68, 50, 5, 5, 2.4, -90, 0.3), GOLD, { 'stroke-width': SW * 0.45 }) +
    gleam(M(61, 42) + Q(65, 39.5, 70, 39.5), 1.6)
  );
}

/** An open treasure chest full of gold coins and pearls, standing with its feet at the bottom. */
function chestTreasure() {
  const s = scope('chest-treasure');
  const lid = M(18, 46) + C(18, 24, 82, 24, 82, 46) + Z;
  /** @type {[number, number][]} */
  const pearls = [
    [50, 44],
    [30, 47],
    [72, 46],
  ];
  /** @type {[number, number][]} */
  const coins = [
    [32, 52],
    [44, 48],
    [56, 50],
    [68, 52],
    [38, 56],
    [62, 56],
  ];
  return (
    h(
      'defs',
      null,
      shade(s.id('wood'), '#b07444', { light: 0.35, dark: 0.22 }),
      shade(s.id('gold'), GOLD, { light: 0.5, dark: 0.2 }),
    ) +
    groundShadow(50, 93, 40, 4) +
    ink(lid, s.url('wood')) +
    h('path', { d: M(24, 46) + C(24, 32, 76, 32, 76, 46) + Z, fill: darken('#b07444', 0.45) }) +
    line(M(18, 46) + C(18, 24, 82, 24, 82, 46), GOLD, 2.4) +
    coins
      .map(([x, y]) => ink(ellipseD(x, y, 6.4, 4), s.url('gold'), { 'stroke-width': SW * 0.45 }))
      .join('') +
    pearls
      .map(([x, y]) => ink(circleD(x, y, 3.4), '#fffaf0', { 'stroke-width': SW * 0.4 }))
      .join('') +
    ink(roundRectD(16, 56, 68, 36, 5), s.url('wood')) +
    line(M(17, 66) + L(83, 66) + M(17, 82) + L(83, 82), darken('#b07444', 0.35), 1.6) +
    ink(roundRectD(26, 56, 6, 36, 1.5), GOLD, { 'stroke-width': SW * 0.45 }) +
    ink(roundRectD(68, 56, 6, 36, 1.5), GOLD, { 'stroke-width': SW * 0.45 }) +
    ink(roundRectD(44, 60, 12, 12, 3), GOLD, { 'stroke-width': SW * 0.55 }) +
    h('circle', { cx: 50, cy: 66, r: 1.8, fill: INK }) +
    sparkle(80, 30, 5) +
    sparkle(24, 32, 4) +
    gleam(M(20, 62) + L(20, 76), 1.8)
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const PIRATE_WRECK_COSMETICS = [
  { id: 'hat-pirate', slot: 'head', draw: hatPirate },
  { id: 'eyepatch', slot: 'eyes', draw: eyepatch },
  { id: 'chest-treasure', slot: 'grotto', draw: chestTreasure },
];
