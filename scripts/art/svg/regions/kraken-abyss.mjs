// @ts-check
/**
 * Krakatičí propast (region 12, grade 4, the finale): the egg of Klauni Dvojčata, the region's
 * sticker icons and its cosmetics (docs/art.md §9). The twins' egg carries their memory hook: two
 * clownfish bands side by side, always together.
 */
import { darken } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { polar } from '../lib/num.mjs';
import { h } from '../lib/xml.mjs';
import { INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const CLOWN = '#f88228';
const GOLD = '#ffcc4d';

// ------------------------------------------------------------------------------------------- eggs

/** Klauni Dvojčata: clownfish orange with white bands outlined in black, in two matching pairs. */
function eggKlauni() {
  return [30, 90]
    .map(
      (x) =>
        h('path', { d: M(x - 9, 0) + L(x + 9, 0) + L(x + 9, 160) + L(x - 9, 160) + Z, fill: INK }) +
        h('path', {
          d: M(x - 6, 0) + L(x + 6, 0) + L(x + 6, 160) + L(x - 6, 160) + Z,
          fill: '#fffcf4',
        }),
    )
    .join('');
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const KRAKEN_ABYSS_EGGS = [{ id: 'klauni-dvojcata', base: CLOWN, motif: eggKlauni }];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

/**
 * A small clownfish facing left at (x, y), scale k.
 *
 * @param {string} key
 * @param {number} x
 * @param {number} y
 * @param {number} k
 */
function clownfish(key, x, y, k) {
  const s = scope(key);
  const body = ellipseD(x, y, 18 * k, 12 * k);
  return (
    h(
      'defs',
      null,
      shade(s.id('body'), CLOWN, { light: 0.45, dark: 0.15 }),
      h('clipPath', { id: s.id('clip') }, h('path', { d: body })),
    ) +
    ink(M(x + 16 * k, y) + L(x + 26 * k, y - 8 * k) + L(x + 26 * k, y + 8 * k) + Z, CLOWN, {
      'stroke-width': SW * 0.4,
    }) +
    ink(body, s.url('body')) +
    h(
      'g',
      { 'clip-path': s.url('clip') },
      [-8, 2, 12]
        .map((dx) =>
          h('rect', {
            x: x + dx * k - 2.6 * k,
            y: y - 14 * k,
            width: 5.2 * k,
            height: 28 * k,
            fill: '#ffffff',
            stroke: INK,
            'stroke-width': 0.9,
          }),
        )
        .join(''),
    ) +
    h('circle', { cx: x - 12 * k, cy: y - 3 * k, r: 2 * k, fill: INK })
  );
}

function stickerClownfishTwins() {
  return (
    clownfish('sticker-clown-a', 46, 42, 1.1) +
    clownfish('sticker-clown-b', 54, 62, 1.1) +
    sparkle(78, 26, 5)
  );
}

function stickerTenCleanArms() {
  const s = scope('sticker-ten-clean-arms');
  const arms = Array.from({ length: 10 }, (_, i) => {
    const a = 20 + i * 15.5;
    const p = polar(50, 50, 10, a);
    const q = polar(50, 50, 27, a);
    return M(p.x, p.y) + Q((p.x + q.x) / 2 + 3, (p.y + q.y) / 2 + 3, q.x, q.y);
  }).join('');
  return (
    h('defs', null, shade(s.id('body'), '#c39be6', { light: 0.5, dark: 0.18 })) +
    line(arms, '#c39be6', 5, { 'stroke-linecap': 'round' }) +
    line(arms, INK, 0.8, { opacity: 0.4 }) +
    ink(
      M(50, 18) + C(60, 22, 62, 36, 60, 50) + L(40, 50) + C(38, 36, 40, 22, 50, 18) + Z,
      s.url('body'),
    ) +
    h('circle', { cx: 45, cy: 42, r: 2.4, fill: INK }) +
    h('circle', { cx: 55, cy: 42, r: 2.4, fill: INK }) +
    line(M(46, 47) + Q(50, 50, 54, 47), INK, SW * 0.4) +
    sparkle(80, 26, 5) +
    sparkle(22, 30, 4)
  );
}

function stickerGoldenCrown() {
  const s = scope('sticker-golden-crown');
  const crown =
    M(22, 66) + L(18, 34) + L(34, 48) + L(50, 26) + L(66, 48) + L(82, 34) + L(78, 66) + Z;
  return (
    h('defs', null, shade(s.id('gold'), GOLD, { light: 0.55, dark: 0.22 })) +
    ink(crown, s.url('gold')) +
    ink(roundRectD(22, 64, 56, 10, 3), darken(GOLD, 0.1)) +
    [
      [18, 32],
      [50, 24],
      [82, 32],
    ]
      .map(([x, y]) => ink(circleD(x ?? 0, y ?? 0, 4), '#fffaf0', { 'stroke-width': SW * 0.4 }))
      .join('') +
    ink(circleD(50, 54, 5), '#e8513f', { 'stroke-width': SW * 0.45 }) +
    gleam(M(30, 54) + L(38, 46), 1.8)
  );
}

function stickerAllFriends() {
  /** @type {[number, number, string][]} */
  const dots = [];
  for (let i = 0; i < 18; i++) {
    const p = polar(50, 50, i < 6 ? 12 : 26, (i < 6 ? i * 60 : (i - 6) * 30) - 90);
    dots.push([
      p.x,
      p.y,
      ['#ff7a59', '#ffd166', '#2bb3c0', '#c39be6', '#7fd1ae', '#ff9db0'][i % 6] ?? '#ffffff',
    ]);
  }
  return (
    dots.map(([x, y, c]) => ink(circleD(x, y, 5), c, { 'stroke-width': SW * 0.4 })).join('') +
    ink(roundStarD(50, 50, 5, 6, 2.6, -90, 0.25), '#fff6c8', { 'stroke-width': SW * 0.4 })
  );
}

function stickerGoldenPearls() {
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
    ink(ellipseD(50, 74, 32, 7), darken(GOLD, 0.35), { 'stroke-width': SW * 0.5 }) +
    pile
      .map(
        ([x, y, r]) =>
          ink(circleD(x, y, r), GOLD, { 'stroke-width': SW * 0.45 }) +
          h('circle', { cx: x - r * 0.35, cy: y - r * 0.35, r: r * 0.3, fill: '#fff6d8' }),
      )
      .join('') +
    sparkle(76, 28, 6)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const KRAKEN_ABYSS_STICKERS = [
  { id: 'clownfish-twins', draw: stickerClownfishTwins },
  { id: 'ten-clean-arms', draw: stickerTenCleanArms },
  { id: 'golden-crown', draw: stickerGoldenCrown },
  { id: 'all-friends', draw: stickerAllFriends },
  { id: 'golden-pearls', draw: stickerGoldenPearls },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A white captain's cap with a gold anchor badge; the brim centre is (50, 50). */
function capCaptain() {
  const s = scope('cap-captain');
  return (
    h('defs', null, shade(s.id('top'), '#f4f2ee', { light: 0.4, dark: 0.18 })) +
    ink(M(20, 48) + C(14, 30, 30, 20, 50, 20) + C(70, 20, 86, 30, 80, 48) + Z, s.url('top')) +
    ink(roundRectD(24, 44, 52, 10, 3), '#2f3a55') +
    ink(M(28, 54) + Q(50, 66, 72, 54) + L(72, 58) + Q(50, 70, 28, 58) + Z, '#1f2a40') +
    line(M(44, 30) + L(56, 30) + M(50, 28) + L(50, 40) + M(44, 36) + Q(50, 42, 56, 36), GOLD, 2) +
    gleam(M(28, 40) + Q(30, 30, 38, 26), 1.8)
  );
}

/** Heart-shaped glasses, pink lenses; the bridge is (50, 50). */
function glassesHeart() {
  const heart = (/** @type {number} */ cx) =>
    M(cx, 62) +
    C(cx - 22, 52, cx - 18, 34, cx - 8, 36) +
    C(cx - 3, 37, cx, 42, cx, 44) +
    C(cx, 42, cx + 3, 37, cx + 8, 36) +
    C(cx + 18, 34, cx + 22, 52, cx, 62) +
    Z;
  return (
    tube(M(14, 46) + L(3, 43), '#e8516f', 3.2) +
    tube(M(86, 46) + L(97, 43), '#e8516f', 3.2) +
    tube(M(44, 47) + Q(50, 42, 56, 47), '#e8516f', 3.4) +
    ink(heart(30), '#ff9db0', { 'stroke-width': SW * 1.1 }) +
    ink(heart(70), '#ff9db0', { 'stroke-width': SW * 1.1 }) +
    gleam(M(23, 44) + Q(25, 40, 28, 40), 2) +
    gleam(M(63, 44) + Q(65, 40, 68, 40), 2)
  );
}

/** A pearl-studded throne carved from a giant shell, standing at the bottom. */
function thronePearl() {
  const s = scope('throne-pearl');
  const back = M(20, 64) + C(18, 30, 34, 12, 50, 12) + C(66, 12, 82, 30, 80, 64) + Z;
  const ribs = Array.from({ length: 7 }, (_, i) => {
    const a = -160 + i * 23;
    const p = polar(50, 64, 10, a);
    const q = polar(50, 64, 48, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  return (
    h(
      'defs',
      null,
      shade(s.id('shell'), '#e8d7f1', { light: 0.45, dark: 0.2 }),
      h('clipPath', { id: s.id('back') }, h('path', { d: back })),
    ) +
    groundShadow(50, 94, 36, 4) +
    ink(back, s.url('shell')) +
    h('g', { 'clip-path': s.url('back') }, line(ribs, darken('#e8d7f1', 0.25), 1.4)) +
    ink(roundRectD(22, 62, 56, 14, 6), '#c39be6') +
    ink(roundRectD(26, 76, 8, 16, 2), '#a57fd0') +
    ink(roundRectD(66, 76, 8, 16, 2), '#a57fd0') +
    [24, 37, 50, 63, 76]
      .map((x) => ink(circleD(x, 62, 3.4), '#fffaf0', { 'stroke-width': SW * 0.35 }))
      .join('') +
    ink(circleD(50, 18, 4.4), GOLD, { 'stroke-width': SW * 0.4 })
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const KRAKEN_ABYSS_COSMETICS = [
  { id: 'cap-captain', slot: 'head', draw: capCaptain },
  { id: 'glasses-heart', slot: 'eyes', draw: glassesHeart },
  { id: 'throne-pearl', slot: 'grotto', draw: thronePearl },
];
