// @ts-check
/**
 * Friends' eggs (`egg/<friend>`): 120 × 160 SVGs (3:4, as the shell's placeholder), one egg body
 * with the friend's colours and a motif from its memory hook, so a child can guess who hatches:
 * Krab Tvrďák's seven spikes, Medúzka Měkulka's nine tentacles, Želva Obojka's eight plates.
 */
import { darken, lighten, mix } from './lib/color.mjs';
import { C, L, M, Q, Z, eggD, roundCornersD, smoothOpenD } from './lib/path.mjs';
import { polar, prng } from './lib/num.mjs';
import { g, h } from './lib/xml.mjs';
import { CREAM, INK, SW, gleam, ink, line, scope, shade } from './style.mjs';

export const EGG_WIDTH = 120;
export const EGG_HEIGHT = 160;

const CX = 60;
const CY = 84;
const EW = 92;
const EH = 130;
const SHELL = eggD(CX, CY, EW, EH);

/** @typedef {{ id: string; base: string; motif: (clip: string) => string }} EggDesign */

/**
 * Speckles scattered over the egg (deterministic).
 *
 * @param {number} seed @param {number} count @param {string} color @param {number} [size]
 */
function speckles(seed, count, color, size = 2.2) {
  const next = prng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = 22 + next() * 76;
    const y = 30 + next() * 110;
    const r = size * (0.6 + next() * 0.8);
    out += h('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, fill: color, opacity: 0.7 });
  }
  return out;
}

/** Krab Tvrďák: tomato red, the cream underside, a band of seven hard bone-white spikes. */
function krab() {
  const spikes = Array.from({ length: 7 }, (_, i) => {
    const x = 21 + i * 13;
    const y = 77 + (i - 3) * (i - 3) * 0.55;
    return roundCornersD(
      [
        { x: x - 6.2, y: y + 5 },
        { x, y: y - 9.5 },
        { x: x + 6.2, y: y + 5 },
      ],
      0.22,
    );
  }).join('');
  const belly = M(10, 104) + C(36, 96, 84, 96, 110, 104) + L(110, 160) + L(10, 160) + Z;
  return (
    h('path', { d: belly, fill: '#fbe9cf' }) +
    line(M(10, 104) + C(36, 96, 84, 96, 110, 104), INK, SW * 0.8, { opacity: 0.8 }) +
    ink(spikes, '#fbf3e3', { 'stroke-width': SW * 0.8 }) +
    speckles(7101, 9, darken('#ef5a43', 0.25), 2)
  );
}

/** Medúzka Měkulka: soft lilac-pink jelly, a frilly cap edge and nine soft wavy tentacles. */
function meduzka() {
  const frill = Array.from({ length: 9 }, (_, i) => Q(14 + i * 11.6, 80, 19.8 + i * 11.6, 70)).join(
    '',
  );
  const tentacles = Array.from({ length: 9 }, (_, i) => {
    const x = 18 + i * 10.5;
    const sway = i % 2 ? 3.5 : -3.5;
    return smoothOpenD(
      [
        { x, y: 82 },
        { x: x + sway, y: 98 },
        { x: x - sway, y: 114 },
        { x: x + sway * 0.6, y: 130 },
      ],
      1,
    );
  }).join('');
  return (
    h('path', {
      d: M(0, 0) + L(0, 70) + L(8, 70) + frill + L(120, 70) + L(120, 0) + Z,
      fill: '#f7b3d6',
      opacity: 0.55,
    }) +
    line(M(8, 70) + frill, INK, SW * 0.7, { opacity: 0.6 }) +
    line(tentacles, '#ffffff', 4.2, { opacity: 0.65 }) +
    line(tentacles, '#d97fc0', 1.8, { opacity: 0.8 }) +
    h('circle', { cx: 84, cy: 46, r: 4, fill: '#ffffff', opacity: 0.55 }) +
    h('circle', { cx: 92, cy: 58, r: 2.5, fill: '#ffffff', opacity: 0.5 }) +
    h('circle', { cx: 36, cy: 138, r: 3, fill: '#ffffff', opacity: 0.45 })
  );
}

/** Želva Obojka: sea green with eight rounded shell plates and a sandy beach band below. */
function zelva() {
  const plates = [
    [49, 46],
    [71, 46],
    [38, 66],
    [60, 66],
    [82, 66],
    [38, 88],
    [60, 88],
    [82, 88],
  ]
    .map(([x, y]) => {
      const pts = Array.from({ length: 6 }, (_, k) =>
        polar(/** @type {number} */ (x), /** @type {number} */ (y), 11.2, -90 + k * 60),
      );
      return roundCornersD(pts, 0.26);
    })
    .join('');
  const sand = M(10, 116) + C(40, 108, 80, 122, 110, 112) + L(110, 160) + L(10, 160) + Z;
  return (
    ink(plates, mix('#5dbb8a', '#2f8f6a', 0.45), { 'stroke-width': SW * 0.7 }) +
    line(plates, lighten('#5dbb8a', 0.45), 1.4, {
      opacity: 0.6,
      transform: 'translate(-0.8 -0.8)',
    }) +
    h('path', { d: sand, fill: '#f3d9a1' }) +
    line(M(10, 116) + C(40, 108, 80, 122, 110, 112), INK, SW * 0.8, { opacity: 0.8 }) +
    speckles(7301, 7, '#d8b26c', 1.6) +
    line(M(22, 130) + Q(30, 126, 38, 130) + M(70, 136) + Q(78, 132, 86, 136), '#ffffff', 2, {
      opacity: 0.7,
    })
  );
}

/** @type {readonly EggDesign[]} */
export const EGG_DESIGNS = [
  { id: 'krab-tvrdak', base: '#ef5a43', motif: krab },
  { id: 'meduzka-mekulka', base: '#e9a6e0', motif: meduzka },
  { id: 'zelva-obojka', base: '#5dbb8a', motif: zelva },
];

/**
 * The SVG body of an egg: a soft shadow, the shaded shell, the motif clipped to the shell, the
 * outline and a gleam.
 *
 * @param {EggDesign} design
 */
export function drawEgg(design) {
  const s = scope(`egg-${design.id}`);
  return (
    h(
      'defs',
      null,
      shade(s.id('shell'), design.base, { light: 0.45, dark: 0.2, cx: 0.36, cy: 0.3, r: 0.85 }),
      h('clipPath', { id: s.id('clip') }, h('path', { d: SHELL })),
      h(
        'radialGradient',
        { id: s.id('light'), cx: 0.34, cy: 0.26, r: 0.75 },
        h('stop', { offset: 0, 'stop-color': CREAM, 'stop-opacity': 0.55 }),
        h('stop', { offset: 0.5, 'stop-color': CREAM, 'stop-opacity': 0 }),
      ),
    ) +
    h('ellipse', { cx: CX, cy: 151, rx: 36, ry: 5.5, fill: INK, opacity: 0.16 }) +
    h('path', { d: SHELL, fill: s.url('shell') }) +
    g(
      { 'clip-path': s.url('clip') },
      design.motif(s.id('clip')),
      h('path', { d: SHELL, fill: s.url('light') }),
    ) +
    ink(SHELL, 'none', { 'stroke-width': SW * 1.15 }) +
    gleam(M(34, 50) + Q(38, 36, 48, 29), 4, 0.8) +
    gleam(M(30, 62) + L(30.5, 66), 3, 0.6)
  );
}
