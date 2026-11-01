/**
 * Recipe interpreter: turns a JSON recipe (plus the shared patch library) into samples.
 *
 * Pipeline: events -> voices (rendered at the oversampled rate) -> tracks (EQ, gain, sends) ->
 * buses decimated to the output rate -> reverb/echo returns -> master EQ -> loudness
 * normalisation with a soft look-ahead limiter and a true-peak ceiling -> fades (one-shots) or
 * seam rotation (loops) -> TPDF dither -> 16-bit PCM WAV.
 *
 * Music loops are rendered circularly: note tails wrap around the loop end, and every filter,
 * reverb, echo and the limiter run a priming pass, so the file is exactly one period of a periodic
 * signal and loops sample-accurately.
 */
import { dbToGain, gainToDb, mtof, pow, powerToDb, roundTo } from './dmath.mjs';
import { applyFades } from './env.mjs';
import { applyEq, dcBlock } from './filters.mjs';
import { echo, reverb } from './fx.mjs';
import { limit } from './dynamics.mjs';
import { integrated, momentaryMax } from './loudness.mjs';
import {
  bassPitch,
  beatsPerBar,
  chordAt,
  noteToMidi,
  parseChordChart,
  parseMelody,
  parseSteps,
  voiceProgression,
} from './music.mjs';
import { decimate, truePeak } from './resample.mjs';
import { hashSeed, Rng } from './rng.mjs';
import { renderVoice } from './sources.mjs';
import { encodeWav, quantize } from './wav.mjs';

export const GENERATOR = Object.freeze({ name: 'dragon-valley-audio-synth', version: '1.0.0' });

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Shallow copy of an object without some keys. */
function without(object, ...keys) {
  const copy = { ...object };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Deep merge: objects merge key by key, arrays and scalars from `over` replace `base`. */
export function deepMerge(base, over) {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over))
    out[key] = key in base ? deepMerge(base[key], value) : value;
  return out;
}

/** Resolve an `extends` chain against the shared patch library. */
export function resolvePatch(spec, patches, depth = 0) {
  if (!spec || !spec.extends) return spec;
  if (depth > 8) throw new Error('Patch inheritance too deep');
  const parent = patches[spec.extends];
  if (!parent) throw new Error(`Unknown patch "${spec.extends}"`);
  return deepMerge(resolvePatch(parent, patches, depth + 1), without(spec, 'extends'));
}

/** Recipe with every instrument patch resolved: the complete description of the sound. */
export function resolveRecipe(recipe, patches) {
  const instruments = {};
  for (const [name, spec] of Object.entries(recipe.instruments || {})) {
    instruments[name] = resolvePatch(spec, patches);
  }
  return { ...recipe, instruments };
}

function pitchToFreq(voice) {
  if (voice.freq !== undefined) return voice.freq;
  if (voice.pitch === undefined) return undefined;
  const midi = typeof voice.pitch === 'number' ? voice.pitch : noteToMidi(voice.pitch);
  return mtof(midi + (voice.transpose || 0) + (voice.cents || 0) / 100);
}

/** Merge instrument defaults with an event and produce a renderable voice. */
function makeVoice(instrument, fields, seed) {
  const merged = deepMerge(instrument || {}, fields);
  const velocity = merged.velocity ?? 0.8;
  const velDb = (merged.velocityDb ?? 10) * (velocity - 1);
  const freq = pitchToFreq(merged);
  let gate = merged.gate;
  if (gate !== undefined && merged.minGate !== undefined) gate = Math.max(gate, merged.minGate);
  if (gate !== undefined && merged.maxGate !== undefined) gate = Math.min(gate, merged.maxGate);
  return {
    ...merged,
    gate,
    freq,
    velocity,
    gain: dbToGain((merged.db || 0) + velDb + (fields.extraDb || 0)),
    seed,
  };
}

// ---------------------------------------------------------------------------------------------
// Event generation

function sectionLayout(recipe) {
  const barBeats = beatsPerBar(recipe.meter);
  const sections = [];
  let beat = 0;
  for (const name of recipe.form) {
    const bars = recipe.sectionBars[name];
    if (!bars) throw new Error(`Section ${name} has no length`);
    sections.push({ name, beat, bars, beats: bars * barBeats });
    beat += bars * barBeats;
  }
  return { barBeats, sections, totalBeats: beat };
}

function chordChart(recipe, layout) {
  const chart = [];
  for (const section of layout.sections) {
    const text = recipe.chords?.[section.name];
    if (!text) continue;
    const parsed = parseChordChart(text, layout.barBeats);
    if (Math.abs(parsed.beats - section.beats) > 1e-9)
      throw new Error(`Chords for ${section.name} do not match its length`);
    for (const c of parsed.chords)
      chart.push({ ...c, beat: c.beat + section.beat, section: section.name });
  }
  return chart;
}

/** Music track -> note events {beat, beats, midi[], velocity, gate}. */
function trackEvents(track, recipe, layout, chart) {
  const events = [];
  const inSection = (name) => !track.sections || track.sections.includes(name);
  if (track.phrases) {
    for (const section of layout.sections) {
      const text = track.phrases[section.name];
      if (!text) continue;
      const { events: evs, beats } = parseMelody(text, {
        barBeats: layout.barBeats,
        gate: track.gate ?? 0.92,
      });
      if (Math.abs(beats - section.beats) > 1e-9)
        throw new Error(
          `Track ${track.name} phrase ${section.name} has ${beats} beats, expected ${section.beats}`,
        );
      for (const e of evs) events.push({ ...e, beat: e.beat + section.beat });
    }
  }
  if (track.pattern) {
    const p = track.pattern;
    const voicingOpts = p.voicing
      ? {
          low: noteToMidi(p.voicing.low),
          high: noteToMidi(p.voicing.high),
          size: p.voicing.size ?? 3,
        }
      : null;
    const voicings = voicingOpts ? voiceProgression(chart, voicingOpts) : null;
    const voicingAt = (beat) => voicings[chart.indexOf(chordAt(chart, beat))];
    let previousBass = null;
    if (p.type === 'sustain') {
      chart.forEach((c, index) => {
        if (!inSection(c.section)) return;
        events.push({
          beat: c.beat,
          beats: c.beats,
          midi: voicings[index],
          velocity: p.velocity ?? 0.7,
          gate: p.gate ?? 1,
        });
      });
    }
    for (const section of p.type === 'sustain' ? [] : layout.sections) {
      if (!inSection(section.name)) continue;
      for (let bar = 0; bar < section.bars; bar++) {
        const barBeat = section.beat + bar * layout.barBeats;
        const globalBar = Math.round(barBeat / layout.barBeats);
        if (p.type === 'arp') {
          const step = p.step ?? 0.5;
          const order = p.order ?? [0, 1, 2, 1];
          const count = Math.round(layout.barBeats / step);
          for (let i = 0; i < count; i++) {
            const beat = barBeat + i * step;
            const v = voicingAt(beat);
            const idx = order[(globalBar * count + i) % order.length];
            const midi = v[idx % v.length] + 12 * Math.floor(idx / v.length);
            events.push({
              beat,
              beats: step * (p.len ?? 1),
              midi: [midi],
              velocity: p.velocity?.[i % p.velocity.length] ?? 0.7,
              gate: p.gate ?? 0.9,
            });
          }
          continue;
        }
        for (const s of p.steps) {
          const beat = barBeat + (s.beat - 1);
          const chord = chordAt(chart, beat).chord;
          const velocity = s.velocity ?? 0.8;
          if (p.type === 'comp') {
            const v = voicingAt(beat);
            events.push({ beat, beats: s.len, midi: v, velocity, gate: s.gate ?? 0.9 });
          } else if (p.type === 'bass') {
            const tones = s.tones ?? ['root'];
            const tone = tones[globalBar % tones.length];
            const midi = bassPitch(chord, tone, {
              low: noteToMidi(p.low),
              high: noteToMidi(p.high),
              previous: previousBass,
            });
            previousBass = midi;
            events.push({ beat, beats: s.len, midi: [midi], velocity, gate: s.gate ?? 0.9 });
          } else {
            throw new Error(`Unknown pattern type ${p.type}`);
          }
        }
      }
    }
  }
  if (track.steps) {
    for (const section of layout.sections) {
      if (!inSection(section.name)) continue;
      const pattern =
        typeof track.steps.pattern === 'string'
          ? track.steps.pattern
          : track.steps.pattern[section.name];
      if (!pattern) continue;
      const evs = parseSteps(pattern, {
        grid: track.steps.grid ?? 's',
        barBeats: layout.barBeats,
        bars: section.bars,
        startBeat: section.beat,
      });
      for (const e of evs)
        events.push({
          ...e,
          midi: track.steps.pitch ? [noteToMidi(track.steps.pitch)] : null,
          gate: 1,
        });
    }
  }
  events.sort((a, b) => a.beat - b.beat || (a.midi?.[0] ?? 0) - (b.midi?.[0] ?? 0));
  return events;
}

/** SFX track -> explicit voice field objects (times in seconds). */
function sfxTrackVoices(track, recipe) {
  const out = [];
  for (const v of track.voices || []) out.push(v);
  if (track.notes) {
    const n = track.notes;
    const spb = 60 / n.tempo;
    const { events } = parseMelody(n.melody, { gate: n.gate ?? 0.9 });
    for (const e of events) {
      for (const midi of e.midi) {
        out.push({
          instrument: n.instrument,
          at: (n.start ?? 0) + e.beat * spb,
          gate: e.beats * spb * e.gate,
          pitch: midi + (n.transpose ?? 0),
          velocity: e.velocity,
        });
      }
    }
  }
  if (track.scatter) {
    const s = track.scatter;
    const rng = new Rng(hashSeed(recipe.seed, track.name, 'scatter'));
    const count = s.count;
    const span = s.end - s.start;
    const shape = s.shape ?? 2;
    const pitches = s.pitches;
    for (let i = 0; i < count; i++) {
      let u = (i + 0.5 + (s.jitter ?? 0) * (rng.next() - 0.5)) / count;
      u = Math.min(1, Math.max(0, u));
      if (s.distribution === 'decelerate') u = pow(u, shape);
      else if (s.distribution === 'accelerate') u = 1 - pow(1 - u, shape);
      else if (s.distribution === 'random') u = rng.next();
      let pitch;
      if (s.order === 'up')
        pitch = pitches[Math.min(pitches.length - 1, Math.floor((i * pitches.length) / count))];
      else if (s.order === 'cycle') pitch = pitches[i % pitches.length];
      else pitch = rng.pick(pitches);
      const db = s.db ? rng.range(s.db[0], s.db[1]) : 0;
      const velocity = s.velocity ? rng.range(s.velocity[0], s.velocity[1]) : 0.8;
      out.push({
        instrument: s.instrument,
        at: s.start + u * span,
        ...(s.gate !== undefined ? { gate: s.gate } : {}),
        pitch,
        cents: s.detune ? rng.range(-s.detune, s.detune) : 0,
        extraDb: db,
        velocity,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rendering

function addVoice(target, samples, start, circular) {
  const n = target.length;
  if (circular) {
    let idx = ((start % n) + n) % n;
    for (let i = 0; i < samples.length; i++) {
      target[idx] += samples[i];
      idx++;
      if (idx === n) idx = 0;
    }
  } else {
    for (let i = 0; i < samples.length; i++) {
      const j = start + i;
      if (j >= 0 && j < n) target[j] += samples[i];
    }
  }
}

function measure(x, fs, recipe, circular) {
  return recipe.loudness.measure === 'integrated'
    ? integrated(x, fs, circular)
    : momentaryMax(x, fs, circular);
}

/**
 * Render a recipe. Returns { samples (float, final), pcm (Int16Array), wav (Buffer), stats }.
 */
export function renderRecipe(rawRecipe, patches) {
  const recipe = resolveRecipe(rawRecipe, patches);
  const fsOut = recipe.sampleRate;
  const os = recipe.oversample ?? 1;
  const fs = fsOut * os;
  const isMusic = recipe.kind === 'music';
  const circular = isMusic;

  let lengthOut;
  let layout;
  let chart;
  let spb;
  if (isMusic) {
    layout = sectionLayout(recipe);
    chart = chordChart(recipe, layout);
    spb = 60 / recipe.tempo;
    lengthOut = Math.round(layout.totalBeats * spb * fsOut);
  } else {
    lengthOut = Math.round(recipe.duration * fsOut);
  }
  const lengthOs = lengthOut * os;
  const busNames = Object.keys(recipe.buses || {});
  const dryOs = new Float64Array(lengthOs);
  const sendsOs = Object.fromEntries(busNames.map((b) => [b, new Float64Array(lengthOs)]));
  const offset = isMusic ? 0 : (recipe.offset ?? 0.002);
  let voiceCount = 0;
  const trackLevels = [];

  for (const track of recipe.tracks) {
    const trackBuf = new Float64Array(lengthOs);
    if (isMusic) {
      const instrument = recipe.instruments[track.instrument];
      if (!instrument)
        throw new Error(`Track ${track.name} uses unknown instrument ${track.instrument}`);
      const events = trackEvents(track, recipe, layout, chart);
      events.forEach((e, index) => {
        const rng = new Rng(hashSeed(recipe.seed, track.name, index, 'humanize'));
        const h = track.humanize || {};
        const dt = h.time ? rng.range(-h.time, h.time) : 0;
        const dv = h.velocity ? rng.range(-h.velocity, h.velocity) : 0;
        const pitches = e.midi ?? [null];
        pitches.forEach((midi, k) => {
          const fields = {
            gate: e.beats * spb * e.gate,
            velocity: Math.min(1, Math.max(0.05, e.velocity + dv)),
          };
          if (midi !== null) fields.pitch = midi + (track.transpose ?? 0);
          const voice = makeVoice(instrument, fields, hashSeed(recipe.seed, track.name, index, k));
          const samples = renderVoice(voice, fs, fsOut);
          addVoice(trackBuf, samples, Math.round((e.beat * spb + dt) * fs), true);
          voiceCount++;
        });
      });
    } else {
      sfxTrackVoices(track, recipe).forEach((fields, index) => {
        const instrument = fields.instrument ? recipe.instruments[fields.instrument] : undefined;
        if (fields.instrument && !instrument)
          throw new Error(`Unknown instrument ${fields.instrument}`);
        const voice = makeVoice(
          instrument,
          without(fields, 'instrument', 'at'),
          hashSeed(recipe.seed, track.name, index),
        );
        const samples = renderVoice(voice, fs, fsOut);
        addVoice(trackBuf, samples, Math.round((fields.at + offset) * fs), false);
        voiceCount++;
      });
    }
    applyEq(trackBuf, track.eq, fs, circular);
    const gain = dbToGain(track.db ?? 0);
    let trackEnergy = 0;
    for (let i = 0; i < lengthOs; i++) {
      const v = trackBuf[i] * gain;
      dryOs[i] += v;
      trackEnergy += v * v;
    }
    trackLevels.push({ name: track.name, dryRmsDb: roundTo(powerToDb(trackEnergy / lengthOs), 1) });
    for (const [bus, sendDb] of Object.entries(track.sends || {})) {
      if (!sendsOs[bus]) throw new Error(`Track ${track.name} sends to unknown bus ${bus}`);
      const g = gain * dbToGain(sendDb);
      const target = sendsOs[bus];
      for (let i = 0; i < lengthOs; i++) target[i] += trackBuf[i] * g;
    }
  }

  const master = decimate(dryOs, os, fsOut, circular);
  for (const bus of busNames) {
    const params = recipe.buses[bus];
    const input = decimate(sendsOs[bus], os, fsOut, circular);
    const resolved = { ...params };
    if (params.type === 'echo' && params.beats !== undefined) resolved.time = params.beats * spb;
    const wet =
      params.type === 'echo'
        ? echo(input, resolved, fsOut, circular)
        : reverb(input, resolved, fsOut, circular);
    for (let i = 0; i < lengthOut; i++) master[i] += wet[i];
  }
  applyEq(master, recipe.master?.eq, fsOut, circular);
  dcBlock(master, fsOut, 12, circular);

  // Loudness normalisation with a soft limiter and a true-peak ceiling. The limiter may shave at
  // most `maxLimitDb` off the loudest peak (one-shots: brief attack transients; loops: almost
  // nothing); quieter-than-target results are reported, not forced.
  const ceiling = recipe.ceilingDbtp ?? -1;
  const limiterOpts = {
    ceilingDb: ceiling - 0.6,
    kneeDb: 2,
    lookaheadMs: isMusic ? 3 : 2,
    releaseMs: isMusic ? 120 : 30,
    ...(recipe.master?.limiter || {}),
  };
  const maxLimitDb = recipe.master?.maxLimitDb ?? (isMusic ? 2 : 6);
  let rawPeak = 0;
  for (let i = 0; i < lengthOut; i++)
    rawPeak = Math.max(rawPeak, master[i] < 0 ? -master[i] : master[i]);
  const rawPeakDb = gainToDb(rawPeak);
  const target = recipe.loudness.target;
  const capGain = (db) => Math.min(db, maxLimitDb + limiterOpts.ceilingDb - rawPeakDb);
  let gainDb = capGain(target - measure(master, fsOut, recipe, circular));
  let out = master;
  let loud = 0;
  let tp = 0;
  for (let iter = 0; iter < 8; iter++) {
    const g = dbToGain(gainDb);
    const scaled = new Float64Array(lengthOut);
    for (let i = 0; i < lengthOut; i++) scaled[i] = master[i] * g;
    out = limit(scaled, fsOut, limiterOpts, circular);
    loud = measure(out, fsOut, recipe, circular);
    tp = gainToDb(truePeak(out, circular));
    if (tp > ceiling) {
      limiterOpts.ceilingDb -= tp - ceiling + 0.05;
      continue;
    }
    const next = capGain(gainDb + (target - loud));
    if (Math.abs(loud - target) <= 0.05 || Math.abs(next - gainDb) < 0.01) break;
    gainDb = next;
  }

  let rotation = 0;
  if (isMusic && recipe.seam?.search) {
    const [from, to] = recipe.seam.search;
    const a = Math.round(from * fsOut);
    const b = Math.round(to * fsOut);
    let best = Infinity;
    for (let r = a; r <= b; r++) {
      let e = 0;
      for (let k = -24; k <= 24; k++) {
        const v = out[(((r + k) % lengthOut) + lengthOut) % lengthOut];
        e += v * v;
      }
      if (e < best - 1e-18) {
        best = e;
        rotation = r;
      }
    }
    if (rotation !== 0) {
      const rotated = new Float64Array(lengthOut);
      for (let i = 0; i < lengthOut; i++)
        rotated[i] = out[(((i + rotation) % lengthOut) + lengthOut) % lengthOut];
      out = rotated;
    }
  }
  if (!isMusic) {
    const fadeIn = Math.max(2, Math.round((recipe.fadeIn ?? 0.0008) * fsOut));
    const fadeOut = Math.max(2, Math.round((recipe.fadeOut ?? 0.03) * fsOut));
    applyFades(out, fadeIn, fadeOut);
  }
  const pcm = quantize(out, {
    dither: true,
    seed: hashSeed(recipe.seed, 'dither'),
    edges: isMusic ? 0 : 1,
  });
  const wav = encodeWav(pcm, fsOut);
  return {
    samples: out,
    pcm,
    wav,
    stats: {
      lengthSamples: lengthOut,
      voices: voiceCount,
      tracks: trackLevels,
      loudness: roundTo(loud, 2),
      truePeakDbtp: roundTo(tp, 2),
      rotationSamples: rotation,
      loopBeats: layout?.totalBeats,
    },
  };
}
