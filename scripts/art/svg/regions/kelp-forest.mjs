// @ts-check
/**
 * Chaluhový les (region 3): the eggs of Koník Mýdlínek and Pyskoun Pyšný, the region's sticker
 * icons and its cosmetics (docs/art.md §9). Each egg carries its friend's memory hook: Koník's
 * three soap bubbles, Pyskoun's three wavy orange head stripes.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { g, h } from '../lib/xml.mjs';
import { scarf } from '../scarf.mjs';
import { CREAM, INK, SW, gleam, groundShadow, ink, line, scope, shade, tube } from '../style.mjs';

const KONIK = '#f6b246';
const PYSKOUN = '#46b082';
const KELP = '#8f9a3a';
const KELP_DARK = '#6c7a2c';
const LIPS = '#f26e96';

/**
 * A soap bubble: a pale film, a pink and a mint rainbow sheen and a highlight.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {number} [stroke]
 */
function bubble(x, y, r, stroke = SW * 0.5) {
  const rim = r * 0.78;
  return (
    ink(circleD(x, y, r), '#e8f6fc', { 'stroke-width': stroke, opacity: 0.95 }) +
    line(
      M(x - rim * 0.94, y + rim * 0.34) + Q(x - rim * 0.86, y + rim * 0.86, x - rim * 0.2, y + rim),
      '#ff9cc8',
      Math.max(1.2, r * 0.16),
      { opacity: 0.85 },
    ) +
    line(
      M(x + rim * 0.34, y - rim * 0.94) + Q(x + rim * 0.9, y - rim * 0.7, x + rim, y - rim * 0.1),
      '#7fdcc8',
      Math.max(1.2, r * 0.16),
      { opacity: 0.85 },
    ) +
    h('ellipse', {
      cx: x - r * 0.36,
      cy: y - r * 0.4,
      rx: r * 0.2,
      ry: r * 0.13,
      fill: '#ffffff',
      transform: `rotate(-35 ${x - r * 0.36} ${y - r * 0.4})`,
    })
  );
}

// ------------------------------------------------------------------------------------------- eggs

/** Koník Mýdlínek: sunny orange, a pale ridged belly plate and three rising soap bubbles. */
function eggKonik() {
  const plate = M(34, 160) + C(30, 128, 40, 110, 58, 104) + C(76, 110, 90, 128, 86, 160) + Z;
  const ridges = [116, 127, 138, 149]
    .map((y) => M(44 - (y - 104) * 0.08, y) + Q(60, y + 3, 76 + (y - 104) * 0.08, y))
    .join('');
  return (
    h('path', { d: plate, fill: '#fcd88a' }) +
    line(ridges, darken(KONIK, 0.1), SW * 0.55, { opacity: 0.8 }) +
    bubble(36, 82, 7) +
    bubble(54, 64, 10) +
    bubble(74, 40, 12)
  );
}

/** Pyskoun Pyšný: sea green, a pale belly, three wavy orange stripes and a blue fin crest. */
function eggPyskoun() {
  const belly = M(0, 112) + C(36, 104, 84, 106, 120, 114) + L(120, 160) + L(0, 160) + Z;
  const stripes = [54, 72, 90]
    .map((y) => {
      let d = M(-4, y);
      for (let x = -4; x < 124; x += 16)
        d += Q(x + 4, y - 6, x + 8, y) + Q(x + 12, y + 6, x + 16, y);
      return d;
    })
    .join('');
  const crest = M(0, 30) + Q(30, 14, 60, 12) + Q(90, 14, 120, 30) + L(120, 0) + L(0, 0) + Z;
  const rays = [24, 42, 60, 78, 96].map((x) => M(x, 4) + L(x + 2, 19)).join('');
  return (
    h('path', { d: crest, fill: '#5a96d2' }) +
    line(rays, '#3c6fa8', SW * 0.5, { opacity: 0.8 }) +
    line(M(0, 30) + Q(30, 14, 60, 12) + Q(90, 14, 120, 30), INK, SW * 0.7, { opacity: 0.7 }) +
    h('path', { d: belly, fill: '#c8ecc4' }) +
    line(M(0, 112) + C(36, 104, 84, 106, 120, 114), INK, SW * 0.7, { opacity: 0.7 }) +
    line(stripes, '#f78c3c', SW * 1.4, { 'stroke-linecap': 'round' })
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const KELP_FOREST_EGGS = [
  { id: 'konik-mydlinek', base: KONIK, motif: eggKonik },
  { id: 'pyskoun-pysny', base: PYSKOUN, motif: eggPyskoun },
];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerSoapBubbles() {
  const foam = M(22, 78) + Q(18, 68, 28, 66) + Q(32, 58, 42, 62) + Q(50, 56, 58, 63);
  const foamD = foam + Q(68, 60, 72, 68) + Q(82, 68, 78, 78) + Q(50, 84, 22, 78) + Z;
  return (
    ink(foamD, '#ffffff') +
    line(M(30, 72) + Q(40, 69, 48, 71) + M(56, 72) + Q(64, 70, 70, 73), '#bfe6f2', 1.6) +
    bubble(34, 50, 10, SW * 0.6) +
    bubble(56, 38, 14, SW * 0.6) +
    bubble(74, 58, 8, SW * 0.6) +
    sparkle(76, 24, 5)
  );
}

function stickerProudLips() {
  const s = scope('sticker-proud-lips');
  const upper =
    M(16, 52) +
    C(22, 40, 34, 32, 42, 36) +
    Q(50, 40, 58, 36) +
    C(66, 32, 78, 40, 84, 52) +
    Q(50, 50, 16, 52) +
    Z;
  const lower =
    M(16, 52) + Q(50, 50, 84, 52) + C(76, 70, 62, 76, 50, 76) + C(38, 76, 24, 70, 16, 52) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('upper'), LIPS, { light: 0.35, dark: 0.18 }),
      shade(s.id('lower'), darken(LIPS, 0.05), { light: 0.4, dark: 0.2 }),
    ) +
    ink(lower, s.url('lower')) +
    ink(upper, s.url('upper')) +
    line(M(20, 52.5) + Q(50, 54, 80, 52.5), darken(LIPS, 0.45), SW * 0.6) +
    gleam(M(38, 64) + Q(46, 68, 56, 66), 2.6) +
    gleam(M(30, 42) + Q(34, 39, 38, 39), 1.8) +
    sparkle(80, 26, 6) +
    sparkle(22, 26, 4)
  );
}

function stickerSoapAndHand() {
  const s = scope('sticker-soap-and-hand');
  const palm =
    M(56, 80) +
    C(50, 74, 48, 62, 50, 54) +
    L(50, 34) +
    Q(50, 30, 54, 30) +
    Q(58, 30, 58, 34) +
    L(58, 50) +
    L(58, 28) +
    Q(58, 24, 62, 24) +
    Q(66, 24, 66, 28) +
    L(66, 50) +
    L(66, 30) +
    Q(66, 26, 70, 26) +
    Q(74, 26, 74, 30) +
    L(74, 52) +
    L(74, 38) +
    Q(74, 34, 78, 34) +
    Q(82, 34, 82, 38) +
    L(82, 64) +
    C(82, 74, 76, 80, 68, 82) +
    Z;
  const thumb = M(52, 62) + C(46, 56, 40, 52, 38, 56) + C(36, 60, 44, 66, 50, 72) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('soap'), '#8fd8f0', { light: 0.5, dark: 0.15 }),
      shade(s.id('hand'), '#f7c9a0', { light: 0.35, dark: 0.15 }),
    ) +
    g(
      { transform: 'rotate(-14 32 58)' },
      ink(roundRectD(16, 48, 32, 20, 8), s.url('soap')),
      gleam(M(22, 53) + L(32, 53), 2),
    ) +
    bubble(26, 36, 6, SW * 0.5) +
    bubble(38, 26, 4.5, SW * 0.45) +
    ink(thumb, '#f7c9a0') +
    ink(palm, s.url('hand')) +
    line(M(58, 48) + L(58, 54) + M(66, 48) + L(66, 54) + M(74, 50) + L(74, 56), INK, 1.4, {
      opacity: 0.5,
    })
  );
}

function stickerUntiedKnot() {
  const s = scope('sticker-untied-knot');
  const strand =
    M(16, 70) +
    C(26, 76, 36, 74, 42, 64) +
    C(48, 52, 40, 36, 52, 32) +
    C(64, 28, 70, 42, 62, 50) +
    C(56, 56, 62, 66, 72, 62) +
    C(80, 58, 84, 48, 86, 40);
  /** @type {[number, number, number][]} */
  const bladeSpots = [
    [26, 74, 30],
    [44, 48, -40],
    [66, 38, 40],
    [76, 60, -30],
  ];
  const blades = bladeSpots
    .map(([x, y, a]) =>
      ink(ellipseD(x, y, 7, 3.4), '#f2f7a8', {
        'stroke-width': SW * 0.45,
        transform: `rotate(${a} ${x} ${y})`,
      }),
    )
    .join('');
  return g(
    { transform: 'translate(50 50) scale(0.94) translate(-50 -50)' },
    h('defs', null, shade(s.id('kelp'), '#5cbf72', { light: 0.4, dark: 0.15 })) +
      tube(strand, '#c8e86a', 7) +
      blades +
      ink(circleD(86, 40, 4), '#ffd166', { 'stroke-width': SW * 0.45 }) +
      ink(circleD(16, 70, 4), '#ffd166', { 'stroke-width': SW * 0.45 }) +
      sparkle(26, 30, 6) +
      sparkle(80, 76, 4.5),
  );
}

function stickerWardrobe() {
  const s = scope('sticker-wardrobe');
  const body = roundRectD(22, 20, 48, 64, 5);
  const hanger = (/** @type {number} */ x, /** @type {string} */ color) =>
    line(M(x, 30) + L(x, 33), INK, 1.4) +
    ink(M(x - 6, 36) + L(x, 32.5) + L(x + 6, 36) + L(x + 6, 56) + Q(x, 58, x - 6, 56) + Z, color, {
      'stroke-width': SW * 0.45,
    });
  const door = M(70, 20) + L(86, 26) + L(86, 82) + L(70, 84) + Z;
  return (
    h(
      'defs',
      null,
      shade(s.id('wood'), '#c98a54', { light: 0.35, dark: 0.22 }),
      shade(s.id('door'), '#d99a62', { light: 0.4, dark: 0.18 }),
    ) +
    g(
      { transform: 'translate(50 51) scale(0.74) translate(-54 -52)' },
      ink(body, s.url('wood')) +
        ink(roundRectD(26, 24, 40, 56, 3), darken('#c98a54', 0.4), { 'stroke-width': SW * 0.45 }) +
        line(M(27, 30) + L(65, 30), '#e6e0d4', 1.6) +
        hanger(34, '#ff7a59') +
        hanger(46, '#2bb3c0') +
        hanger(58, '#ffd166') +
        ink(roundRectD(28, 66, 36, 10, 2), CREAM, { 'stroke-width': SW * 0.4 }) +
        ink(door, s.url('door')) +
        h('circle', { cx: 74, cy: 53, r: 1.8, fill: INK }) +
        gleam(M(76, 32) + L(76, 44), 1.8),
    ) +
    sparkle(76, 25, 5)
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const KELP_FOREST_STICKERS = [
  { id: 'soap-bubbles', draw: stickerSoapBubbles },
  { id: 'proud-lips', draw: stickerProudLips },
  { id: 'soap-and-hand', draw: stickerSoapAndHand },
  { id: 'untied-knot', draw: stickerUntiedKnot },
  { id: 'wardrobe', draw: stickerWardrobe },
];

// -------------------------------------------------------------------------------------- cosmetics

/**
 * A kelp leaf blade from its base, pointing at `angle` degrees.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} length
 * @param {number} angle
 * @param {string} fill
 */
function blade(x, y, length, angle, fill) {
  const w = length * 0.3;
  const d =
    M(x, y) +
    C(x - w, y - length * 0.3, x - w * 0.6, y - length * 0.8, x, y - length) +
    C(x + w * 0.6, y - length * 0.8, x + w, y - length * 0.3, x, y) +
    Z;
  return ink(d, fill, { 'stroke-width': SW * 0.55, transform: `rotate(${angle} ${x} ${y})` });
}

/** A bucket hat woven of kelp with leafy blades on top; the brim centre is (50, 50). */
function hatKelp() {
  const s = scope('hat-kelp');
  const brim =
    M(10, 54) + Q(50, 40, 90, 54) + Q(92, 62, 80, 62) + Q(50, 56, 20, 62) + Q(8, 62, 10, 54) + Z;
  const crown =
    M(26, 50) + C(26, 30, 36, 22, 50, 22) + C(64, 22, 74, 30, 74, 50) + Q(50, 54, 26, 50) + Z;
  const weave = [30, 38, 46]
    .map((y) => M(50 - (y - 16) * 0.72, y) + Q(50, y + 3, 50 + (y - 16) * 0.72, y))
    .join('');
  return (
    h('defs', null, shade(s.id('kelp'), KELP, { light: 0.45, dark: 0.2 })) +
    blade(42, 26, 22, -28, lighten(KELP, 0.12)) +
    blade(58, 26, 20, 30, KELP) +
    blade(50, 24, 26, 2, lighten(KELP, 0.25)) +
    ink(brim, s.url('kelp')) +
    ink(crown, s.url('kelp')) +
    line(weave, KELP_DARK, 1.4, { opacity: 0.7 }) +
    ink(circleD(68, 44, 4.2), '#e8b84a', { 'stroke-width': SW * 0.5 }) +
    gleam(M(32, 40) + Q(34, 31, 42, 27), 2) +
    gleam(M(16, 55) + Q(24, 50, 32, 49), 1.8)
  );
}

/** A scarf of kelp blades with little gold floats; the knot is (50, 50). */
function scarfKelp() {
  return scarf('scarf-kelp', KELP, () =>
    Array.from({ length: 9 }, (_, i) => {
      const x = -4 + i * 13;
      return (
        line(M(x, -4) + Q(x + 8, 50, x, 104), KELP_DARK, 2.2, { opacity: 0.7 }) +
        h('ellipse', {
          cx: x + 5,
          cy: 30 + (i % 3) * 22,
          rx: 2.6,
          ry: 2.6,
          fill: '#e8b84a',
        })
      );
    }).join(''),
  );
}

/** A curtain of kelp hung from a driftwood bar on two posts, parted in the middle. */
function curtainKelp() {
  const s = scope('curtain-kelp');
  const strand = (/** @type {number} */ x, /** @type {number} */ bend, /** @type {number} */ end) =>
    M(x, 20) + C(x + bend * 0.3, 40, x + bend, 60, x + bend * 0.8, end);
  /** @type {[number, number, number, string][]} */
  const strands = [
    [20, -2, 84, KELP],
    [26, 4, 78, lighten(KELP, 0.15)],
    [32, 8, 72, KELP_DARK],
    [38, 10, 64, KELP],
    [62, -10, 64, KELP],
    [68, -8, 72, KELP_DARK],
    [74, -4, 78, lighten(KELP, 0.15)],
    [80, 2, 84, KELP],
  ];
  return (
    h('defs', null, shade(s.id('wood'), '#a8774c', { light: 0.35, dark: 0.22 })) +
    groundShadow(50, 94, 44, 4) +
    ink(roundRectD(10, 18, 6, 76, 3), s.url('wood')) +
    ink(roundRectD(84, 18, 6, 76, 3), s.url('wood')) +
    strands
      .map(
        ([x, bend, end, c]) =>
          tube(strand(x, bend, end), c, 5) +
          blade(x + bend * 0.55, (20 + end) * 0.55, 9, bend > 0 ? 35 : -35, lighten(c, 0.18)) +
          ink(circleD(x + bend * 0.8, end, 2.6), '#e8b84a', { 'stroke-width': SW * 0.4 }),
      )
      .join('') +
    ink(roundRectD(6, 12, 88, 9, 4.5), s.url('wood')) +
    line(M(14, 16) + L(40, 15.5) + M(56, 16.5) + L(84, 16), lighten('#a8774c', 0.35), 1.4) +
    ink(circleD(50, 16.5, 3.4), '#ffd166', { 'stroke-width': SW * 0.45 })
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const KELP_FOREST_COSMETICS = [
  { id: 'hat-kelp', slot: 'head', draw: hatKelp },
  { id: 'scarf-kelp', slot: 'neck', draw: scarfKelp },
  { id: 'curtain-kelp', slot: 'grotto', draw: curtainKelp },
];
