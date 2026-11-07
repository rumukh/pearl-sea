// @ts-check
/**
 * Potopené město (region 9, grade 4): the egg of Štítovec Přísavka, the region's sticker icons and
 * its cosmetics (docs/art.md §9). Přísavka's egg carries her memory hook: the ridged suction disc
 * that sticks to a shark like a prefix sticks to its word.
 */
import { darken } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const REMORA = '#5f9aa3';
const JELLY = '#96d2be';
const STONE = '#b4b8b0';
const GOLD = '#e0b04a';

// ------------------------------------------------------------------------------------------- eggs

/** Štítovec Přísavka: grey-teal, a pale belly, a dark side stripe and a ridged suction disc. */
function eggPrisavka() {
  const disc = ellipseD(60, 40, 30, 14);
  const ridges = Array.from({ length: 8 }, (_, i) => M(36 + i * 7, 31) + L(37 + i * 7, 49)).join(
    '',
  );
  return (
    h('path', {
      d: M(0, 112) + C(36, 104, 84, 106, 120, 114) + L(120, 160) + L(0, 160) + Z,
      fill: '#e2ece8',
    }) +
    h('path', {
      d: M(0, 92) + L(120, 92) + L(120, 102) + L(0, 102) + Z,
      fill: darken(REMORA, 0.4),
    }) +
    ink(disc, '#a8cfd2', { 'stroke-width': SW * 0.6 }) +
    line(ridges, INK, 1.4, { opacity: 0.8 })
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const SUNKEN_CITY_EGGS = [{ id: 'stitovec-prisavka', base: REMORA, motif: eggPrisavka }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerRemora() {
  const s = scope('sticker-remora');
  const body =
    M(16, 54) +
    C(24, 44, 46, 42, 66, 46) +
    L(72, 48) +
    C(70, 54, 68, 60, 60, 62) +
    C(42, 66, 24, 62, 16, 54) +
    Z;
  return (
    h('defs', null, shade(s.id('body'), REMORA, { light: 0.45, dark: 0.15 })) +
    ink(M(70, 54) + L(84, 44) + L(80, 54) + L(84, 64) + Z, darken(REMORA, 0.1), {
      'stroke-width': SW * 0.5,
    }) +
    ink(body, s.url('body')) +
    line(M(24, 56) + L(66, 55), darken(REMORA, 0.45), 2.4) +
    ink(ellipseD(36, 42, 14, 5), '#a8cfd2', { 'stroke-width': SW * 0.45 }) +
    line(
      Array.from({ length: 6 }, (_, i) => M(26 + i * 4, 39) + L(26.4 + i * 4, 45)).join(''),
      INK,
      0.8,
    ) +
    h('circle', {
      cx: 24,
      cy: 52,
      r: 2.6,
      fill: '#ffffff',
      stroke: INK,
      'stroke-width': SW * 0.35,
    }) +
    h('circle', { cx: 23.6, cy: 52.4, r: 1.3, fill: INK }) +
    line(M(17, 57) + Q(20, 59, 23, 58), INK, SW * 0.4) +
    sparkle(76, 28, 5)
  );
}

function stickerFreeJellyfish() {
  const s = scope('sticker-free-jellyfish');
  const bell =
    M(28, 48) +
    C(28, 28, 72, 28, 72, 48) +
    Q(66, 52, 60, 48) +
    Q(55, 53, 50, 48) +
    Q(45, 53, 40, 48) +
    Q(34, 52, 28, 48) +
    Z;
  const legs = [34, 42, 50, 58, 66]
    .map((x, i) => M(x, 50) + Q(x + (i % 2 ? 4 : -4), 62, x, 76))
    .join('');
  return (
    h('defs', null, shade(s.id('bell'), JELLY, { light: 0.5, dark: 0.15 })) +
    line(legs, darken(JELLY, 0.2), 3.2, { 'stroke-linecap': 'round' }) +
    ink(bell, s.url('bell')) +
    h('circle', { cx: 43, cy: 40, r: 2.4, fill: INK }) +
    h('circle', { cx: 57, cy: 40, r: 2.4, fill: INK }) +
    line(M(45, 45) + Q(50, 49, 55, 45), INK, SW * 0.45) +
    gleam(M(36, 34) + Q(40, 30, 46, 29), 1.8) +
    sparkle(76, 26, 5) +
    sparkle(24, 70, 4)
  );
}

function stickerTwoWords() {
  return (
    ink(roundRectD(16, 38, 30, 20, 6), '#ffd166', { 'stroke-width': SW * 0.6 }) +
    ink(roundRectD(54, 38, 30, 20, 6), '#8fd3ff', { 'stroke-width': SW * 0.6 }) +
    line(M(22, 46) + L(40, 46) + M(22, 51) + L(34, 51), darken('#ffd166', 0.45), 1.8) +
    line(M(60, 46) + L(78, 46) + M(60, 51) + L(72, 51), darken('#8fd3ff', 0.45), 1.8) +
    line(M(47, 48) + L(53, 48), INK, 1.6, { 'stroke-dasharray': '1.6 1.8' }) +
    ink(roundStarD(50, 70, 5, 6, 2.8, -90, 0.25), '#fff6c8', { 'stroke-width': SW * 0.45 })
  );
}

function stickerCalendarShell() {
  const s = scope('sticker-calendar-shell');
  const fan = M(28, 70) + C(28, 40, 72, 40, 72, 70) + Q(50, 76, 28, 70) + Z;
  return (
    h('defs', null, shade(s.id('shell'), '#ffd9cc', { light: 0.45, dark: 0.18 })) +
    ink(fan, s.url('shell')) +
    line(
      [34, 42, 50, 58, 66].map((x) => M(50, 72) + L(x, 46 + Math.abs(x - 50) * 0.25)).join(''),
      darken('#ffd9cc', 0.3),
      1.4,
    ) +
    ink(roundRectD(34, 20, 32, 22, 4), '#ffffff', { 'stroke-width': SW * 0.5 }) +
    ink(roundRectD(34, 20, 32, 7, 3), '#00897b', { 'stroke-width': SW * 0.45 }) +
    line(M(40, 33) + L(60, 33) + M(40, 37) + L(54, 37), INK, 1.2, { opacity: 0.6 }) +
    sparkle(78, 30, 5)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const SUNKEN_CITY_STICKERS = [
  { id: 'remora', draw: stickerRemora },
  { id: 'free-jellyfish', draw: stickerFreeJellyfish },
  { id: 'two-words', draw: stickerTwoWords },
  { id: 'calendar-shell', draw: stickerCalendarShell },
];

// -------------------------------------------------------------------------------------- cosmetics

/** An old brass diving helmet with a round window; worn on the head, the brim centre is (50, 50). */
function helmetDiver() {
  const s = scope('helmet-diver');
  return (
    h(
      'defs',
      null,
      shade(s.id('brass'), GOLD, { light: 0.5, dark: 0.25 }),
      shade(s.id('glass'), '#bfeff5', { light: 0.6, dark: 0.1 }),
    ) +
    ink(roundRectD(24, 46, 52, 10, 4), darken(GOLD, 0.15)) +
    ink(M(28, 48) + C(26, 24, 40, 12, 50, 12) + C(60, 12, 74, 24, 72, 48) + Z, s.url('brass')) +
    ink(circleD(50, 32, 11), s.url('glass'), { 'stroke-width': SW * 0.7 }) +
    [0, 90, 180, 270]
      .map((a) => {
        const r = (a * Math.PI) / 180;
        return h('circle', {
          cx: 50 + 14.5 * Math.cos(r),
          cy: 32 + 14.5 * Math.sin(r),
          r: 1.6,
          fill: INK,
        });
      })
      .join('') +
    ink(circleD(50, 10, 3.4), darken(GOLD, 0.1), { 'stroke-width': SW * 0.45 }) +
    gleam(M(32, 36) + Q(34, 26, 40, 20), 2) +
    gleam(M(45, 28) + L(48, 25), 1.8)
  );
}

/** A gold monocle on a chain over the right eye; the bridge is (50, 50). */
function monocleGold() {
  const s = scope('monocle-gold');
  return (
    h('defs', null, shade(s.id('lens'), '#e6f6ff', { light: 0.6, dark: 0.1 })) +
    line(M(84, 58) + Q(88, 72, 76, 84) + Q(66, 92, 58, 86), GOLD, 1.6, {
      'stroke-dasharray': '2 1.6',
    }) +
    ink(circleD(70, 50, 15), GOLD, { 'stroke-width': SW }) +
    h('path', { d: circleD(70, 50, 11), fill: s.url('lens') }) +
    gleam(M(64, 47) + Q(65, 43, 69, 42), 2) +
    ink(circleD(57, 86, 2.6), GOLD, { 'stroke-width': SW * 0.4 })
  );
}

/** A broken stone statue of a seahorse on a plinth, standing at the bottom. */
function statueCity() {
  const s = scope('statue-city');
  return (
    h('defs', null, shade(s.id('stone'), STONE, { light: 0.4, dark: 0.22 })) +
    groundShadow(50, 94, 32, 4) +
    ink(roundRectD(30, 78, 40, 14, 3), s.url('stone')) +
    ink(roundRectD(34, 72, 32, 8, 2), s.url('stone')) +
    tube(M(50, 72) + Q(42, 62, 48, 52) + Q(54, 42, 46, 32) + Q(40, 26, 46, 20), STONE, 10) +
    ink(M(46, 22) + L(62, 18) + L(62, 26) + L(48, 28) + Z, s.url('stone')) +
    ink(circleD(44, 22, 7), s.url('stone')) +
    line(M(42, 56) + L(36, 62), darken(STONE, 0.3), 1.6) +
    tube(M(60, 72) + Q(66, 64, 62, 56), '#3fa36e', 3) +
    tube(M(38, 72) + Q(32, 62, 36, 54), '#3fa36e', 3) +
    gleam(M(40, 40) + Q(41, 34, 44, 30), 1.8)
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const SUNKEN_CITY_COSMETICS = [
  { id: 'helmet-diver', slot: 'head', draw: helmetDiver },
  { id: 'monocle-gold', slot: 'eyes', draw: monocleGold },
  { id: 'statue-city', slot: 'grotto', draw: statueCity },
];
