/**
 * Sound sources and the voice renderer. A voice is one note or sound event: a sum of sources
 * (band-limited oscillators, additive/modal partials, 2-operator FM, colored noise), shaped by
 * per-source and per-voice filters, a formant bank, gentle saturation and an amplitude envelope.
 * Voices are rendered at the oversampled rate; the mixer decimates later.
 */
import {
  dbToGain,
  log2,
  pow2,
  semitoneRatio,
  sinTurns,
  sqrt,
  softClip,
  exp,
  TAU,
} from './dmath.mjs';
import {
  envelopeLength,
  evalPoints,
  renderEnvelope,
  renderFrequency,
  renderPoints,
} from './env.mjs';
import { Svf, VOWELS } from './filters.mjs';
import { hashSeed, Noise, Rng } from './rng.mjs';

const LN1000 = 6.907755278982137;
const MIDDLE_C = 261.6255653005986;

/** polyBLEP residual for a step of height 2 at phase 0 (t, dt in cycles). */
function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** polyBLAMP residual for a unit slope change (per cycle) at phase 0. */
function polyBlamp(t, dt) {
  if (t < dt) {
    const x = 1 - t / dt;
    return (dt * x * x * x) / 6;
  }
  if (t > 1 - dt) {
    const x = 1 + (t - 1) / dt;
    return (dt * x * x * x) / 6;
  }
  return 0;
}

function wrap01(x) {
  return x - Math.floor(x);
}

function renderOsc(buf, freq, fs, src, rng) {
  const wave = src.wave || 'sine';
  const width = src.width ?? 0.5;
  const detunes = src.detune && src.detune.length ? src.detune : [0];
  const base = semitoneRatio((src.semis || 0) + (src.cents || 0) / 100) * pow2(src.octave || 0);
  const norm = 1 / sqrt(detunes.length);
  const n = buf.length;
  const invFs = 1 / fs;
  for (const cents of detunes) {
    const ratio = base * semitoneRatio(cents / 100);
    let phase;
    if (src.phase === 'random') phase = rng.next();
    else if (typeof src.phase === 'number') phase = src.phase;
    else phase = wave === 'saw' ? 0.5 : 0;
    for (let i = 0; i < n; i++) {
      const dt = freq[i] * ratio * invFs;
      let v;
      switch (wave) {
        case 'sine':
          v = sinTurns(phase);
          break;
        case 'saw':
          v = 2 * phase - 1 - polyBlep(phase, dt);
          break;
        case 'square':
        case 'pulse':
          v =
            (phase < width ? 1 : -1) +
            polyBlep(phase, dt) -
            polyBlep(wrap01(phase + 1 - width), dt);
          break;
        case 'triangle':
          v =
            (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase) +
            8 * polyBlamp(phase, dt) -
            8 * polyBlamp(wrap01(phase + 0.5), dt);
          break;
        default:
          throw new Error(`Unknown wave ${wave}`);
      }
      buf[i] += v * norm;
      phase += dt;
      if (phase >= 1) phase -= Math.floor(phase);
    }
  }
}

/** Partial list for a 'harmonic' (modal string/pipe) source. */
function harmonicPartials(src) {
  const partials = [];
  const count = src.count || 16;
  const tilt = src.tilt ?? -6; // dB per octave
  const B = src.inharmonicity || 0;
  for (let k = 1; k <= count; k++) {
    if (src.odd && k % 2 === 0) continue;
    let db = tilt * log2(k);
    if (src.pickPos) {
      const s = sinTurns(0.5 * k * src.pickPos);
      const mag = s < 0 ? -s : s;
      db += mag > 1e-6 ? 20 * (log2(mag) * 0.3010299956639812) : -120;
    }
    const ratio = B ? k * sqrt(1 + B * k * k) : k;
    const t60 = src.t60 ? src.t60 / pow2((src.t60Tilt ?? 0.5) * log2(k)) : 0;
    partials.push({ ratio, db, t60 });
  }
  return partials;
}

function renderAdditive(buf, freq, fs, fsOut, src, rng) {
  const partials = src.type === 'harmonic' ? harmonicPartials(src) : src.partials;
  const n = buf.length;
  const invFs = 1 / fs;
  let maxFreq = 0;
  for (let i = 0; i < n; i += 64) if (freq[i] > maxFreq) maxFreq = freq[i];
  const limit = Math.min(0.5 * fsOut, 0.45 * fs);
  // Lower notes ring longer: t60 scales with (f0 / middle C)^-t60Keytrack.
  const keyScale = src.t60Keytrack
    ? pow2(-src.t60Keytrack * log2((freq[0] || MIDDLE_C) / MIDDLE_C))
    : 1;
  const t60Scale = (src.t60Scale ?? 1) * keyScale;
  const sourceRatio = src.cents ? semitoneRatio(src.cents / 100) : 1;
  for (const p of partials) {
    const ratio = p.ratio * sourceRatio * semitoneRatio((p.detune || 0) / 100);
    if (ratio * maxFreq >= limit) continue;
    const amp = dbToGain(p.db || 0);
    const t60 = (p.t60 || 0) * t60Scale;
    const decay = t60 > 0 ? exp(-LN1000 / (t60 * fs)) : 1;
    let phase = p.phase === 'random' || src.phase === 'random' ? rng.next() : p.phase || 0;
    let level = amp;
    for (let i = 0; i < n; i++) {
      buf[i] += level * sinTurns(phase);
      level *= decay;
      phase += freq[i] * ratio * invFs;
      if (phase >= 1) phase -= Math.floor(phase);
    }
  }
}

function renderFm(buf, freq, fs, src) {
  const n = buf.length;
  const invFs = 1 / fs;
  const ratio = src.ratio ?? 1;
  const modRatio = (src.modRatio ?? 1) * semitoneRatio((src.modDetune || 0) / 100);
  const indexEnv = src.indexEnv ? renderPoints(src.indexEnv, n, fs) : null;
  const index = src.index ?? 1;
  const fb = src.feedback || 0;
  const k = index / TAU;
  let pc = 0;
  let pm = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    m = sinTurns(pm + (fb / TAU) * m);
    const idx = indexEnv ? k * indexEnv[i] : k;
    buf[i] += sinTurns(pc + idx * m);
    pc += freq[i] * ratio * invFs;
    pm += freq[i] * modRatio * invFs;
    if (pc >= 1) pc -= Math.floor(pc);
    if (pm >= 1) pm -= Math.floor(pm);
  }
}

function renderNoise(buf, src, seed) {
  const noise = new Noise(seed, src.color || 'white');
  for (let i = 0; i < buf.length; i++) buf[i] += noise.tick();
}

/** Apply one filter spec ({type, freq, q, env (octaves), keytrack, veltrack}) with an SVF. */
function applyFilter(buf, spec, voice, fs) {
  const svf = new Svf(spec.type || 'lowpass', spec.q ?? 0.7071067811865476);
  let base = spec.freq;
  if (spec.keytrack && voice.freq) base *= pow2(spec.keytrack * log2(voice.freq / MIDDLE_C));
  if (spec.veltrack) base *= pow2(spec.veltrack * ((voice.velocity ?? 1) - 1));
  const n = buf.length;
  const block = 16;
  if (!spec.env) {
    svf.setCutoff(base, fs);
    for (let i = 0; i < n; i++) buf[i] = svf.tick(buf[i]);
  } else {
    for (let start = 0; start < n; start += block) {
      svf.setCutoff(base * pow2(evalPoints(spec.env, start / fs)), fs);
      const end = Math.min(n, start + block);
      for (let i = start; i < end; i++) buf[i] = svf.tick(buf[i]);
    }
  }
  if (spec.db) {
    const g = dbToGain(spec.db);
    for (let i = 0; i < n; i++) buf[i] *= g;
  }
}

/** Parallel formant bank with vowel morphing: formant = {vowels: [[t, name]], size, q, db}. */
function applyFormant(buf, formant, fs) {
  const n = buf.length;
  const size = formant.size ?? 1;
  const q = formant.q ?? 8;
  const frames = formant.vowels.map(([t, name]) => {
    const vowel = VOWELS[name];
    if (!vowel) throw new Error(`Unknown vowel ${name}`);
    return { t, vowel };
  });
  const bands = [0, 1, 2].map(() => new Svf('bandpass', q));
  const out = new Float64Array(n);
  const block = 16;
  const points = [0, 1, 2].map((b) => ({
    f: frames.map((fr) => [fr.t, fr.vowel.f[b] * size, 2]),
    g: frames.map((fr) => [fr.t, dbToGain(fr.vowel.g[b]), 2]),
  }));
  const gains = [0, 0, 0];
  for (let start = 0; start < n; start += block) {
    const t = start / fs;
    for (let b = 0; b < 3; b++) {
      bands[b].setCutoff(evalPoints(points[b].f, t), fs);
      gains[b] = evalPoints(points[b].g, t);
    }
    const end = Math.min(n, start + block);
    for (let i = start; i < end; i++) {
      const x = buf[i];
      out[i] =
        gains[0] * bands[0].tick(x) + gains[1] * bands[1].tick(x) + gains[2] * bands[2].tick(x);
    }
  }
  const mix = formant.mix ?? 1;
  const g = dbToGain(formant.db ?? 0);
  for (let i = 0; i < n; i++) buf[i] = g * (mix * out[i] + (1 - mix) * buf[i]);
}

/** Gate used when a voice does not set one: the natural length of a percussive envelope. */
function defaultGate(amp) {
  if (amp && amp.points) return amp.points[amp.points.length - 1][0];
  const a = amp?.a ?? 0.005;
  const h = amp?.h ?? 0;
  const d = amp?.d ?? 0.1;
  return a + h + d;
}

function gateOf(voice) {
  return voice.gate ?? defaultGate(voice.amp);
}

/** Total render length (seconds) of a resolved voice. */
export function voiceSeconds(voice) {
  return envelopeLength(voice.amp, gateOf(voice)) + (voice.tail ?? 0);
}

/**
 * Render a resolved voice spec at sample rate fs (the oversampled rate). fsOut is the final rate,
 * used to skip partials that the decimator would remove anyway.
 */
export function renderVoice(voice, fs, fsOut) {
  const gate = gateOf(voice);
  const seconds = voiceSeconds(voice);
  const n = Math.max(1, Math.ceil(seconds * fs) + 1);
  const rng = new Rng(voice.seed >>> 0);
  const freq = renderFrequency(voice.freq ?? MIDDLE_C, n, fs, voice, rng);
  const mix = new Float64Array(n);
  const sources = voice.sources || [];
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    const buf = new Float64Array(n);
    const srcSeed = hashSeed(voice.seed, 'source', s);
    switch (src.type) {
      case 'osc':
        renderOsc(buf, freq, fs, src, new Rng(srcSeed));
        break;
      case 'additive':
      case 'harmonic':
        renderAdditive(buf, freq, fs, fsOut, src, new Rng(srcSeed));
        break;
      case 'fm':
        renderFm(buf, freq, fs, src);
        break;
      case 'noise':
        renderNoise(buf, src, srcSeed);
        break;
      default:
        throw new Error(`Unknown source type ${src.type}`);
    }
    for (const f of src.filters || []) applyFilter(buf, f, voice, fs);
    const gain = dbToGain(src.db || 0);
    if (src.env) {
      const env = renderEnvelope(src.env, gate, n, fs);
      for (let i = 0; i < n; i++) mix[i] += buf[i] * env[i] * gain;
    } else {
      for (let i = 0; i < n; i++) mix[i] += buf[i] * gain;
    }
  }
  if (voice.formant) applyFormant(mix, voice.formant, fs);
  for (const f of voice.filters || []) applyFilter(mix, f, voice, fs);
  if (voice.drive) {
    const pre = dbToGain(voice.drive);
    const post = 1 / softClip(pre);
    for (let i = 0; i < n; i++) mix[i] = softClip(mix[i] * pre) * post;
  }
  const amp = renderEnvelope(voice.amp, gate, n, fs);
  const gain = voice.gain ?? 1;
  for (let i = 0; i < n; i++) mix[i] *= amp[i] * gain;
  return mix;
}
