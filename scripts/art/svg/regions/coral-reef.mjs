// @ts-check
/**
 * Korálový útes (region 2): the eggs of Barakuda Bystřinka and Lachtan Lyžař, the region's
 * sticker icons and its cosmetics (docs/art.md §9). Each egg carries its friend's memory hook:
 * Barakuda's five dark bars and speed lines, Lachtan's two crossed skis over a wave.
 */
import { darken, lighten } from '../lib/color.mjs';
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
  smoothClosedD,
  smoothOpenD,
} from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { g, h } from '../lib/xml.mjs';
import { CREAM, INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const BARAKUDA = '#7fa6d6';
const LACHTAN = '#b07a52';
const SKI = '#e8513f';
const SHARK = '#7f95b6';

// ------------------------------------------------------------------------------------------- eggs

/** Barakuda Bystřinka: silver blue, a pearly lower half, five dark slanted bars, speed lines. */
function eggBarakuda() {
  const belly = M(0, 104) + C(36, 96, 84, 98, 120, 106) + L(120, 160) + L(0, 160) + Z;
  const bars = Array.from({ length: 5 }, (_, i) => {
    const x = 24 + i * 13;
    return M(x + 6, 50) + L(x + 11, 50) + L(x + 3, 94) + L(x - 2, 94) + Z;
  }).join('');
  const speed = [64, 76, 88].map((y, i) => M(88 + i * 2, y) + L(102 - i * 2, y)).join('');
  return (
    h('path', { d: belly, fill: '#eef3fa' }) +
    line(M(0, 104) + C(36, 96, 84, 98, 120, 106), INK, SW * 0.8, { opacity: 0.8 }) +
    h('path', { d: bars, fill: darken(BARAKUDA, 0.28), opacity: 0.85 }) +
    line(speed, '#ffffff', SW * 1.1, { 'stroke-linecap': 'round', opacity: 0.95 })
  );
}

/** Lachtan Lyžař: warm sea-lion brown, two red skis crossed over a foamy teal wave. */
function eggLachtan() {
  const wave = M(0, 118) + C(26, 104, 46, 128, 70, 114) + C(90, 102, 106, 118, 120, 110);
  const sea = wave + L(120, 160) + L(0, 160) + Z;
  const ski = (/** @type {number} */ k) =>
    g(
      { transform: `rotate(${k * 28} 60 82)` },
      ink(roundRectD(20, 77.5, 80, 9, 4.5), SKI, { 'stroke-width': SW * 0.75 }),
      ink(M(96, 78) + Q(108, 76, 104, 66), 'none', { 'stroke-width': SW * 1.6 }),
      line(M(97, 78.5) + Q(106.5, 77, 103.4, 68), SKI, SW * 0.8),
    );
  return (
    h('path', { d: sea, fill: '#3fb2c4' }) +
    line(wave, '#ffffff', 5, { opacity: 0.85 }) +
    line(wave, INK, SW * 0.7, { opacity: 0.7 }) +
    ski(-1) +
    ski(1)
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const CORAL_REEF_EGGS = [
  { id: 'barakuda-bystrinka', base: BARAKUDA, motif: eggBarakuda },
  { id: 'lachtan-lyzar', base: LACHTAN, motif: eggLachtan },
];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerBarakuda() {
  const s = scope('sticker-barakuda');
  const cy = 52;
  const body = smoothClosedD(
    [
      { x: 14, y: cy },
      { x: 28, y: cy - 12 },
      { x: 58, y: cy - 9 },
      { x: 70, y: cy },
      { x: 58, y: cy + 9 },
      { x: 28, y: cy + 12 },
    ],
    0.9,
  );
  const fin = M(66, cy) + L(84, cy - 13) + L(79, cy) + L(84, cy + 13) + Z;
  const bars = Array.from({ length: 5 }, (_, i) => {
    const x = 34 + i * 7;
    return M(x, 42) + L(x + 3.4, 42) + L(x + 0.6, 56) + L(x - 2.8, 56) + Z;
  }).join('');
  return (
    h('defs', null, shade(s.id('fish'), BARAKUDA, { light: 0.55, dark: 0.15 })) +
    ink(fin, darken(BARAKUDA, 0.12)) +
    ink(body, s.url('fish')) +
    h('path', { d: bars, fill: darken(BARAKUDA, 0.4) }) +
    h('path', { d: M(16, 54) + Q(40, 62, 66, 55) + Q(40, 58, 16, 54) + Z, fill: '#eef3fa' }) +
    h('circle', {
      cx: 24,
      cy: 49,
      r: 3.4,
      fill: '#ffffff',
      stroke: INK,
      'stroke-width': SW * 0.4,
    }) +
    h('circle', { cx: 24.6, cy: 49.4, r: 1.7, fill: INK }) +
    line(M(17.5, 56) + Q(20, 58, 23, 56.5), INK, SW * 0.45) +
    line(M(22, 30) + L(34, 30) + M(18, 72) + L(30, 72), '#ffffff', SW * 0.9, { opacity: 0.9 }) +
    gleam(M(30, 44) + Q(36, 41, 44, 41), 1.8)
  );
}

function stickerSkis() {
  const pole = (/** @type {number} */ k) =>
    g(
      { transform: `rotate(${k * 24} 50 52)` },
      line(M(50, 18) + L(50, 82), INK, SW * 1.25),
      line(M(50, 18) + L(50, 82), '#c7ccd8', SW * 0.55),
      ink(ellipseD(50, 76, 7, 2.4), '#5a6274', { 'stroke-width': SW * 0.5 }),
      ink(roundRectD(47.2, 15, 5.6, 9, 2.4), '#2f3a55', { 'stroke-width': SW * 0.45 }),
    );
  const ski = (/** @type {number} */ k) =>
    g(
      { transform: `rotate(${k * 34} 50 54)` },
      ink(roundRectD(17, 50, 62, 8, 4), SKI, { 'stroke-width': SW * 0.75 }),
      ink(M(76, 51) + Q(88, 49, 85, 40), 'none', { 'stroke-width': SW * 1.5 }),
      line(M(77, 51.6) + Q(86.4, 50, 84, 42), SKI, SW * 0.7),
      line(M(22, 54) + L(70, 54), lighten(SKI, 0.45), 1.2, { opacity: 0.8 }),
    );
  return pole(-1) + pole(1) + ski(-1) + ski(1) + sparkle(78, 24, 5);
}

function stickerSharkSmile() {
  const s = scope('sticker-shark-smile');
  const head = smoothClosedD(
    [
      { x: 16, y: 58 },
      { x: 26, y: 36 },
      { x: 52, y: 28 },
      { x: 78, y: 38 },
      { x: 84, y: 60 },
      { x: 64, y: 76 },
      { x: 34, y: 76 },
    ],
    0.85,
  );
  const fin = M(44, 32) + L(56, 16) + Q(60, 24, 64, 33) + Z;
  const belly =
    M(18, 60) +
    C(32, 66, 68, 70, 82, 62) +
    C(76, 72, 60, 78, 46, 77) +
    C(30, 76, 20, 68, 18, 60) +
    Z;
  const teeth = [0, 1, 2, 3, 4]
    .map((i) =>
      ink(roundRectD(31 + i * 8.5, 63.5 + (i === 2 ? 1.2 : 0), 5.6, 5.2, 2), '#ffffff', {
        'stroke-width': SW * 0.35,
      }),
    )
    .join('');
  return (
    h('defs', null, shade(s.id('shark'), SHARK, { light: 0.5, dark: 0.15 })) +
    ink(fin, darken(SHARK, 0.1)) +
    ink(head, s.url('shark')) +
    h('path', { d: belly, fill: '#f3f5f8' }) +
    line(M(24, 61) + C(36, 70, 60, 72, 78, 64), INK, SW * 0.7) +
    teeth +
    h('circle', { cx: 34, cy: 47, r: 5, fill: '#ffffff', stroke: INK, 'stroke-width': SW * 0.45 }) +
    h('circle', { cx: 35, cy: 47.6, r: 2.6, fill: INK }) +
    h('circle', { cx: 34, cy: 46.4, r: 0.9, fill: '#ffffff' }) +
    h('ellipse', { cx: 26, cy: 57, rx: 4.4, ry: 2.8, fill: '#ff9db0', opacity: 0.8 }) +
    line(M(66, 46) + Q(68, 52, 66, 58) + M(72, 46) + Q(74, 52, 72, 58), INK, SW * 0.5, {
      opacity: 0.8,
    }) +
    gleam(M(36, 35) + Q(44, 31, 52, 31), 2) +
    sparkle(80, 24, 5)
  );
}

function stickerStarCoral() {
  const s = scope('sticker-star-coral');
  const mound =
    M(16, 76) + C(14, 50, 30, 30, 50, 30) + C(70, 30, 86, 50, 84, 76) + Q(50, 84, 16, 76) + Z;
  /** @type {[number, number][]} */
  const polyps = [
    [32, 52],
    [50, 44],
    [68, 52],
    [40, 66],
    [60, 66],
    [25, 67],
    [75, 67],
  ];
  return (
    h('defs', null, shade(s.id('coral'), '#ff8f7a', { light: 0.45, dark: 0.18 })) +
    ink(mound, s.url('coral')) +
    polyps
      .map(
        ([x, y]) =>
          ink(roundStarD(x, y, 5, 6.4, 2.8, -90, 0.25), '#ffe58a', { 'stroke-width': SW * 0.4 }) +
          h('circle', { cx: x, cy: y, r: 1.4, fill: '#ff8f7a' }),
      )
      .join('') +
    gleam(M(26, 44) + Q(32, 37, 40, 35), 2)
  );
}

function stickerStopwatch() {
  const s = scope('sticker-stopwatch');
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    const p = polar(50, 56, 21, a);
    const q = polar(50, 56, i % 3 === 0 ? 16.5 : 18.5, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  const hand = polar(50, 56, 15, 60);
  return (
    h('defs', null, shade(s.id('case'), '#ffd166', { light: 0.5, dark: 0.2 })) +
    ink(roundRectD(44, 16, 12, 9, 2.5), '#ffd166', { 'stroke-width': SW * 0.6 }) +
    ink(roundRectD(68, 24, 8, 7, 2), '#ffd166', {
      'stroke-width': SW * 0.55,
      transform: 'rotate(40 72 27)',
    }) +
    ink(circleD(50, 56, 28), s.url('case')) +
    ink(circleD(50, 56, 22.5), CREAM, { 'stroke-width': SW * 0.6 }) +
    line(ticks, INK, SW * 0.5) +
    line(M(50, 56) + L(hand.x, hand.y), '#e8513f', SW * 0.9) +
    line(M(50, 56) + L(50, 41), INK, SW * 0.7) +
    h('circle', { cx: 50, cy: 56, r: 2.6, fill: INK }) +
    gleam(M(33, 45) + Q(37, 39, 43, 37), 2)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const CORAL_REEF_STICKERS = [
  { id: 'barakuda', draw: stickerBarakuda },
  { id: 'skis', draw: stickerSkis },
  { id: 'shark-smile', draw: stickerSharkSmile },
  { id: 'star-coral', draw: stickerStarCoral },
  { id: 'stopwatch', draw: stickerStopwatch },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A golden crown band with five pink coral branches and pearls; its base centre is (50, 50). */
function crownCoral() {
  const s = scope('crown-coral');
  const band = M(24, 44) + Q(50, 40, 76, 44) + L(78, 56) + Q(50, 61, 22, 56) + Z;
  const branches = [-2, -1, 0, 1, 2]
    .map((k) => {
      const base = { x: 50 + k * 12.5, y: 44 - Math.abs(k) * 0.8 };
      const tall = k === 0 ? 30 : Math.abs(k) === 1 ? 24 : 18;
      const top = polar(base.x, base.y, tall, -90 + k * 9);
      const mid = polar(base.x, base.y, tall * 0.5, -90 + k * 9);
      const left = polar(mid.x, mid.y, tall * 0.42, -140 + k * 9);
      const right = polar(mid.x, mid.y - tall * 0.12, tall * 0.36, -42 + k * 9);
      return (
        tube(smoothOpenD([base, mid, top], 1), '#ff7aa2', 4.4) +
        tube(M(mid.x, mid.y) + L(left.x, left.y), '#ff7aa2', 3.4) +
        tube(M(mid.x, mid.y - tall * 0.12) + L(right.x, right.y), '#ff7aa2', 3) +
        h('circle', {
          cx: top.x,
          cy: top.y,
          r: 2.8,
          fill: '#ffe1ec',
          stroke: INK,
          'stroke-width': SW * 0.4,
        })
      );
    })
    .join('');
  const pearls = [-2, -1, 0, 1, 2]
    .map((k) =>
      h('circle', {
        cx: 50 + k * 12.5,
        cy: 51 + Math.abs(k) * 0.5,
        r: 2.7,
        fill: '#fffaf0',
        stroke: INK,
        'stroke-width': SW * 0.4,
      }),
    )
    .join('');
  return (
    h('defs', null, shade(s.id('gold'), '#ffcc4d', { light: 0.55, dark: 0.22 })) +
    branches +
    ink(band, s.url('gold')) +
    pearls +
    gleam(M(28, 47) + Q(38, 44.5, 46, 44), 1.8)
  );
}

/** A diving mask with a snorkel on its right side; the bridge between the lenses is (50, 50). */
function maskSnorkel() {
  const s = scope('mask-snorkel');
  const frame =
    M(14, 40) +
    C(14, 34, 20, 32, 30, 32) +
    L(70, 32) +
    C(80, 32, 86, 34, 86, 40) +
    L(86, 58) +
    C(86, 66, 80, 68, 72, 68) +
    C(62, 68, 58, 60, 50, 60) +
    C(42, 60, 38, 68, 28, 68) +
    C(20, 68, 14, 66, 14, 58) +
    Z;
  const lens = (/** @type {number} */ k) => {
    const x = 50 + k * 18;
    return (
      M(x - 14, 40) +
      C(x - 14, 37, x - 11, 36, x - 8, 36) +
      L(x + 8, 36) +
      C(x + 11, 36, x + 14, 37, x + 14, 40) +
      L(x + 14, 54) +
      C(x + 14, 59, x + 10, 61, x + 6, 61) +
      C(x - 1, 61, x - 3, 57, x - 7, 57) +
      L(x - 10, 57) +
      C(x - 13, 57, x - 14, 55, x - 14, 52) +
      Z
    );
  };
  return (
    h(
      'defs',
      null,
      shade(s.id('frame'), '#2bb3c0', { light: 0.5, dark: 0.2 }),
      shade(s.id('glass'), '#bfeff5', { light: 0.7, dark: 0.05 }),
    ) +
    tube(M(86, 50) + Q(94, 50, 92, 42), '#2bb3c0', 4) +
    tube(M(92, 64) + L(92, 22) + Q(92, 13, 84, 13), '#ffb03a', 7) +
    ink(roundRectD(78, 10, 8, 6, 2.5), '#ff6f61', { 'stroke-width': SW * 0.5 }) +
    ink(frame, s.url('frame')) +
    ink(lens(-1) + lens(1), s.url('glass'), { 'stroke-width': SW * 0.6 }) +
    gleam(M(26, 41) + L(31, 39), 2.2) +
    gleam(M(62, 41) + L(67, 39), 2.2)
  );
}

/** A coral arch for the grotto, standing on its spot with its feet at the bottom. */
function archCoral() {
  const s = scope('arch-coral');
  const arch =
    M(12, 92) +
    C(10, 50, 26, 18, 50, 18) +
    C(74, 18, 90, 50, 88, 92) +
    L(70, 92) +
    C(70, 62, 62, 44, 50, 44) +
    C(38, 44, 30, 62, 30, 92) +
    Z;
  /** @type {[number, number, number, string][]} */
  const knobs = [
    [16, 64, 6, '#ffb15c'],
    [24, 40, 7, '#ff8fb1'],
    [38, 25, 6, '#ffd166'],
    [62, 24, 7, '#ff8fb1'],
    [76, 38, 6, '#ffb15c'],
    [84, 62, 7, '#b892ff'],
    [22, 82, 5, '#b892ff'],
    [80, 84, 5, '#ffd166'],
  ];
  return (
    h('defs', null, shade(s.id('arch'), '#ff7c6e', { light: 0.45, dark: 0.2 })) +
    groundShadow(50, 94, 42, 4) +
    ink(arch, s.url('arch')) +
    knobs.map(([x, y, r, c]) => ink(circleD(x, y, r), c, { 'stroke-width': SW * 0.5 })).join('') +
    line(M(30, 74) + Q(36, 70, 34, 64) + M(70, 74) + Q(64, 70, 66, 64), '#ffd0c4', 2, {
      opacity: 0.8,
    }) +
    gleam(M(22, 56) + Q(26, 38, 38, 28), 2.4)
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const CORAL_REEF_COSMETICS = [
  { id: 'crown-coral', slot: 'head', draw: crownCoral },
  { id: 'mask-snorkel', slot: 'eyes', draw: maskSnorkel },
  { id: 'arch-coral', slot: 'grotto', draw: archCoral },
];
