// @ts-check
/**
 * Měsíční jeskyně (region 8, grade 4): the egg of Rak poustevník Kořínek, the region's sticker icons
 * and its cosmetics (docs/art.md §9). Kořínek's egg carries his memory hook: a spiral shell whose
 * turns are the prefixes and suffixes, the root safe inside.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { g, h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const SHELL = '#aa82d2';
const CRAB = '#f08250';
const MOON = '#e8ecff';
const GLOW = '#8fd3ff';
const LOBSTER = '#4a5f96';

/**
 * A spiral shell centred at (x, y): `turns` cream bands on a lilac shell of radius r.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {number} turns
 */
function spiral(x, y, r, turns) {
  let d = '';
  const steps = turns * 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / 24) * 360 - 90;
    const rr = r * (1 - i / (steps + 6));
    const p = polar(x, y, rr, a);
    d += i === 0 ? M(p.x, p.y) : L(p.x, p.y);
  }
  return d;
}

// ------------------------------------------------------------------------------------------- eggs

/** Rak poustevník Kořínek: lilac shell colour, a three-turn cream spiral and a peeking orange crab. */
function eggKorinek() {
  return (
    line(spiral(64, 70, 34, 3), '#fbe6c4', 5, { 'stroke-linecap': 'round' }) +
    line(spiral(64, 70, 34, 3), INK, 1.2, { opacity: 0.5 }) +
    ink(M(14, 128) + C(14, 110, 30, 102, 44, 108) + C(52, 112, 52, 128, 46, 134) + Z, CRAB, {
      'stroke-width': SW * 0.6,
    }) +
    h('circle', { cx: 26, cy: 104, r: 3, fill: INK }) +
    h('circle', { cx: 36, cy: 104, r: 3, fill: INK })
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const MOON_CAVES_EGGS = [{ id: 'rak-korinek', base: SHELL, motif: eggKorinek }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerHermitCrab() {
  const s = scope('sticker-hermit-crab');
  return g(
    { transform: 'translate(50 50) scale(0.84) translate(-50 -50)' },
    h('defs', null, shade(s.id('shell'), SHELL, { light: 0.45, dark: 0.2 })) +
      ink(circleD(58, 46, 24), s.url('shell')) +
      line(spiral(60, 44, 18, 3), '#fbe6c4', 3, { 'stroke-linecap': 'round' }) +
      ink(M(22, 70) + C(22, 56, 38, 52, 48, 60) + C(52, 66, 50, 76, 42, 78) + L(26, 78) + Z, CRAB) +
      line(M(30, 58) + L(28, 46) + M(38, 56) + L(38, 44), INK, SW * 0.8) +
      h('circle', {
        cx: 28,
        cy: 44,
        r: 3.4,
        fill: '#ffffff',
        stroke: INK,
        'stroke-width': SW * 0.4,
      }) +
      h('circle', {
        cx: 38,
        cy: 42,
        r: 3.4,
        fill: '#ffffff',
        stroke: INK,
        'stroke-width': SW * 0.4,
      }) +
      h('circle', { cx: 28, cy: 44.6, r: 1.6, fill: INK }) +
      h('circle', { cx: 38, cy: 42.6, r: 1.6, fill: INK }) +
      ink(ellipseD(18, 68, 7, 5), CRAB, { 'stroke-width': SW * 0.5 }) +
      line(M(28, 78) + L(24, 86) + M(36, 78) + L(34, 86) + M(44, 77) + L(44, 85), INK, SW * 0.7) +
      gleam(M(44, 30) + Q(52, 25, 62, 25), 1.8),
  );
}

function stickerClosedScissors() {
  const s = scope('sticker-closed-scissors');
  const upper = M(28, 54) + C(34, 34, 60, 26, 78, 40) + C(68, 42, 52, 46, 40, 54) + Z;
  const lower = M(28, 54) + C(36, 68, 60, 70, 76, 58) + C(64, 56, 50, 56, 40, 54) + Z;
  return (
    h('defs', null, shade(s.id('claw'), LOBSTER, { light: 0.5, dark: 0.15 })) +
    ink(roundRectD(16, 50, 20, 12, 6), s.url('claw')) +
    ink(lower, s.url('claw')) +
    ink(upper, s.url('claw')) +
    line(M(44, 52) + Q(58, 48, 72, 46), lighten(LOBSTER, 0.4), 1.6) +
    ink(roundRectD(18, 66, 30, 7, 3.5), '#ffffff', { 'stroke-width': SW * 0.45 }) +
    ink(roundRectD(18, 66, 30, 7, 3.5), 'none', { 'stroke-width': SW * 0.45 }) +
    gleam(M(42, 40) + Q(52, 34, 62, 34), 1.8) +
    sparkle(74, 24, 5)
  );
}
function stickerWordShell() {
  const s = scope('sticker-word-shell');
  return g(
    { transform: 'translate(50 50) scale(0.84) translate(-50 -50)' },
    h('defs', null, shade(s.id('shell'), '#e9dcf6', { light: 0.5, dark: 0.2 })) +
      ink(
        M(16, 66) + C(14, 34, 40, 20, 56, 26) + C(78, 32, 86, 56, 76, 70) + Q(46, 80, 16, 66) + Z,
        s.url('shell'),
      ) +
      line(spiral(54, 50, 20, 2), darken('#e9dcf6', 0.3), 2.4) +
      ink(roundRectD(36, 44, 28, 12, 6), '#ffd166', { 'stroke-width': SW * 0.5 }) +
      ink(roundRectD(14, 70, 18, 10, 4), '#8fd3ff', { 'stroke-width': SW * 0.45 }) +
      ink(roundRectD(68, 70, 18, 10, 4), '#ff9db0', { 'stroke-width': SW * 0.45 }) +
      gleam(M(28, 36) + Q(34, 29, 42, 27), 1.8),
  );
}

function stickerDivingBadge() {
  const s = scope('sticker-diving-badge');
  const helmet = circleD(50, 48, 24);
  return (
    h('defs', null, shade(s.id('brass'), '#d9a441', { light: 0.5, dark: 0.25 })) +
    ink(M(34, 70) + L(28, 86) + L(40, 80) + L(46, 88) + L(48, 72) + Z, '#7e57c2', {
      'stroke-width': SW * 0.5,
    }) +
    ink(M(66, 70) + L(72, 86) + L(60, 80) + L(54, 88) + L(52, 72) + Z, '#7e57c2', {
      'stroke-width': SW * 0.5,
    }) +
    ink(helmet, s.url('brass')) +
    ink(circleD(50, 48, 13), '#bfe9ff', { 'stroke-width': SW * 0.6 }) +
    [0, 90, 180, 270]
      .map((a) => {
        const p = polar(50, 48, 19, a + 45);
        return h('circle', { cx: p.x, cy: p.y, r: 1.8, fill: INK });
      })
      .join('') +
    gleam(M(42, 44) + Q(44, 39, 49, 38), 2)
  );
}

function stickerCoinChest() {
  const s = scope('sticker-coin-chest');
  /** @type {[number, number][]} */
  const coins = [
    [36, 42],
    [50, 38],
    [64, 42],
    [43, 34],
    [57, 34],
  ];
  return (
    h(
      'defs',
      null,
      shade(s.id('wood'), '#b07444', { light: 0.35, dark: 0.22 }),
      shade(s.id('gold'), '#ffcc4d', { light: 0.5, dark: 0.2 }),
    ) +
    coins
      .map(([x, y]) => ink(ellipseD(x, y, 8, 5), s.url('gold'), { 'stroke-width': SW * 0.45 }))
      .join('') +
    ink(roundRectD(22, 46, 56, 32, 5), s.url('wood')) +
    line(M(23, 58) + L(77, 58), darken('#b07444', 0.35), 1.6) +
    ink(roundRectD(44, 52, 12, 12, 3), '#ffcc4d', { 'stroke-width': SW * 0.5 }) +
    sparkle(80, 26, 6) +
    sparkle(22, 28, 4)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const MOON_CAVES_STICKERS = [
  { id: 'hermit-crab', draw: stickerHermitCrab },
  { id: 'closed-scissors', draw: stickerClosedScissors },
  { id: 'word-shell', draw: stickerWordShell },
  { id: 'diving-badge', draw: stickerDivingBadge },
  { id: 'coin-chest', draw: stickerCoinChest },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A miner-style helmet with a glowing lamp; the brim centre is (50, 50). */
function helmetLamp() {
  const s = scope('helmet-lamp');
  const dome = M(22, 52) + C(22, 30, 36, 20, 50, 20) + C(64, 20, 78, 30, 78, 52) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('dome'), '#ffcc4d', { light: 0.5, dark: 0.22 }),
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#fff6c0', 'stop-opacity': '0.95' }),
        h('stop', { offset: '1', 'stop-color': GLOW, 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 30, r: 22, fill: s.url('glow') }) +
    ink(ellipseD(50, 53, 34, 6), darken('#ffcc4d', 0.15)) +
    ink(dome, s.url('dome')) +
    line(M(50, 22) + L(50, 50), darken('#ffcc4d', 0.25), 2, { opacity: 0.7 }) +
    ink(roundRectD(42, 28, 16, 12, 4), '#5a6274', { 'stroke-width': SW * 0.5 }) +
    ink(circleD(50, 34, 4.4), '#fff6c0', { 'stroke-width': SW * 0.45 }) +
    gleam(M(30, 40) + Q(32, 31, 38, 26), 2)
  );
}

/** Round glasses with crescent-moon lenses; the bridge is (50, 50). */
function glassesMoon() {
  const s = scope('glasses-moon');
  const moon = (/** @type {number} */ cx) =>
    ink(
      M(cx + 3, 41) +
        C(cx - 9, 42, cx - 9, 58, cx + 3, 59) +
        C(cx - 3, 54, cx - 3, 46, cx + 3, 41) +
        Z,
      MOON,
      {
        'stroke-width': SW * 0.35,
      },
    );
  return (
    h(
      'defs',
      null,
      shade(s.id('lens'), '#3b3f8f', { light: 0.35, dark: 0.3 }),
      shade(s.id('frame'), '#c9b8f0', { light: 0.5, dark: 0.25 }),
    ) +
    tube(M(13, 48) + L(3, 45), '#c9b8f0', 3.2) +
    tube(M(87, 48) + L(97, 45), '#c9b8f0', 3.2) +
    tube(M(44, 49) + Q(50, 44, 56, 49), '#c9b8f0', 3.4) +
    ink(circleD(29, 50, 16), s.url('frame'), { 'stroke-width': SW }) +
    ink(circleD(71, 50, 16), s.url('frame'), { 'stroke-width': SW }) +
    h('path', { d: circleD(29, 50, 11.5) + circleD(71, 50, 11.5), fill: s.url('lens') }) +
    moon(29) +
    moon(71) +
    h('circle', { cx: 35, cy: 45, r: 1, fill: '#ffffff' }) +
    h('circle', { cx: 77, cy: 45, r: 1, fill: '#ffffff' })
  );
}

/** A glowing lantern made of a spiral shell, standing at the bottom. */
function lanternShell() {
  const s = scope('lantern-shell');
  return (
    h(
      'defs',
      null,
      shade(s.id('shell'), lighten(SHELL, 0.25), { light: 0.45, dark: 0.2 }),
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.9' }),
        h('stop', { offset: '1', 'stop-color': GLOW, 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 52, r: 40, fill: s.url('glow') }) +
    groundShadow(50, 93, 30, 4) +
    ink(roundRectD(40, 82, 20, 10, 3), '#5a5060') +
    line(M(50, 82) + L(50, 70), '#5a5060', 3) +
    ink(circleD(50, 48, 24), s.url('shell')) +
    line(spiral(51, 47, 18, 3), GLOW, 3, { 'stroke-linecap': 'round' }) +
    ink(circleD(50, 48, 6), '#fff6c0', { 'stroke-width': SW * 0.45 }) +
    g({ opacity: 0.9 }, sparkle(80, 22, 5), sparkle(20, 30, 4))
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const MOON_CAVES_COSMETICS = [
  { id: 'helmet-lamp', slot: 'head', draw: helmetLamp },
  { id: 'glasses-moon', slot: 'eyes', draw: glassesMoon },
  { id: 'lantern-shell', slot: 'grotto', draw: lanternShell },
];
