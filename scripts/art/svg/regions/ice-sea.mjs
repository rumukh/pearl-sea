// @ts-check
/**
 * Ledové moře (region 7): the eggs of Tuleň Pádík and Delfín Skokánek, the region's sticker
 * icons and its cosmetics (docs/art.md §9). Each egg carries its friend's memory hook: Tuleň's
 * seven icy steps, Delfín's leaping arc over a wave.
 */
import { darken, lighten } from '../lib/color.mjs';
import { C, L, M, Q, Z, circleD, ellipseD, roundRectD, roundStarD } from '../lib/path.mjs';
import { g, h } from '../lib/xml.mjs';
import { scarf } from '../scarf.mjs';
import { CREAM, INK, SW, gleam, groundShadow, ink, line, scope, shade } from '../style.mjs';

const TULEN = '#a3acba';
const DELFIN = '#6ea6d8';
const ICE = '#d8eefa';
const KNIT = '#e85d75';

/**
 * A staircase of `n` icy steps rising to the right, from (x0, base) with step width w and rise r.
 *
 * @param {number} n
 * @param {number} x0
 * @param {number} base
 * @param {number} w
 * @param {number} r
 */
function stepsD(n, x0, base, w, r) {
  let d = M(x0, base);
  for (let i = 0; i < n; i++)
    d += L(x0 + i * w, base - (i + 1) * r) + L(x0 + (i + 1) * w, base - (i + 1) * r);
  return d + L(x0 + n * w, base) + Z;
}

// ------------------------------------------------------------------------------------------- eggs

/** Tuleň Pádík: dappled seal grey with seven pale icy steps across the lower half. */
function eggTulen() {
  /** @type {[number, number, number][]} */
  const spots = [
    [34, 40, 5],
    [62, 30, 4],
    [84, 50, 5.5],
    [46, 60, 4],
  ];
  return (
    spots
      .map(([x, y, r]) =>
        h('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: darken(TULEN, 0.18) }),
      )
      .join('') +
    h('path', {
      d: stepsD(7, 2, 160, 17, 8.5) + M(0, 160) + L(0, 152) + L(2, 152) + L(2, 160) + Z,
      fill: ICE,
    }) +
    line(stepsD(7, 2, 160, 17, 8.5), INK, SW * 0.6, { opacity: 0.75 })
  );
}

/** Delfín Skokánek: sea blue, a pale leaping arc over a foamy wave. */
function eggDelfin() {
  const sea = M(0, 128) + C(20, 118, 36, 136, 58, 126) + C(80, 116, 100, 132, 120, 124);
  return (
    line(M(22, 112) + C(32, 56, 88, 56, 98, 104), '#eaf4fc', 9, { 'stroke-linecap': 'round' }) +
    line(M(22, 112) + C(32, 56, 88, 56, 98, 104), INK, SW * 0.5, { opacity: 0.35 }) +
    h('path', { d: sea + L(120, 160) + L(0, 160) + Z, fill: '#3fa6d8' }) +
    line(sea, '#ffffff', 5, { opacity: 0.85 }) +
    line(sea, INK, SW * 0.7, { opacity: 0.7 }) +
    /** @type {[number, number, number][]} */ ([
      [70, 40, 3],
      [80, 32, 2.4],
      [62, 34, 2],
    ])
      .map(([x, y, r]) => ink(circleD(x, y, r), '#cfeafc', { 'stroke-width': SW * 0.35 }))
      .join('')
  );
}

/** @type {readonly import('../eggs.mjs').EggDesign[]} */
export const ICE_SEA_EGGS = [
  { id: 'delfin-skokanek', base: DELFIN, motif: eggDelfin },
  { id: 'tulen-padik', base: TULEN, motif: eggTulen },
];

// --------------------------------------------------------------------------------------- stickers

/** A small four-point sparkle. */
function sparkle(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) {
  return ink(roundStarD(x, y, 4, r, r * 0.34, -90, 0.2), '#fff6c8', { 'stroke-width': SW * 0.45 });
}

function stickerSeal() {
  const s = scope('sticker-seal');
  const head =
    M(16, 54) +
    C(16, 34, 32, 24, 50, 24) +
    C(68, 24, 84, 34, 84, 54) +
    C(84, 70, 68, 78, 50, 78) +
    C(32, 78, 16, 70, 16, 54) +
    Z;
  return (
    h('defs', null, shade(s.id('fur'), TULEN, { light: 0.45, dark: 0.18 })) +
    ink(head, s.url('fur')) +
    [
      [30, 36],
      [70, 34],
      [76, 50],
    ]
      .map(([x, y]) => h('ellipse', { cx: x, cy: y, rx: 3, ry: 2.4, fill: darken(TULEN, 0.2) }))
      .join('') +
    h('ellipse', { cx: 42, cy: 60, rx: 9, ry: 7, fill: '#eef1f5' }) +
    h('ellipse', { cx: 58, cy: 60, rx: 9, ry: 7, fill: '#eef1f5' }) +
    ink(ellipseD(50, 54, 5.4, 3.8), INK, { 'stroke-width': SW * 0.3 }) +
    line(M(44, 68) + Q(50, 72, 56, 68), INK, SW * 0.45) +
    [-1, 1]
      .map((k) =>
        [0, 1, 2]
          .map((i) =>
            h('circle', { cx: 50 + k * (8 + i * 4), cy: 60 + i * 1.6, r: 0.9, fill: INK }),
          )
          .join(''),
      )
      .join('') +
    h('circle', { cx: 38, cy: 44, r: 5.4, fill: INK }) +
    h('circle', { cx: 62, cy: 44, r: 5.4, fill: INK }) +
    h('circle', { cx: 36.6, cy: 42.4, r: 1.8, fill: '#ffffff' }) +
    h('circle', { cx: 60.6, cy: 42.4, r: 1.8, fill: '#ffffff' }) +
    h('ellipse', { cx: 28, cy: 58, rx: 3.6, ry: 2.4, fill: '#ff9db0', opacity: 0.8 }) +
    h('ellipse', { cx: 72, cy: 58, rx: 3.6, ry: 2.4, fill: '#ff9db0', opacity: 0.8 }) +
    gleam(M(30, 32) + Q(38, 28, 46, 28), 1.8)
  );
}

function stickerDolphin() {
  const s = scope('sticker-dolphin');
  const body =
    M(20, 70) +
    C(22, 44, 44, 28, 66, 32) +
    L(80, 34) +
    Q(84, 37, 80, 40) +
    L(70, 40) +
    C(54, 40, 38, 52, 30, 72) +
    Z;
  return g(
    { transform: 'translate(50 50) scale(0.78) translate(-50 -50)' },
    h('defs', null, shade(s.id('body'), DELFIN, { light: 0.45, dark: 0.18 })) +
      ink(M(20, 70) + L(12, 80) + Q(20, 78, 24, 76) + Q(28, 80, 34, 82) + Z, darken(DELFIN, 0.1), {
        'stroke-width': SW * 0.55,
      }) +
      ink(M(48, 32) + Q(46, 22, 54, 18) + Q(56, 26, 58, 31) + Z, darken(DELFIN, 0.1), {
        'stroke-width': SW * 0.55,
      }) +
      ink(body, s.url('body')) +
      h('path', {
        d: M(32, 66) + C(40, 50, 54, 42, 70, 40) + C(56, 44, 44, 54, 36, 70) + Z,
        fill: '#eaf4fc',
      }) +
      h('circle', { cx: 66, cy: 36, r: 1.9, fill: INK }) +
      line(M(72, 39) + Q(76, 41.5, 80, 39.5), INK, SW * 0.4) +
      ink(M(14, 86) + Q(30, 78, 50, 86) + Q(70, 94, 88, 84), 'none', { 'stroke-width': SW * 1.4 }) +
      line(M(14, 86) + Q(30, 78, 50, 86) + Q(70, 94, 88, 84), '#ffffff', SW * 0.6) +
      /** @type {[number, number, number][]} */ ([
        [78, 60, 2.6],
        [84, 54, 2],
        [76, 50, 1.6],
      ])
        .map(([x, y, r]) => ink(circleD(x, y, r), '#cfeafc', { 'stroke-width': SW * 0.3 }))
        .join(''),
  );
}

function stickerSevenSteps() {
  const s = scope('sticker-seven-steps');
  return g(
    { transform: 'translate(50 50) scale(0.88) translate(-50 -50)' },
    h('defs', null, shade(s.id('ice'), ICE, { light: 0.6, dark: 0.15 })) +
      ink(stepsD(7, 18, 80, 9.2, 7.4), s.url('ice')) +
      line(
        Array.from(
          { length: 7 },
          (_, i) =>
            M(18 + i * 9.2 + 1, 80 - (i + 1) * 7.4 + 1.6) +
            L(18 + (i + 1) * 9.2 - 1, 80 - (i + 1) * 7.4 + 1.6),
        ).join(''),
        '#ffffff',
        1.6,
      ) +
      Array.from({ length: 7 }, (_, i) =>
        ink(
          circleD(22.6 + i * 9.2, 80 - (i + 1) * 7.4 - 4.4, 2.6),
          ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#748ffc', '#b197fc'][i] ??
            '#ffffff',
          {
            'stroke-width': SW * 0.3,
          },
        ),
      ).join('') +
      sparkle(26, 30, 5),
  );
}

function stickerMeltedIcicle() {
  const s = scope('sticker-melted-icicle');
  const icicle =
    M(30, 18) + L(70, 18) + Q(64, 30, 56, 36) + L(50, 58) + L(44, 36) + Q(36, 30, 30, 18) + Z;
  return (
    h('defs', null, shade(s.id('ice'), '#bfe6fb', { light: 0.6, dark: 0.15 })) +
    ink(icicle, s.url('ice')) +
    ink(M(50, 62) + C(46, 68, 46, 72, 50, 73) + C(54, 72, 54, 68, 50, 62) + Z, '#8fd0f5', {
      'stroke-width': SW * 0.45,
    }) +
    ink(ellipseD(50, 80, 22, 5), '#8fd0f5', { 'stroke-width': SW * 0.55 }) +
    line(M(36, 80) + Q(50, 77, 64, 80), '#ffffff', 1.4, { opacity: 0.8 }) +
    gleam(M(38, 22) + L(46, 32), 1.8) +
    sparkle(76, 36, 6) +
    sparkle(24, 52, 4.5)
  );
}

function stickerCertificate() {
  const s = scope('sticker-certificate');
  const lines = [36, 44, 52].map((y, i) => M(30, y) + L(i === 2 ? 52 : 70, y)).join('');
  return (
    h('defs', null, shade(s.id('paper'), '#fff6e0', { light: 0.4, dark: 0.12 })) +
    ink(roundRectD(20, 22, 60, 48, 4), s.url('paper')) +
    ink(roundRectD(24, 26, 52, 40, 2), 'none', { 'stroke-width': 1.2, stroke: '#64b5f6' }) +
    line(lines, darken('#d8b26e', 0.35), 2, { opacity: 0.75 }) +
    ink(M(60, 64) + L(56, 84) + L(62, 80) + L(66, 86) + L(68, 66) + Z, '#e8513f', {
      'stroke-width': SW * 0.45,
    }) +
    ink(M(68, 64) + L(72, 84) + L(66, 80) + L(64, 86) + Z, '#c7402f', {
      'stroke-width': SW * 0.45,
    }) +
    ink(circleD(64, 62, 8), '#ffd166', { 'stroke-width': SW * 0.55 }) +
    ink(roundStarD(64, 62, 5, 4.6, 2, -90, 0.2), '#ffffff', { 'stroke-width': SW * 0.3 })
  );
}

/** @type {readonly { id: string; draw: () => string }[]} */
export const ICE_SEA_STICKERS = [
  { id: 'seal', draw: stickerSeal },
  { id: 'dolphin', draw: stickerDolphin },
  { id: 'seven-steps', draw: stickerSevenSteps },
  { id: 'melted-icicle', draw: stickerMeltedIcicle },
  { id: 'certificate', draw: stickerCertificate },
];

// -------------------------------------------------------------------------------------- cosmetics

/** A knitted bobble hat with a folded rib cuff; the brim centre is (50, 50). */
function hatKnit() {
  const s = scope('hat-knit');
  const crown = M(24, 46) + C(24, 26, 36, 18, 50, 18) + C(64, 18, 76, 26, 76, 46) + Z;
  const ribs = Array.from(
    { length: 9 },
    (_, i) => M(25 + i * 6.3, 46.5) + L(25 + i * 6.3, 55),
  ).join('');
  const vees = [26, 34]
    .map((y) =>
      Array.from({ length: 6 }, (_, i) => {
        const x = 31 + i * 8;
        return M(x - 3, y) + L(x, y + 3) + L(x + 3, y);
      }).join(''),
    )
    .join('');
  return (
    h(
      'defs',
      null,
      shade(s.id('wool'), KNIT, { light: 0.35, dark: 0.2 }),
      shade(s.id('cuff'), '#fff1e6', { light: 0.3, dark: 0.15 }),
    ) +
    ink(crown, s.url('wool')) +
    line(vees, lighten(KNIT, 0.45), 1.6, { opacity: 0.9 }) +
    ink(roundRectD(21, 44, 58, 12, 5), s.url('cuff')) +
    line(ribs, darken('#fff1e6', 0.18), 1.3) +
    ink(circleD(50, 16, 8), '#fff1e6') +
    line(
      M(45, 13) + L(47, 15) + M(52, 11) + L(54, 13) + M(49, 19) + L(51, 21),
      darken('#fff1e6', 0.2),
      1.2,
    ) +
    gleam(M(32, 36) + Q(34, 28, 40, 24), 2)
  );
}

/** A woollen scarf with white snowflake stitches; the knot is (50, 50). */
function scarfWool() {
  return scarf(
    'scarf-wool',
    '#3f7fd6',
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const x = 4 + (i % 6) * 18 + (Math.floor(i / 6) % 2) * 9;
        const y = 36 + Math.floor(i / 6) * 26;
        return line(
          M(x - 3, y) +
            L(x + 3, y) +
            M(x, y - 3) +
            L(x, y + 3) +
            M(x - 2, y - 2) +
            L(x + 2, y + 2) +
            M(x - 2, y + 2) +
            L(x + 2, y - 2),
          '#ffffff',
          1.1,
        );
      }).join('') +
      line(M(-4, 30) + L(104, 52) + M(-4, 70) + L(104, 92), '#ffffff', 2.4, { opacity: 0.7 }),
  );
}

/** A small igloo of snow blocks with a round doorway, standing at the bottom. */
function igloo() {
  const s = scope('igloo');
  const dome = M(12, 88) + C(12, 46, 30, 28, 50, 28) + C(70, 28, 88, 46, 88, 88) + Z;
  const joints =
    [74, 60, 46]
      .map((y) => M(12 + (88 - y) * 0.1, y) + Q(50, y - 6, 88 - (88 - y) * 0.1, y))
      .join('') +
    /** @type {[number, number, number, number][]} */ ([
      [30, 88, 30, 74],
      [70, 88, 70, 74],
      [40, 74, 40, 60],
      [60, 74, 60, 60],
      [50, 60, 50, 46],
      [24, 60, 26, 48],
      [76, 60, 74, 48],
    ])
      .map(([x0, y0, x1, y1]) => M(x0, y0) + L(x1, y1))
      .join('');
  const door = M(36, 88) + L(36, 72) + C(36, 60, 64, 60, 64, 72) + L(64, 88) + Z;
  return (
    h('defs', null, shade(s.id('snow'), '#eef7fd', { light: 0.5, dark: 0.18 })) +
    groundShadow(50, 92, 42, 4) +
    ink(dome, s.url('snow')) +
    line(joints, '#a9cbe4', 1.4) +
    ink(door, '#2f5f8f') +
    h('path', {
      d: M(40, 88) + L(40, 74) + C(40, 66, 60, 66, 60, 74) + L(60, 88) + Z,
      fill: '#ffd98a',
      opacity: 0.55,
    }) +
    gleam(M(22, 64) + Q(26, 46, 38, 36), 2.2) +
    g({ opacity: 0.9 }, ink(circleD(78, 30, 2.4), '#ffffff', { 'stroke-width': SW * 0.3 })) +
    ink(roundStarD(20, 24, 4, 5, 1.7, -90, 0.2), CREAM, { 'stroke-width': SW * 0.35 })
  );
}

/** @type {readonly { id: string; slot: 'head' | 'eyes' | 'neck' | 'grotto'; draw: () => string }[]} */
export const ICE_SEA_COSMETICS = [
  { id: 'hat-knit', slot: 'head', draw: hatKnit },
  { id: 'scarf-wool', slot: 'neck', draw: scarfWool },
  { id: 'igloo', slot: 'grotto', draw: igloo },
];
