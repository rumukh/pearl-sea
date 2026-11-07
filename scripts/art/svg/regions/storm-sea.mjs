// @ts-check
/**
 * Bouřlivé moře (region 11, grade 4): the region's sticker icons and cosmetics (docs/art.md §9).
 * The region has no new friend (Delfín Skokánek grows up here), so no egg.
 */
import { darken } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, roundRectD, roundStarD } from '../lib/path.mjs';
import { g, h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const DOLPHIN = '#6ea6d8';
const RAIN = '#ffd166';
const SLATE = '#546e7a';

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const STORM_SEA_EGGS = [];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerBigDolphin() {
  const s = scope('sticker-big-dolphin');
  const body =
    M(18, 64) +
    C(20, 40, 46, 26, 70, 34) +
    L(84, 38) +
    Q(86, 42, 82, 44) +
    L(72, 44) +
    C(54, 44, 36, 56, 28, 72) +
    Z;
  return g(
    { transform: 'translate(50 50) scale(0.84) translate(-50 -50)' },
    h('defs', null, shade(s.id('body'), DOLPHIN, { light: 0.45, dark: 0.18 })) +
      ink(M(18, 64) + L(10, 74) + Q(18, 72, 22, 70) + Q(26, 74, 32, 76) + Z, darken(DOLPHIN, 0.1), {
        'stroke-width': SW * 0.5,
      }) +
      ink(M(48, 32) + Q(46, 20, 54, 16) + Q(56, 24, 58, 31) + Z, darken(DOLPHIN, 0.1), {
        'stroke-width': SW * 0.5,
      }) +
      ink(body, s.url('body')) +
      h('path', {
        d: M(30, 62) + C(38, 48, 54, 42, 72, 44) + C(56, 46, 42, 54, 34, 68) + Z,
        fill: '#eaf4fc',
      }) +
      h('circle', { cx: 70, cy: 39, r: 2, fill: INK }) +
      line(M(76, 42) + Q(80, 44.5, 84, 42.5), INK, SW * 0.4) +
      ink(roundStarD(30, 30, 5, 7, 3.2, -90, 0.25), '#ffd166', { 'stroke-width': SW * 0.45 }),
  );
}

function stickerCalmEddy() {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * 2.5 * 2 * Math.PI;
    const r = 30 * (1 - i / 66);
    d += (i ? L : M)(50 + r * Math.cos(a), 52 + r * 0.6 * Math.sin(a));
  }
  return (
    line(d, INK, 6, { 'stroke-linecap': 'round' }) +
    line(d, '#bfe9ff', 3, { 'stroke-linecap': 'round' }) +
    ink(roundRectD(36, 70, 28, 6, 3), '#eaf4fc', { 'stroke-width': SW * 0.4 }) +
    sparkle(78, 28, 5)
  );
}

function stickerTwoScrolls() {
  const scroll = (/** @type {number} */ x, /** @type {string} */ c) =>
    ink(roundRectD(x, 30, 26, 40, 3), '#f6e2b8', { 'stroke-width': SW * 0.6 }) +
    ink(roundRectD(x - 3, 26, 32, 7, 3.5), c, { 'stroke-width': SW * 0.5 }) +
    ink(roundRectD(x - 3, 67, 32, 7, 3.5), c, { 'stroke-width': SW * 0.5 }) +
    line(
      M(x + 5, 42) + L(x + 21, 42) + M(x + 5, 50) + L(x + 18, 50) + M(x + 5, 58) + L(x + 20, 58),
      darken('#d8b26e', 0.35),
      1.6,
    );
  return scroll(20, '#90a4ae') + scroll(54, '#ff9db0');
}

function stickerInkSplash() {
  const s = scope('sticker-ink-splash');
  const splat =
    M(50, 26) +
    C(62, 24, 60, 38, 70, 38) +
    C(80, 38, 78, 52, 72, 56) +
    C(78, 64, 70, 74, 60, 70) +
    C(56, 78, 44, 78, 40, 70) +
    C(28, 74, 22, 62, 30, 56) +
    C(22, 48, 28, 38, 38, 40) +
    C(38, 30, 44, 26, 50, 26) +
    Z;
  return (
    h('defs', null, shade(s.id('ink'), '#3a2a5a', { light: 0.4, dark: 0.2 })) +
    ink(splat, s.url('ink')) +
    h('circle', { cx: 44, cy: 50, r: 3, fill: '#ffffff' }) +
    h('circle', { cx: 56, cy: 50, r: 3, fill: '#ffffff' }) +
    h('circle', { cx: 44.6, cy: 50.6, r: 1.5, fill: INK }) +
    h('circle', { cx: 56.6, cy: 50.6, r: 1.5, fill: INK }) +
    ink(circleD(78, 72, 3), '#3a2a5a', { 'stroke-width': SW * 0.4 }) +
    ink(circleD(22, 34, 2.4), '#3a2a5a', { 'stroke-width': SW * 0.4 }) +
    gleam(M(40, 34) + Q(44, 30, 50, 30), 1.6)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const STORM_SEA_STICKERS = [
  { id: 'big-dolphin', draw: stickerBigDolphin },
  { id: 'calm-eddy', draw: stickerCalmEddy },
  { id: 'two-scrolls', draw: stickerTwoScrolls },
  { id: 'ink-splash', draw: stickerInkSplash },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A yellow sou'wester rain hat; the brim centre is (50, 50). */
function hatRain() {
  const s = scope('hat-rain');
  const brim =
    M(8, 50) + Q(50, 40, 92, 50) + Q(94, 62, 80, 64) + Q(50, 58, 20, 64) + Q(6, 62, 8, 50) + Z;
  const crown =
    M(26, 48) + C(26, 26, 38, 18, 50, 18) + C(62, 18, 74, 26, 74, 48) + Q(50, 52, 26, 48) + Z;
  return (
    h('defs', null, shade(s.id('hat'), RAIN, { light: 0.5, dark: 0.22 })) +
    ink(brim, s.url('hat')) +
    ink(crown, s.url('hat')) +
    line(M(30, 36) + Q(50, 40, 70, 36), darken(RAIN, 0.25), 1.4, { opacity: 0.8 }) +
    gleam(M(32, 40) + Q(34, 30, 42, 24), 2)
  );
}

/** Storm goggles with grey-blue lenses and raindrops; the bridge is (50, 50). */
function gogglesStorm() {
  const s = scope('goggles-storm');
  return (
    h(
      'defs',
      null,
      shade(s.id('frame'), SLATE, { light: 0.4, dark: 0.25 }),
      shade(s.id('lens'), '#90b4d0', { light: 0.5, dark: 0.2 }),
    ) +
    tube(M(12, 50) + L(3, 47), '#37474f', 4.4) +
    tube(M(88, 50) + L(97, 47), '#37474f', 4.4) +
    tube(M(44, 50) + L(56, 50), SLATE, 4) +
    ink(roundRectD(13, 36, 32, 28, 10), s.url('frame')) +
    ink(roundRectD(55, 36, 32, 28, 10), s.url('frame')) +
    h('path', {
      d: roundRectD(17, 40, 24, 20, 7) + roundRectD(59, 40, 24, 20, 7),
      fill: s.url('lens'),
    }) +
    [
      [24, 46],
      [34, 54],
      [66, 46],
      [76, 54],
    ]
      .map(([x, y]) =>
        ink(
          M(x ?? 0, (y ?? 0) - 3) +
            Q((x ?? 0) + 3, y ?? 0, x ?? 0, (y ?? 0) + 3) +
            Q((x ?? 0) - 3, y ?? 0, x ?? 0, (y ?? 0) - 3) +
            Z,
          '#e6f6ff',
          { 'stroke-width': SW * 0.3 },
        ),
      )
      .join('')
  );
}

/** A small model lighthouse on a rock, standing at the bottom. */
function lighthouseModel() {
  const s = scope('lighthouse-model');
  return (
    h(
      'defs',
      null,
      shade(s.id('tower'), '#f4f0e8', { light: 0.4, dark: 0.18 }),
      h(
        'radialGradient',
        { id: s.id('beam') },
        h('stop', { offset: '0', 'stop-color': '#fff6c0', 'stop-opacity': '0.9' }),
        h('stop', { offset: '1', 'stop-color': '#fff6c0', 'stop-opacity': '0' }),
      ),
    ) +
    h('circle', { cx: 50, cy: 22, r: 22, fill: s.url('beam') }) +
    groundShadow(50, 94, 36, 4) +
    ink(M(18, 92) + C(20, 78, 34, 74, 50, 76) + C(66, 74, 80, 78, 82, 92) + Z, '#6b6f78') +
    ink(M(38, 78) + L(42, 32) + L(58, 32) + L(62, 78) + Z, s.url('tower')) +
    h('path', {
      d:
        M(40, 64) +
        L(60, 64) +
        L(61, 72) +
        L(39, 72) +
        Z +
        M(41, 46) +
        L(59, 46) +
        L(60, 54) +
        L(40, 54) +
        Z,
      fill: '#e8513f',
    }) +
    ink(roundRectD(40, 22, 20, 10, 2), '#fff6c0', { 'stroke-width': SW * 0.5 }) +
    ink(M(38, 22) + L(62, 22) + L(50, 12) + Z, '#e8513f', { 'stroke-width': SW * 0.5 })
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const STORM_SEA_COSMETICS = [
  { id: 'hat-rain', slot: 'head', draw: hatRain },
  { id: 'goggles-storm', slot: 'eyes', draw: gogglesStorm },
  { id: 'lighthouse-model', slot: 'grotto', draw: lighthouseModel },
];
