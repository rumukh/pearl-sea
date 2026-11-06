// @ts-check
/**
 * Perlová zátoka (region 5): the egg of Hvězdice Rodinka, the region's sticker icons and its
 * cosmetics (docs/art.md §9). Hvězdice's egg carries her memory hook: five arms round one heart.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { g, h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const HVEZDICE = '#f7976a';
const HEART = '#f05a82';
const CLAM = '#b9a8d8';

/**
 * A heart centred at (x, y) with half-width r.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 */
function heartD(x, y, r) {
  return (
    M(x, y + r * 0.95) +
    C(x - r * 1.3, y + r * 0.1, x - r * 1.05, y - r * 0.95, x, y - r * 0.4) +
    C(x + r * 1.05, y - r * 0.95, x + r * 1.3, y + r * 0.1, x, y + r * 0.95) +
    Z
  );
}

/**
 * A shiny pearl.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {string} [fill]
 */
function pearl(x, y, r, fill = '#fffaf0') {
  return (
    ink(circleD(x, y, r), fill, { 'stroke-width': SW * Math.min(0.5, r / 8) }) +
    h('circle', { cx: x - r * 0.35, cy: y - r * 0.35, r: r * 0.3, fill: '#ffffff' })
  );
}

// ------------------------------------------------------------------------------------------- eggs

/** Hvězdice Rodinka: coral orange, a pale five-armed star round one pink heart. */
function eggHvezdice() {
  return (
    ink(roundStarD(60, 82, 5, 40, 17, -90, 0.35), '#fde0c8', { 'stroke-width': SW * 0.7 }) +
    [0, 1, 2, 3, 4]
      .map((k) => {
        const p = polar(60, 82, 27, -90 + k * 72);
        return h('circle', { cx: p.x, cy: p.y, r: 2.6, fill: HVEZDICE });
      })
      .join('') +
    ink(heartD(60, 83, 10), HEART, { 'stroke-width': SW * 0.6 })
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const PEARL_BAY_EGGS = [{ id: 'hvezdice-rodinka', base: HVEZDICE, motif: eggHvezdice }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerStarfish() {
  const s = scope('sticker-starfish');
  return (
    h('defs', null, shade(s.id('star'), HVEZDICE, { light: 0.45, dark: 0.18 })) +
    ink(roundStarD(50, 53, 5, 33, 15, -90, 0.42), s.url('star')) +
    [0, 1, 2, 3, 4]
      .map((k) =>
        [17, 24]
          .map((r) => {
            const p = polar(50, 53, r, -90 + k * 72);
            return h('circle', { cx: p.x, cy: p.y, r: 1.6, fill: '#fde0c8' });
          })
          .join(''),
      )
      .join('') +
    ink(heartD(50, 58, 7), HEART, { 'stroke-width': SW * 0.5 }) +
    h('circle', { cx: 45, cy: 45, r: 2.6, fill: INK }) +
    h('circle', { cx: 55, cy: 45, r: 2.6, fill: INK }) +
    h('circle', { cx: 44.3, cy: 44.2, r: 0.9, fill: '#ffffff' }) +
    h('circle', { cx: 54.3, cy: 44.2, r: 0.9, fill: '#ffffff' }) +
    gleam(M(44, 28) + L(47, 22), 1.6)
  );
}

function stickerOpenClam() {
  const s = scope('sticker-open-clam');
  const zig = Array.from({ length: 11 }, (_, i) => ({ x: 18 + i * 6.4, y: i % 2 ? 54 : 50 }));
  const edge = zig.map((p, i) => (i ? L(p.x, p.y) : M(p.x, p.y))).join('');
  const lower = edge + L(82, 52) + C(82, 70, 66, 80, 50, 80) + C(34, 80, 18, 70, 18, 52) + Z;
  const upper =
    zig.map((p, i) => (i ? L(p.x, p.y - 22) : M(p.x, p.y - 22))).join('') +
    L(82, 30) +
    C(80, 20, 66, 14, 50, 14) +
    C(34, 14, 20, 20, 18, 30) +
    Z;
  const ribs = [30, 40, 50, 60, 70]
    .map((x) => M(x, 58) + L(50 + (x - 50) * 0.5, 78) + M(x, 26) + L(50 + (x - 50) * 0.5, 16))
    .join('');
  return (
    h('defs', null, shade(s.id('shell'), CLAM, { light: 0.45, dark: 0.2 })) +
    h('path', { d: M(20, 32) + L(80, 32) + L(80, 50) + L(20, 50) + Z, fill: '#7fa4e0' }) +
    h('circle', { cx: 40, cy: 40, r: 3, fill: INK }) +
    h('circle', { cx: 60, cy: 40, r: 3, fill: INK }) +
    line(M(44, 45) + Q(50, 49, 56, 45), INK, SW * 0.45) +
    ink(lower, s.url('shell')) +
    ink(upper, s.url('shell')) +
    line(ribs, darken(CLAM, 0.25), 1.2, { opacity: 0.7 }) +
    pearl(50, 62, 9) +
    sparkle(76, 25, 5)
  );
}

function stickerSilverPearls() {
  /** @type {[number, number, number][]} */
  const pile = [
    [32, 66, 9],
    [50, 66, 10],
    [68, 66, 9],
    [41, 50, 9],
    [59, 50, 9],
    [50, 34, 9],
  ];
  return (
    ink(ellipseD(50, 74, 32, 7), '#8d9db6', { 'stroke-width': SW * 0.5 }) +
    pile.map(([x, y, r]) => pearl(x, y, r, '#dfe6f0')).join('') +
    sparkle(76, 28, 6) +
    sparkle(24, 34, 4)
  );
}

function stickerScroll() {
  const s = scope('sticker-scroll');
  const lines = [38, 46, 54, 62].map((y, i) => M(34, y) + L(i === 3 ? 54 : 66, y)).join('');
  return (
    h('defs', null, shade(s.id('paper'), '#f6e2b8', { light: 0.4, dark: 0.18 })) +
    ink(roundRectD(26, 26, 48, 46, 3), s.url('paper')) +
    ink(roundRectD(20, 20, 60, 10, 5), '#e6c389', { 'stroke-width': SW * 0.7 }) +
    ink(roundRectD(20, 68, 60, 10, 5), '#e6c389', { 'stroke-width': SW * 0.7 }) +
    line(lines, darken('#d8b26e', 0.35), 2, { opacity: 0.75 }) +
    ink(circleD(64, 62, 6), '#e8513f', { 'stroke-width': SW * 0.5 }) +
    ink(roundStarD(64, 62, 5, 3.4, 1.6, -90, 0.2), '#ffd166', { 'stroke-width': SW * 0.3 })
  );
}

function stickerTenShells() {
  const colors = ['#ffd6c9', '#fff4e4', '#ffb09c', '#c9b8f0', '#bfe9ff'];
  /** @type {[number, number][]} */
  const spots = [
    [50, 24],
    [37, 34],
    [63, 34],
    [26, 46],
    [74, 46],
    [26, 60],
    [74, 60],
    [37, 72],
    [63, 72],
    [50, 78],
  ];
  return (
    spots
      .map(([x, y], i) => {
        const w = 6.6;
        const fan =
          M(x - w, y + 3) +
          C(x - w, y - w, x + w, y - w, x + w, y + 3) +
          Q(x, y + 6, x - w, y + 3) +
          Z;
        return (
          ink(fan, colors[i % colors.length] ?? '#ffffff', { 'stroke-width': SW * 0.45 }) +
          line(
            M(x, y + 3.5) +
              L(x, y - 3) +
              M(x - 3, y + 3) +
              L(x - 4, y - 2) +
              M(x + 3, y + 3) +
              L(x + 4, y - 2),
            INK,
            0.8,
            {
              opacity: 0.5,
            },
          )
        );
      })
      .join('') + ink(heartD(50, 52, 8), HEART, { 'stroke-width': SW * 0.5 })
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const PEARL_BAY_STICKERS = [
  { id: 'starfish', draw: stickerStarfish },
  { id: 'open-clam', draw: stickerOpenClam },
  { id: 'silver-pearls', draw: stickerSilverPearls },
  { id: 'scroll', draw: stickerScroll },
  { id: 'ten-shells', draw: stickerTenShells },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A string of pearls with a pink drop pearl, hanging like the shell necklace. */
function stringPearls() {
  const p0 = { x: 6, y: 24 };
  const p1 = { x: 50, y: 72 };
  const p2 = { x: 94, y: 24 };
  /** @param {number} t */
  const at = (t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });
  const beads = Array.from({ length: 13 }, (_, i) => 0.08 + i * 0.07);
  return (
    line(M(p0.x, p0.y) + Q(p1.x, p1.y, p2.x, p2.y), '#c7ccd8', 1.4) +
    beads
      .filter((t) => Math.abs(t - 0.5) > 0.01)
      .map((t) => {
        const p = at(t);
        return pearl(p.x, p.y, 3.6);
      })
      .join('') +
    line(M(50, 48) + L(50, 54), INK, 1.4) +
    pearl(50, 52, 4) +
    ink(M(50, 56) + C(44, 62, 46, 70, 50, 71) + C(54, 70, 56, 62, 50, 56) + Z, '#ffc8d8', {
      'stroke-width': SW * 0.5,
    }) +
    h('circle', { cx: 48.5, cy: 63, r: 1.3, fill: '#ffffff' })
  );
}

/** Round pearly glasses with a pearl at each hinge; the bridge is (50, 50). */
function glassesPearl() {
  const s = scope('glasses-pearl');
  return (
    h(
      'defs',
      null,
      shade(s.id('lens'), '#cfe9f5', { light: 0.6, dark: 0.1 }),
      shade(s.id('frame'), '#f4eef8', { light: 0.5, dark: 0.25 }),
    ) +
    tube(M(13, 47) + L(3, 44), '#e6dff0', 3.2) +
    tube(M(87, 47) + L(97, 44), '#e6dff0', 3.2) +
    tube(M(44, 49) + Q(50, 44, 56, 49), '#e6dff0', 3.4) +
    ink(circleD(29, 51, 16), s.url('frame'), { 'stroke-width': SW }) +
    ink(circleD(71, 51, 16), s.url('frame'), { 'stroke-width': SW }) +
    h('path', { d: circleD(29, 51, 11.5) + circleD(71, 51, 11.5), fill: s.url('lens') }) +
    pearl(13, 47, 3.6) +
    pearl(87, 47, 3.6) +
    pearl(50, 45, 2.8) +
    gleam(M(22, 50) + Q(23, 45, 27, 43.5), 2.2) +
    gleam(M(64, 50) + Q(65, 45, 69, 43.5), 2.2)
  );
}

/** A giant open shell for the grotto, a pearl glowing inside, standing at the bottom. */
function shellGiant() {
  const s = scope('shell-giant');
  const back =
    M(10, 70) + C(10, 26, 40, 10, 50, 10) + C(60, 10, 90, 26, 90, 70) + Q(50, 64, 10, 70) + Z;
  const ribs = Array.from({ length: 9 }, (_, i) => {
    const a = -160 + i * 17.5;
    const p = polar(50, 70, 14, a);
    const q = polar(50, 70, 54, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  const front =
    M(14, 72) + Q(50, 64, 86, 72) + C(84, 86, 66, 92, 50, 92) + C(34, 92, 16, 86, 14, 72) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('shell'), '#ffc9c0', { light: 0.45, dark: 0.2 }),
      h('clipPath', { id: s.id('back') }, h('path', { d: back })),
      h(
        'radialGradient',
        { id: s.id('glow') },
        h('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.95' }),
        h('stop', { offset: '1', 'stop-color': '#fff1f6', 'stop-opacity': '0' }),
      ),
    ) +
    groundShadow(50, 94, 42, 4) +
    ink(back, s.url('shell')) +
    g({ 'clip-path': s.url('back') }, line(ribs, darken('#ffc9c0', 0.25), 1.5, { opacity: 0.7 })) +
    h('circle', { cx: 50, cy: 66, r: 20, fill: s.url('glow') }) +
    ink(front, lighten('#ffc9c0', 0.15)) +
    pearl(50, 66, 9) +
    gleam(M(22, 48) + Q(26, 32, 38, 22), 2.2)
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const PEARL_BAY_COSMETICS = [
  { id: 'string-pearls', slot: 'neck', draw: stringPearls },
  { id: 'glasses-pearl', slot: 'eyes', draw: glassesPearl },
  { id: 'shell-giant', slot: 'grotto', draw: shellGiant },
];
