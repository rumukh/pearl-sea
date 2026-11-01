// @ts-check
/**
 * Sticker art (`sticker/<icon>` and `sticker/frame-shell`): 100 × 100 SVGs that the shell
 * composes as Dragon Valley's composer does, in three layers of one square box: a disc of the
 * sticker's colour (centre 50, 50, radius 40), the frame, then the icon (docs/art.md §9).
 *
 * - The frame is transparent inside `FRAME_WINDOW` (radius 38), except a soft sheen, and covers
 *   the disc's edge from 38 out; it adds the shell rim, the white die-cut edge and the shadow.
 * - An icon stays within `ICON_RADIUS` (36) of the centre, in full colour with the plum outline,
 *   so it reads on any disc colour.
 */
import { lighten } from './lib/color.mjs';
import {
  C,
  L,
  M,
  Q,
  Z,
  circleD,
  ellipseD,
  roundCornersD,
  roundStarD,
  scallopD,
  smoothOpenD,
} from './lib/path.mjs';
import { polar } from './lib/num.mjs';
import { g, h } from './lib/xml.mjs';
import { CREAM, INK, SW, gleam, ink, line, scope, shade } from './style.mjs';

export const STICKER_SIZE = 100;
export const DISC_RADIUS = 40;
export const FRAME_WINDOW = 38;
export const ICON_RADIUS = 36;

/** @typedef {{ id: string; draw: () => string }} StickerDesign */

/** A four-point sparkle. @param {number} cx @param {number} cy @param {number} r */
function sparkle(cx, cy, r) {
  const d =
    M(cx, cy - r) +
    Q(cx + r * 0.18, cy - r * 0.18, cx + r, cy) +
    Q(cx + r * 0.18, cy + r * 0.18, cx, cy + r) +
    Q(cx - r * 0.18, cy + r * 0.18, cx - r, cy) +
    Q(cx - r * 0.18, cy - r * 0.18, cx, cy - r) +
    Z;
  return ink(d, '#ffffff', { 'stroke-width': SW * 0.5 });
}

/** A bubble. @param {number} cx @param {number} cy @param {number} r */
function bubble(cx, cy, r) {
  return (
    h('circle', {
      cx,
      cy,
      r,
      fill: '#e8fbff',
      'fill-opacity': 0.55,
      stroke: INK,
      'stroke-width': SW * 0.45,
    }) +
    h('circle', {
      cx: cx - r * 0.35,
      cy: cy - r * 0.38,
      r: r * 0.28,
      fill: '#ffffff',
      opacity: 0.95,
    })
  );
}

// ---------------------------------------------------------------------------------------- frame

function frameShell() {
  const s = scope('frame-shell');
  const outer = scallopD(50, 50, 41, 41, 16, 3.2);
  const rim = outer + circleD(50, 50, FRAME_WINDOW);
  const ribs = Array.from({ length: 32 }, (_, i) => {
    const a = (i * 360) / 32;
    const p = polar(50, 50, FRAME_WINDOW + 1, a);
    const q = polar(50, 50, 42.2, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  return (
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: s.id('rim'), cx: 0.34, cy: 0.28, r: 0.8 },
        h('stop', { offset: 0, 'stop-color': '#fffaf2' }),
        h('stop', { offset: 0.7, 'stop-color': '#f7e6d6' }),
        h('stop', { offset: 1, 'stop-color': '#e9c9b6' }),
      ),
      h(
        'radialGradient',
        { id: s.id('sheen'), cx: 0.32, cy: 0.26, r: 0.62 },
        h('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.55 }),
        h('stop', { offset: 0.55, 'stop-color': '#ffffff', 'stop-opacity': 0.12 }),
        h('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }),
      ),
    ) +
    h('path', {
      d: rim,
      transform: 'translate(1.2 2.2)',
      fill: INK,
      opacity: 0.18,
      'fill-rule': 'evenodd',
    }) +
    h('path', {
      d: rim,
      fill: '#ffffff',
      stroke: '#ffffff',
      'stroke-width': 5,
      'stroke-linejoin': 'round',
      'fill-rule': 'evenodd',
    }) +
    h('path', { d: rim, fill: s.url('rim'), 'fill-rule': 'evenodd' }) +
    line(ribs, INK, 0.9, { opacity: 0.28 }) +
    h('path', {
      d: rim,
      fill: 'none',
      stroke: INK,
      'stroke-width': SW * 0.8,
      'stroke-linejoin': 'round',
    }) +
    h('circle', { cx: 50, cy: 50, r: FRAME_WINDOW, fill: s.url('sheen') }) +
    [45, 135, 225, 315]
      .map((a) => {
        const p = polar(50, 50, 40.6, a);
        return (
          h('circle', {
            cx: p.x,
            cy: p.y,
            r: 2.4,
            fill: '#fdf6ec',
            stroke: INK,
            'stroke-width': SW * 0.4,
          }) + h('circle', { cx: p.x - 0.8, cy: p.y - 0.8, r: 0.8, fill: '#ffffff' })
        );
      })
      .join('')
  );
}

// ---------------------------------------------------------------------------------------- icons

function eggHatching() {
  const s = scope('egg-hatching');
  /** The cracked edge: a zigzag across the egg at `y`. @param {number} y */
  const crack = (y) =>
    Array.from({ length: 9 }, (_, i) => ({ x: 28 + i * 5.5, y: y + (i % 2 ? 1 : -5) }));
  const bottom =
    M(28, 56) +
    crack(61)
      .slice(1)
      .map((p) => L(p.x, p.y))
      .join('') +
    C(74, 77, 64, 89, 50, 89) +
    C(36, 89, 26, 77, 28, 56) +
    Z;
  const cap =
    M(28, 41) +
    C(28, 28, 38, 20, 50, 20) +
    C(62, 20, 72, 28, 72, 41) +
    crack(46)
      .reverse()
      .slice(1)
      .map((p) => L(p.x, p.y))
      .join('') +
    Z;
  return g(
    { transform: 'translate(50 50) scale(0.9) translate(-50 -51)' },
    h('defs', null, shade(s.id('shell'), '#fff1d2', { light: 0.6, dark: 0.15 })),
    g(
      { transform: 'translate(6 -6) rotate(22 50 40)' },
      ink(cap, s.url('shell')),
      h('circle', { cx: 44, cy: 31, r: 3, fill: '#ffb3c7' }),
      h('circle', { cx: 58, cy: 35, r: 2.2, fill: '#9fe0e8' }),
    ),
    h('ellipse', { cx: 50, cy: 61, rx: 19, ry: 9, fill: '#3d1430' }),
    h('ellipse', { cx: 44, cy: 55, rx: 3.6, ry: 4.4, fill: '#ffffff' }),
    h('ellipse', { cx: 56, cy: 55, rx: 3.6, ry: 4.4, fill: '#ffffff' }),
    h('circle', { cx: 44.7, cy: 56.2, r: 2, fill: INK }),
    h('circle', { cx: 56.7, cy: 56.2, r: 2, fill: INK }),
    ink(bottom, s.url('shell')),
    h('circle', { cx: 40, cy: 76, r: 3.2, fill: '#ffb3c7' }),
    h('circle', { cx: 60, cy: 79, r: 2.6, fill: '#9fe0e8' }),
    h('circle', { cx: 52, cy: 70, r: 2, fill: '#ffd36b' }),
    gleam(M(33, 70) + Q(34, 78, 39, 83), 2.2),
    sparkle(20, 52, 5),
    sparkle(82, 66, 4),
  );
}

function emblemSunnyLagoon() {
  const s = scope('emblem-sunny-lagoon');
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = -180 + i * 20;
    const p = polar(50, 50, 18, a);
    const q = polar(50, 50, 25, a);
    return M(p.x, p.y) + L(q.x, q.y);
  }).join('');
  let wave1 = M(10, 56);
  for (let x = 10; x < 90; x += 16) wave1 += Q(x + 4, 51, x + 8, 56) + Q(x + 12, 61, x + 16, 56);
  let wave2 = M(10, 68);
  for (let x = 6; x < 92; x += 16) wave2 += Q(x + 4, 63, x + 8, 68) + Q(x + 12, 73, x + 16, 68);
  return (
    h(
      'defs',
      null,
      h('clipPath', { id: s.id('round') }, h('circle', { cx: 50, cy: 50, r: 34 })),
      h(
        'linearGradient',
        { id: s.id('sky'), x1: 0, y1: 0, x2: 0, y2: 1 },
        h('stop', { offset: 0, 'stop-color': '#bff0f2' }),
        h('stop', { offset: 1, 'stop-color': '#fff3c4' }),
      ),
      shade(s.id('sun'), '#ffd23f', { light: 0.6, dark: 0.1 }),
    ) +
    g(
      { 'clip-path': s.url('round') },
      h('rect', { x: 0, y: 0, width: 100, height: 100, fill: s.url('sky') }),
      line(rays, '#ffb72e', 3.4),
      h('circle', {
        cx: 50,
        cy: 50,
        r: 14,
        fill: s.url('sun'),
        stroke: INK,
        'stroke-width': SW * 0.8,
      }),
      h('path', {
        d: wave1 + L(100, 100) + L(0, 100) + Z,
        fill: '#3cc3cf',
        stroke: INK,
        'stroke-width': SW * 0.8,
      }),
      h('path', {
        d: wave2 + L(100, 100) + L(0, 100) + Z,
        fill: '#1e9fb8',
        stroke: INK,
        'stroke-width': SW * 0.8,
      }),
      h('path', {
        d: M(0, 80) + Q(50, 72, 100, 80) + L(100, 100) + L(0, 100) + Z,
        fill: '#f6dc9c',
        stroke: INK,
        'stroke-width': SW * 0.8,
      }),
      gleam(M(22, 60) + L(30, 60) + M(60, 72) + L(70, 72), 1.8, 0.8),
    ) +
    h('circle', { cx: 50, cy: 50, r: 34, fill: 'none', stroke: INK, 'stroke-width': SW })
  );
}

/**
 * A scallop shell for icons: hinge down, `w` wide at (cx, cy).
 *
 * @param {string} key @param {number} cx @param {number} cy @param {number} w @param {string} color @param {number} [rot]
 */
function fanShell(key, cx, cy, w, color, rot = 0) {
  const s = scope(key);
  const r = w / 2;
  const fan =
    M(cx - r * 0.3, cy + r * 0.66) +
    C(cx - r * 1.08, cy + r * 0.22, cx - r * 1.04, cy - r * 0.6, cx - r * 0.5, cy - r * 0.86) +
    Q(cx, cy - r * 1.12, cx + r * 0.5, cy - r * 0.86) +
    C(cx + r * 1.04, cy - r * 0.6, cx + r * 1.08, cy + r * 0.22, cx + r * 0.3, cy + r * 0.66) +
    Z;
  const ribs = [-0.6, -0.3, 0, 0.3, 0.6]
    .map(
      (k) =>
        M(cx + k * r * 0.25, cy + r * 0.6) +
        Q(cx + k * r * 0.9, cy - r * 0.2, cx + k * r * 1.1, cy - r * 0.8),
    )
    .join('');
  return g(
    rot ? { transform: `rotate(${rot} ${cx} ${cy})` } : null,
    h('defs', null, shade(s.id('fan'), color, { light: 0.55, dark: 0.14 })),
    ink(
      M(cx - r * 0.42, cy + r * 0.55) +
        L(cx + r * 0.42, cy + r * 0.55) +
        L(cx + r * 0.3, cy + r * 0.86) +
        L(cx - r * 0.3, cy + r * 0.86) +
        Z,
      lighten(color, 0.25),
      { 'stroke-width': SW * 0.75 },
    ),
    ink(fan, s.url('fan')),
    line(ribs, INK, SW * 0.45, { opacity: 0.5 }),
  );
}

function threeShells() {
  const s = scope('three-shells');
  const spiral = smoothOpenD(
    [
      { x: 69, y: 45 },
      { x: 72, y: 41.5 },
      { x: 76.5, y: 44 },
      { x: 76, y: 50 },
      { x: 69.5, y: 53.5 },
      { x: 62.5, y: 49.5 },
      { x: 62, y: 41 },
      { x: 68, y: 34.5 },
    ],
    1,
  );
  return (
    h('defs', null, shade(s.id('snail'), '#ffc46b', { light: 0.55 })) +
    fanShell('three-shells-fan', 33, 44, 32, '#ff9fb8', -14) +
    ink(circleD(69, 45, 15), s.url('snail')) +
    line(spiral, INK, SW * 0.6, { opacity: 0.75 }) +
    ink(M(56, 52) + Q(54, 60, 61, 61) + Q(66, 58, 63, 53) + Z, '#ffe2b8', {
      'stroke-width': SW * 0.7,
    }) +
    fanShell('three-shells-clam', 50, 70, 26, '#7fd6d0', 8) +
    gleam(M(60, 36) + Q(63, 32, 67, 31.5), 1.8, 0.8)
  );
}

function musicNotes() {
  const s = scope('music-notes');
  const head = (/** @type {number} */ x, /** @type {number} */ y) => ellipseD(x, y, 7.5, 5.6);
  return (
    h('defs', null, shade(s.id('note'), '#fff3c9', { light: 0.6, dark: 0.12 })) +
    g(
      { transform: 'rotate(-8 50 50)' },
      ink(M(39, 66) + L(39, 30) + L(68, 24) + L(68, 60), 'none', { 'stroke-width': SW * 2.1 }),
      line(M(39, 66) + L(39, 30) + M(68, 24) + L(68, 60), '#fff3c9', SW * 0.9),
      ink(M(37.5, 27.5) + L(69.5, 21) + L(69.5, 30) + L(37.5, 36.5) + Z, s.url('note')),
      ink(head(33, 67), s.url('note'), { transform: 'rotate(-20 33 67)' }),
      ink(head(62, 61), s.url('note'), { transform: 'rotate(-20 62 61)' }),
    ) +
    bubble(76, 74, 5.5) +
    bubble(22, 36, 4) +
    bubble(82, 38, 3) +
    gleam(M(28, 64) + Q(29.5, 61.5, 32.5, 61), 1.6)
  );
}

function starShell() {
  const s = scope('star-shell');
  const star = roundStarD(50, 52, 5, 34, 15, -90, 0.3);
  const dots = Array.from({ length: 5 }, (_, i) => {
    const a = -90 + i * 72;
    return [polar(50, 52, 14, a), polar(50, 52, 23, a)];
  }).flat();
  return (
    h('defs', null, shade(s.id('star'), '#ff8a5c', { light: 0.5, dark: 0.15 })) +
    ink(star, s.url('star')) +
    dots
      .map((p) =>
        h('circle', {
          cx: p.x,
          cy: p.y,
          r: 2.6,
          fill: '#fff1d6',
          stroke: INK,
          'stroke-width': SW * 0.35,
        }),
      )
      .join('') +
    h('circle', { cx: 50, cy: 52, r: 5, fill: '#fff1d6', stroke: INK, 'stroke-width': SW * 0.5 }) +
    h('circle', { cx: 48.6, cy: 50.6, r: 1.5, fill: '#ffffff' }) +
    gleam(M(36, 44) + Q(40, 40, 45, 39), 2) +
    sparkle(80, 24, 5)
  );
}

function bow() {
  const s = scope('bow');
  const wing = (/** @type {number} */ k) =>
    M(50, 46) +
    C(50 - 10 * k, 30, 50 - 34 * k, 22, 50 - 36 * k, 36) +
    C(50 - 38 * k, 48, 50 - 30 * k, 60, 50, 50) +
    Z;
  const tail = (/** @type {number} */ k) =>
    M(50 - 3 * k, 52) +
    L(50 - 16 * k, 82) +
    L(50 - 9 * k, 78) +
    L(50 - 4 * k, 84) +
    L(50 + 4 * k, 54) +
    Z;
  const dots = [
    [30, 36],
    [36, 44],
    [24, 42],
    [70, 36],
    [64, 44],
    [76, 42],
  ];
  return (
    h('defs', null, shade(s.id('silk'), '#3aa9dc')) +
    ink(tail(1), s.url('silk')) +
    ink(tail(-1), s.url('silk')) +
    ink(wing(1), s.url('silk')) +
    ink(wing(-1), s.url('silk')) +
    dots.map(([x, y]) => h('circle', { cx: x, cy: y, r: 2.4, fill: CREAM })).join('') +
    ink(ellipseD(50, 48, 7.5, 8.5), s.url('silk')) +
    gleam(M(19, 36) + Q(21, 29, 27, 27), 2.2) +
    gleam(M(46, 44) + Q(47, 42, 49.5, 41.5), 1.6)
  );
}

function inkDrops() {
  const s = scope('ink-drops');
  const drop = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r) =>
    M(cx, cy - r * 1.7) +
    C(cx + r * 0.4, cy - r * 0.9, cx + r, cy - r * 0.45, cx + r, cy + r * 0.15) +
    C(cx + r, cy + r * 0.75, cx + r * 0.5, cy + r, cx, cy + r) +
    C(cx - r * 0.5, cy + r, cx - r, cy + r * 0.75, cx - r, cy + r * 0.15) +
    C(cx - r, cy - r * 0.45, cx - r * 0.4, cy - r * 0.9, cx, cy - r * 1.7) +
    Z;
  /** @type {[number, number, number][]} */
  const drops = [
    [36, 56, 13],
    [62, 50, 11],
    [52, 74, 8],
  ];
  return (
    h('defs', null, shade(s.id('ink'), '#3a2d6b', { light: 0.35, dark: 0.35 })) +
    h('path', { d: scallopD(50, 56, 27, 24, 11, 4), fill: '#ffffff', opacity: 0.85 }) +
    drops
      .map(
        ([x, y, r]) =>
          ink(drop(x, y, r), s.url('ink')) +
          gleam(
            M(x - r * 0.55, y) + Q(x - r * 0.5, y - r * 0.6, x - r * 0.15, y - r * 0.95),
            1.8,
            0.8,
          ),
      )
      .join('') +
    h('circle', { cx: 33, cy: 58, r: 1.6, fill: '#ffffff' }) +
    h('circle', { cx: 40, cy: 58, r: 1.6, fill: '#ffffff' }) +
    h('ellipse', {
      cx: 36.5,
      cy: 63.5,
      rx: 1.5,
      ry: 1.9,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 1.3,
    }) +
    bubble(76, 70, 6) +
    bubble(24, 34, 4.5) +
    bubble(70, 28, 3.5)
  );
}

function sunWeek() {
  const s = scope('sun-week');
  const rays = Array.from({ length: 7 }, (_, i) => {
    const a = -90 + (i * 360) / 7;
    const p = polar(50, 50, 21, a - 9);
    const tip = polar(50, 50, 34, a);
    const q = polar(50, 50, 21, a + 9);
    return roundCornersD([p, tip, q], 0.2);
  }).join('');
  return (
    h(
      'defs',
      null,
      shade(s.id('sun'), '#ffd84a', { light: 0.6, dark: 0.12 }),
      shade(s.id('ray'), '#ffb01f'),
    ) +
    ink(rays, s.url('ray')) +
    ink(circleD(50, 50, 21), s.url('sun')) +
    h('ellipse', { cx: 43, cy: 48, rx: 2.2, ry: 3, fill: INK }) +
    h('ellipse', { cx: 57, cy: 48, rx: 2.2, ry: 3, fill: INK }) +
    h('circle', { cx: 38, cy: 55, r: 3, fill: '#ff9a8b', opacity: 0.8 }) +
    h('circle', { cx: 62, cy: 55, r: 3, fill: '#ff9a8b', opacity: 0.8 }) +
    line(M(44, 56) + Q(50, 61.5, 56, 56), INK, SW * 0.7) +
    gleam(M(36, 42) + Q(38, 36, 44, 33.5), 2.2)
  );
}

function coins() {
  const s = scope('coins');
  const coin = (/** @type {number} */ cx, /** @type {number} */ cy) =>
    ink(
      M(cx - 17, cy) +
        L(cx - 17, cy + 5) +
        C(cx - 17, cy + 10, cx + 17, cy + 10, cx + 17, cy + 5) +
        L(cx + 17, cy) +
        Z,
      '#d99a1e',
    ) + ink(ellipseD(cx, cy, 17, 5.5), s.url('gold'));
  return (
    h(
      'defs',
      null,
      shade(s.id('gold'), '#ffd24a', { light: 0.55, dark: 0.15 }),
      shade(s.id('face'), '#ffcd3c', { light: 0.6, dark: 0.18 }),
    ) +
    coin(38, 72) +
    coin(38, 64) +
    coin(40, 56) +
    coin(37, 48) +
    ink(circleD(63, 58, 19), '#d99a1e') +
    ink(circleD(64.5, 57, 17.5), s.url('face')) +
    h('circle', {
      cx: 64.5,
      cy: 57,
      r: 12.5,
      fill: 'none',
      stroke: '#b97a10',
      'stroke-width': 1.6,
    }) +
    fanShell('coins-shell', 64.5, 57, 13, '#fff1c4') +
    gleam(M(52, 52) + Q(54, 45, 60, 42), 2.2) +
    sparkle(80, 30, 5)
  );
}

/** @type {readonly StickerDesign[]} */
export const STICKER_DESIGNS = [
  { id: 'frame-shell', draw: frameShell },
  { id: 'egg-hatching', draw: eggHatching },
  { id: 'emblem-sunny-lagoon', draw: emblemSunnyLagoon },
  { id: 'three-shells', draw: threeShells },
  { id: 'music-notes', draw: musicNotes },
  { id: 'star-shell', draw: starShell },
  { id: 'bow', draw: bow },
  { id: 'ink-drops', draw: inkDrops },
  { id: 'sun-week', draw: sunWeek },
  { id: 'coins', draw: coins },
];
