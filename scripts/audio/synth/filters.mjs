/**
 * Filters: RBJ-cookbook biquads (static EQ), a zero-delay-feedback state-variable filter
 * (modulated synth filters), formant banks and simple one-pole helpers. Coefficients come from the
 * deterministic math module, processing is plain arithmetic.
 */
import { cos, exp, PI, sin, sqrt, dbToGain, TAU } from './dmath.mjs';

/** RBJ biquad coefficients, normalised so a0 = 1. */
export function biquadCoefficients(type, freq, fs, q = 0.7071067811865476, gainDb = 0) {
  const f = Math.min(Math.max(freq, 1), fs * 0.499);
  const w0 = (TAU * f) / fs;
  const cw = cos(w0);
  const sw = sin(w0);
  const alpha = sw / (2 * q);
  const A = dbToGain(gainDb / 2);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = (1 - cw) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = (1 + cw) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
      break;
    case 'bandpass':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
      break;
    case 'notch':
      b0 = 1;
      b1 = -2 * cw;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
      break;
    case 'allpass':
      b0 = 1 - alpha;
      b1 = -2 * cw;
      b2 = 1 + alpha;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
      break;
    case 'peak':
      b0 = 1 + alpha * A;
      b1 = -2 * cw;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cw;
      a2 = 1 - alpha / A;
      break;
    case 'lowshelf': {
      const s = 2 * sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cw + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cw);
      b2 = A * (A + 1 - (A - 1) * cw - s);
      a0 = A + 1 + (A - 1) * cw + s;
      a1 = -2 * (A - 1 + (A + 1) * cw);
      a2 = A + 1 + (A - 1) * cw - s;
      break;
    }
    case 'highshelf': {
      const s = 2 * sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cw + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cw);
      b2 = A * (A + 1 + (A - 1) * cw - s);
      a0 = A + 1 - (A - 1) * cw + s;
      a1 = 2 * (A - 1 - (A + 1) * cw);
      a2 = A + 1 - (A - 1) * cw - s;
      break;
    }
    default:
      throw new Error(`Unknown biquad type ${type}`);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/**
 * Run a static biquad over a buffer in place (transposed direct form II). With circular = true the
 * buffer is treated as one period of a loop: a priming pass settles the state first, so the
 * result is the periodic steady state and the loop seam stays continuous.
 */
export function biquadProcess(buffer, c, circular = false) {
  let z1 = 0;
  let z2 = 0;
  const n = buffer.length;
  if (circular) {
    for (let i = 0; i < n; i++) {
      const x = buffer[i];
      const y = c.b0 * x + z1;
      z1 = c.b1 * x - c.a1 * y + z2;
      z2 = c.b2 * x - c.a2 * y;
    }
  }
  for (let i = 0; i < n; i++) {
    const x = buffer[i];
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    buffer[i] = y;
  }
  return buffer;
}

/** Apply a list of EQ specs ({type, freq, q, gain}) to a buffer in place. */
export function applyEq(buffer, specs, fs, circular = false) {
  for (const spec of specs || []) {
    const c = biquadCoefficients(
      spec.type,
      spec.freq,
      fs,
      spec.q ?? 0.7071067811865476,
      spec.gain ?? 0,
    );
    biquadProcess(buffer, c, circular);
  }
  return buffer;
}

/**
 * Zero-delay-feedback state-variable filter (Simper). Stable under fast cutoff modulation.
 * Modes: lowpass, highpass, bandpass (0 dB peak), notch, peak.
 */
export class Svf {
  constructor(mode = 'lowpass', q = 0.7071067811865476) {
    this.mode = mode;
    this.k = 1 / q;
    this.ic1 = 0;
    this.ic2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.a3 = 0;
  }

  setCutoff(freq, fs) {
    const f = Math.min(Math.max(freq, 8), fs * 0.49);
    const w = (PI * f) / fs;
    const g = sin(w) / cos(w);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    switch (this.mode) {
      case 'lowpass':
        return v2;
      case 'bandpass':
        return this.k * v1;
      case 'highpass':
        return v0 - this.k * v1 - v2;
      case 'notch':
        return v0 - this.k * v1;
      case 'peak':
        return v2 - (v0 - this.k * v1 - v2);
      default:
        throw new Error(`Unknown SVF mode ${this.mode}`);
    }
  }
}

/** Vowel formant table: [F1, F2, F3] in Hz and relative gains in dB (adult reference). */
export const VOWELS = Object.freeze({
  a: { f: [730, 1090, 2440], g: [0, -5, -14] },
  ah: { f: [640, 1190, 2390], g: [0, -5, -15] },
  ae: { f: [660, 1720, 2410], g: [0, -6, -13] },
  e: { f: [530, 1840, 2480], g: [0, -8, -14] },
  i: { f: [300, 2290, 3010], g: [0, -12, -16] },
  o: { f: [570, 840, 2410], g: [0, -4, -20] },
  oh: { f: [450, 800, 2380], g: [0, -5, -22] },
  u: { f: [300, 870, 2240], g: [0, -10, -24] },
  m: { f: [260, 1000, 2200], g: [0, -22, -32] },
  er: { f: [490, 1350, 1690], g: [0, -5, -10] },
});

/** One-pole lowpass coefficient for a cutoff frequency. */
export function onePoleCoefficient(freq, fs) {
  return exp((-TAU * freq) / fs);
}

/** DC blocker (first-order highpass at about `freq` Hz), in place. */
export function dcBlock(buffer, fs, freq = 10, circular = false) {
  const r = onePoleCoefficient(freq, fs);
  let x1 = 0;
  let y1 = 0;
  const n = buffer.length;
  if (circular) {
    for (let i = 0; i < n; i++) {
      const x = buffer[i];
      y1 = x - x1 + r * y1;
      x1 = x;
    }
  }
  for (let i = 0; i < n; i++) {
    const x = buffer[i];
    const y = x - x1 + r * y1;
    x1 = x;
    y1 = y;
    buffer[i] = y;
  }
  return buffer;
}

/**
 * ITU-R BS.1770 K-weighting coefficients derived for any sample rate from the analog prototypes
 * (the same derivation libebur128 and pyloudnorm use).
 */
export function kWeightingCoefficients(fs) {
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  const K = sin((PI * f0) / fs) / cos((PI * f0) / fs);
  const Vh = dbToGain(G);
  const Vb = exp(0.4996667741545416 * (G / 20) * 2.302585092994046);
  const a0 = 1 + K / Q + K * K;
  const shelf = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  const K1 = sin((PI * f1) / fs) / cos((PI * f1) / fs);
  const d = 1 + K1 / Q1 + K1 * K1;
  const highpass = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K1 * K1 - 1)) / d,
    a2: (1 - K1 / Q1 + K1 * K1) / d,
  };
  return [shelf, highpass];
}
