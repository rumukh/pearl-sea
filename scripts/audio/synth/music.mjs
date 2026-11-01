/**
 * Music theory and notation: pitch names, a compact melody notation with bar validation, chord
 * symbols, scales, voice-led chord voicings and accompaniment patterns. Everything is pure data in,
 * events out (beats are quarter notes).
 *
 * Melody tokens, separated by spaces:
 *   C5:q  F#4:e.  Bb3:h'  r:q  [C4,E4,G4]:h  |  (bar line, validated against the meter)
 *   durations: w h q e s t (whole .. 32nd), dotted '.', double dotted '..', triplet '3' (e3),
 *   or explicit beats like 1.5b
 *   articulation suffixes: ' staccato, _ tenuto, > accent, ! strong accent, ? ghost, ~ tie
 *   dynamics tokens: pp p mp mf f ff (set the base velocity of the following notes)
 */

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DURATIONS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 0.125 };
const DYNAMICS = { pp: 0.42, p: 0.55, mp: 0.68, mf: 0.8, f: 0.9, ff: 1 };

export const SCALES = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
});

const CHORD_QUALITIES = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
};

/** 'C4' -> 60, 'F#3' -> 54, 'Bb5' -> 82. Accepts a number (MIDI) as-is. */
export function noteToMidi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name ${name}`);
  let pc = LETTERS[m[1]];
  if (m[2]) pc += m[2][0] === '#' ? m[2].length : -m[2].length;
  return 12 * (Number(m[3]) + 1) + pc;
}

function parsePitchClass(text) {
  const m = /^([A-G])(#|b)?/.exec(text);
  if (!m) throw new Error(`Bad pitch class in ${text}`);
  let pc = LETTERS[m[1]];
  if (m[2] === '#') pc += 1;
  if (m[2] === 'b') pc -= 1;
  return { pc: (pc + 12) % 12, rest: text.slice(m[0].length) };
}

export function parseDuration(text) {
  const explicit = /^(\d+(?:\.\d+)?)b$/.exec(text);
  if (explicit) return Number(explicit[1]);
  const m = /^([whqest])(\.{0,2})(3?)$/.exec(text);
  if (!m) throw new Error(`Bad duration ${text}`);
  let beats = DURATIONS[m[1]];
  if (m[2] === '.') beats *= 1.5;
  if (m[2] === '..') beats *= 1.75;
  if (m[3]) beats = (beats * 2) / 3;
  return beats;
}

/** Beats per bar for a meter [numerator, denominator]. */
export function beatsPerBar(meter) {
  return (meter[0] * 4) / meter[1];
}

/**
 * Parse melody notation into events {beat, beats, midi: number[], velocity, gate}.
 * If barBeats is given, every bar (between '|') must contain exactly that many beats.
 *
 * @param {string} text
 * @param {{ barBeats?: number, gate?: number, velocity?: number }} [options]
 * @returns {{ events: { beat: number, beats: number, midi: number[], velocity: number, gate: number }[], beats: number }}
 */
export function parseMelody(text, { barBeats, gate = 0.92, velocity = 0.8 } = {}) {
  const events = [];
  let beat = 0;
  let barStart = 0;
  let bar = 1;
  let base = velocity;
  let pendingTie = null;
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const checkBar = () => {
    if (barBeats !== undefined && Math.abs(beat - barStart - barBeats) > 1e-9)
      throw new Error(
        `Bar ${bar} has ${beat - barStart} beats, expected ${barBeats}: ${text.slice(0, 80)}`,
      );
    barStart = beat;
    bar++;
  };
  for (const token of tokens) {
    if (token === '|') {
      checkBar();
      continue;
    }
    if (DYNAMICS[token] !== undefined) {
      base = DYNAMICS[token];
      continue;
    }
    const m = /^(\[[^\]]+\]|[A-Gr-][#b]{0,2}-?\d?):([^'_>!?~]+)([' _>!?~]*)$/.exec(token);
    if (!m) throw new Error(`Bad melody token "${token}"`);
    const [, pitchText, durText, marks] = m;
    const beats = parseDuration(durText);
    const isRest = pitchText === 'r' || pitchText === '-';
    if (isRest) {
      pendingTie = null;
      beat += beats;
      continue;
    }
    const midi = pitchText.startsWith('[')
      ? pitchText
          .slice(1, -1)
          .split(',')
          .map((p) => noteToMidi(p.trim()))
      : [noteToMidi(pitchText)];
    let vel = base;
    let g = gate;
    if (marks.includes('>')) vel = Math.min(1, vel + 0.12);
    if (marks.includes('!')) vel = Math.min(1, vel + 0.2);
    if (marks.includes('?')) vel *= 0.6;
    if (marks.includes("'")) g = 0.5;
    if (marks.includes('_')) g = 0.99;
    if (pendingTie && pendingTie.midi.join() === midi.join()) {
      pendingTie.beats += beats;
      pendingTie.gate = g;
      pendingTie = marks.includes('~') ? pendingTie : null;
    } else {
      const event = { beat, beats, midi, velocity: vel, gate: g };
      events.push(event);
      pendingTie = marks.includes('~') ? event : null;
    }
    beat += beats;
  }
  if (barBeats !== undefined && beat > barStart) checkBar();
  return { events, beats: beat };
}

/** Parse a chord symbol: 'F', 'Dm7', 'C7', 'Bbmaj7', 'F/A', 'G7sus4'. */
export function parseChord(symbol) {
  const [main, slash] = symbol.split('/');
  const { pc: root, rest } = parsePitchClass(main);
  const intervals = CHORD_QUALITIES[rest];
  if (!intervals) throw new Error(`Unknown chord quality "${rest}" in ${symbol}`);
  const bass = slash ? parsePitchClass(slash).pc : root;
  return { symbol, root, intervals, bass, pcs: intervals.map((i) => (root + i) % 12) };
}

/**
 * Parse a chord chart: bars separated by '|', chords inside a bar split it evenly unless they
 * carry explicit beats ('Gm:2 C7:1'). Returns [{beat, beats, chord}].
 */
export function parseChordChart(text, barBeats) {
  const bars = text
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const out = [];
  bars.forEach((barText, index) => {
    const items = barText.split(/\s+/).map((item) => {
      const [symbol, beats] = item.split(':');
      return { symbol, beats: beats === undefined ? undefined : Number(beats) };
    });
    const explicit = items.filter((i) => i.beats !== undefined).reduce((a, i) => a + i.beats, 0);
    const implicit = items.filter((i) => i.beats === undefined).length;
    const each = implicit ? (barBeats - explicit) / implicit : 0;
    let beat = index * barBeats;
    for (const item of items) {
      const beats = item.beats ?? each;
      out.push({ beat, beats, chord: parseChord(item.symbol) });
      beat += beats;
    }
    if (Math.abs(beat - (index + 1) * barBeats) > 1e-9)
      throw new Error(`Chord bar ${index + 1} does not fill the bar: ${barText}`);
  });
  return { chords: out, beats: bars.length * barBeats };
}

/** Pitch classes of a chord in voicing priority: 3rd, 7th/6th, extensions, root, 5th. */
function priorityTones(chord) {
  const has = (i) => chord.intervals.includes(i);
  const order = [];
  const push = (i) => {
    if (has(i)) order.push((chord.root + i) % 12);
  };
  [4, 3, 5, 2].forEach(push); // third (or sus tone)
  [10, 11, 9].forEach(push); // seventh or sixth
  [14].forEach(push); // ninth
  order.push(chord.root);
  [7, 6, 8].forEach(push); // fifth
  return [...new Set(order)];
}

function candidatePitches(pc, low, high) {
  const out = [];
  for (let m = low; m <= high; m++) if (((m % 12) + 12) % 12 === pc) out.push(m);
  return out;
}

/** Choose `size` voiced pitches in [low, high] for a chord, closest to `previous` (smooth leading). */
export function voiceChord(chord, { low, high, size = 3, previous = null, center }) {
  const tones = priorityTones(chord);
  const chosen = tones.slice(0, size);
  while (chosen.length < size) chosen.push(tones[chosen.length % tones.length]);
  const options = chosen.map((pc) => candidatePitches(pc, low, high));
  const mid = center ?? (low + high) / 2;
  let best = null;
  let bestCost = Infinity;
  const pick = new Array(size);
  const search = (i) => {
    if (i === size) {
      const sorted = [...pick].sort((a, b) => a - b);
      for (let k = 1; k < size; k++) if (sorted[k] === sorted[k - 1]) return;
      let cost = 0;
      for (let k = 1; k < size; k++) {
        const gap = sorted[k] - sorted[k - 1];
        if (gap > 9) cost += (gap - 9) * 1.5;
        if (gap < 3 && sorted[k - 1] < 55) cost += 4;
      }
      if (previous) {
        for (let k = 0; k < size; k++)
          cost += Math.abs(sorted[k] - previous[Math.min(k, previous.length - 1)]);
      } else {
        const avg = sorted.reduce((a, b) => a + b, 0) / size;
        cost += Math.abs(avg - mid) * 2;
      }
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = sorted;
      }
      return;
    }
    for (const m of options[i]) {
      pick[i] = m;
      search(i + 1);
    }
  };
  search(0);
  if (!best) throw new Error(`No voicing for ${chord.symbol} in range ${low}-${high}`);
  return best;
}

/** Voice a whole progression with smooth voice leading; the first chord leads from the last. */
export function voiceProgression(chords, opts) {
  let previous = null;
  let voicings = [];
  for (let pass = 0; pass < 2; pass++) {
    voicings = chords.map((c) => {
      const v = voiceChord(c.chord, { ...opts, previous });
      previous = v;
      return v;
    });
  }
  return voicings;
}

/** Bass pitch for a chord tone choice, kept in [low, high] and near `previous`. */
export function bassPitch(chord, tone, { low, high, previous }) {
  const offsets = { root: 0, third: chord.intervals[1], fifth: chord.intervals[2] ?? 7 };
  const pc = tone === 'bass' ? chord.bass : (chord.root + (offsets[tone] ?? 0)) % 12;
  const options = candidatePitches(pc, low, high);
  if (options.length === 0) throw new Error(`No bass pitch for ${chord.symbol} in range`);
  if (previous === undefined || previous === null) return options[0];
  let best = options[0];
  for (const m of options) if (Math.abs(m - previous) < Math.abs(best - previous)) best = m;
  return best;
}

/** The chord sounding at a beat. */
export function chordAt(chart, beat) {
  for (const c of chart) if (beat >= c.beat - 1e-9 && beat < c.beat + c.beats - 1e-9) return c;
  return chart[chart.length - 1];
}

/**
 * Parse a step pattern ('x..x' with x = hit, 1-9 = velocity steps, g = ghost, . = rest) into
 * events for `bars` bars. grid is a duration letter (s, e, q or triplets e3).
 */
export function parseSteps(pattern, { grid = 's', barBeats, bars, startBeat = 0 }) {
  const step = parseDuration(grid);
  const steps = pattern.replace(/[\s|]/g, '');
  const perBar = Math.round(barBeats / step);
  if (Math.abs(perBar * step - barBeats) > 1e-9) throw new Error('Grid does not divide the bar');
  if (steps.length % perBar !== 0)
    throw new Error(`Step pattern length ${steps.length} is not a multiple of ${perBar}`);
  const events = [];
  const total = bars * perBar;
  for (let i = 0; i < total; i++) {
    const ch = steps[i % steps.length];
    if (ch === '.' || ch === '-') continue;
    let velocity = 0.8;
    if (ch === 'x') velocity = 0.8;
    else if (ch === 'X') velocity = 1;
    else if (ch === 'g') velocity = 0.35;
    else if (/[1-9]/.test(ch)) velocity = Number(ch) / 9;
    else throw new Error(`Bad step character ${ch}`);
    events.push({ beat: startBeat + i * step, beats: step, velocity });
  }
  return events;
}
