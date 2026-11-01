/**
 * Deterministic math for audio synthesis.
 *
 * ECMAScript lets engines approximate Math.sin, Math.exp, Math.log, Math.pow, Math.sqrt and friends
 * ("implementation-approximated"), so their last bits may differ between engines, versions or
 * platforms. Everything in this module uses only IEEE-754 basic arithmetic (+, -, *, /), which is
 * correctly rounded on every platform, plus exact helpers (Math.floor, Math.round, Math.trunc,
 * Math.abs, Math.min, Math.max). Same code + same inputs therefore gives bit-identical results on
 * Windows, Linux and macOS. Accuracy is about 1e-15 relative, far below 16-bit PCM resolution.
 */

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const LN2 = 0.6931471805599453;
export const LN10 = 2.302585092994046;
export const SQRT2 = 1.4142135623730951;
export const SQRT1_2 = 0.7071067811865476;

const LN2_HI = 6.9314718036912381649e-1; // low 32 bits are zero, so k * LN2_HI is exact
const LN2_LO = 1.9082149292705877e-10;
const INV_LN2 = 1.4426950408889634;
const INV_TAU = 1 / TAU;
const TWO32 = 4294967296;
const INV_TWO32 = 1 / 4294967296;

// Taylor coefficients. Every factorial below is exactly representable and IEEE division is
// correctly rounded, so these constants are identical everywhere.
const S3 = -1 / 6;
const S5 = 1 / 120;
const S7 = -1 / 5040;
const S9 = 1 / 362880;
const S11 = -1 / 39916800;
const S13 = 1 / 6227020800;
const S15 = -1 / 1307674368000;
const S17 = 1 / 355687428096000;
const S19 = -1 / 121645100408832000;

const E2 = 1 / 2;
const E3 = 1 / 6;
const E4 = 1 / 24;
const E5 = 1 / 120;
const E6 = 1 / 720;
const E7 = 1 / 5040;
const E8 = 1 / 40320;
const E9 = 1 / 362880;
const E10 = 1 / 3628800;
const E11 = 1 / 39916800;
const E12 = 1 / 479001600;
const E13 = 1 / 6227020800;

const L3 = 2 / 3;
const L5 = 2 / 5;
const L7 = 2 / 7;
const L9 = 2 / 9;
const L11 = 2 / 11;
const L13 = 2 / 13;
const L15 = 2 / 15;
const L17 = 2 / 17;
const L19 = 2 / 19;
const L21 = 2 / 21;
const L23 = 2 / 23;

/** Exact powers of two 2^k for k in [-1074, 1023], built by exact doubling/halving. */
const P2 = (() => {
  const table = new Float64Array(1074 + 1024);
  let v = 1;
  for (let k = 0; k <= 1023; k++) {
    table[k + 1074] = v;
    v *= 2;
  }
  v = 0.5;
  for (let k = -1; k >= -1074; k--) {
    table[k + 1074] = v;
    v *= 0.5;
  }
  return table;
})();

/** Exact 2^k for integer k (0 below the subnormal range, clamped at 2^1023). */
export function pow2i(k) {
  if (k < -1074) return 0;
  if (k > 1023) return P2[1023 + 1074];
  return P2[k + 1074];
}

/** sin(2*pi*t) where t is measured in turns (cycles). The workhorse for oscillators. */
export function sinTurns(t) {
  let x = t - Math.floor(t); // [0, 1)
  if (x >= 0.5) x -= 1; // [-0.5, 0.5), exact (Sterbenz)
  if (x > 0.25) x = 0.5 - x;
  else if (x < -0.25) x = -0.5 - x; // [-0.25, 0.25], exact
  const z = x * TAU; // |z| <= pi/2
  const z2 = z * z;
  let p = S19;
  p = S17 + z2 * p;
  p = S15 + z2 * p;
  p = S13 + z2 * p;
  p = S11 + z2 * p;
  p = S9 + z2 * p;
  p = S7 + z2 * p;
  p = S5 + z2 * p;
  p = S3 + z2 * p;
  p = 1 + z2 * p;
  return z * p;
}

/** cos(2*pi*t), t in turns. */
export function cosTurns(t) {
  return sinTurns(t + 0.25);
}

export function sin(x) {
  return sinTurns(x * INV_TAU);
}

export function cos(x) {
  return sinTurns(x * INV_TAU + 0.25);
}

export function tan(x) {
  return sin(x) / cos(x);
}

export function exp(x) {
  if (x !== x) return x;
  if (x > 709) x = 709;
  if (x < -745) return 0;
  const k = Math.round(x * INV_LN2);
  const r = x - k * LN2_HI - k * LN2_LO; // |r| <= ~0.347
  let p = E13;
  p = E12 + r * p;
  p = E11 + r * p;
  p = E10 + r * p;
  p = E9 + r * p;
  p = E8 + r * p;
  p = E7 + r * p;
  p = E6 + r * p;
  p = E5 + r * p;
  p = E4 + r * p;
  p = E3 + r * p;
  p = E2 + r * p;
  p = 1 + r * p;
  p = 1 + r * p;
  return p * pow2i(k);
}

/** Natural logarithm for x > 0. */
export function log(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  if (x === Infinity) return Infinity;
  let m = x;
  let e = 0;
  while (m >= TWO32) {
    m *= INV_TWO32;
    e += 32;
  }
  while (m < INV_TWO32) {
    m *= TWO32;
    e -= 32;
  }
  while (m >= SQRT2) {
    m *= 0.5;
    e += 1;
  }
  while (m < SQRT1_2) {
    m *= 2;
    e -= 1;
  }
  const s = (m - 1) / (m + 1); // |s| <= 0.1716
  const s2 = s * s;
  let p = L23;
  p = L21 + s2 * p;
  p = L19 + s2 * p;
  p = L17 + s2 * p;
  p = L15 + s2 * p;
  p = L13 + s2 * p;
  p = L11 + s2 * p;
  p = L9 + s2 * p;
  p = L7 + s2 * p;
  p = L5 + s2 * p;
  p = L3 + s2 * p;
  p = 2 + s2 * p;
  return e * LN2_HI + (e * LN2_LO + s * p);
}

export function log10(x) {
  return log(x) / LN10;
}

export function log2(x) {
  return log(x) / LN2;
}

/** a^b for a > 0 (a = 0 gives 0). */
export function pow(a, b) {
  if (a === 0) return 0;
  return exp(b * log(a));
}

export function pow2(x) {
  return exp(x * LN2);
}

/** Square root by exponent scaling and Newton iterations (no Math.sqrt). */
export function sqrt(x) {
  if (!(x > 0)) return x === 0 ? 0 : NaN;
  if (x === Infinity) return Infinity;
  let m = x;
  let e = 0; // x = m * 4^e
  while (m >= TWO32) {
    m *= INV_TWO32;
    e += 16;
  }
  while (m < INV_TWO32) {
    m *= TWO32;
    e -= 16;
  }
  while (m >= 1) {
    m *= 0.25;
    e += 1;
  }
  while (m < 0.25) {
    m *= 4;
    e -= 1;
  }
  let y = 0.41731 + 0.59016 * m; // within 0.5% on [0.25, 1)
  y = 0.5 * (y + m / y);
  y = 0.5 * (y + m / y);
  y = 0.5 * (y + m / y);
  y = 0.5 * (y + m / y);
  return y * pow2i(e);
}

export function tanh(x) {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e2 = exp(2 * x);
  return (e2 - 1) / (e2 + 1);
}

/** Cheap smooth saturator: rational tanh approximation, C1-continuous, exactly +-1 beyond +-3. */
export function softClip(x) {
  if (x >= 3) return 1;
  if (x <= -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

const DB_TO_LN = LN10 / 20;
const LN_TO_DB = 20 / LN10;
const POW_TO_DB = 10 / LN10;

export function dbToGain(db) {
  return exp(db * DB_TO_LN);
}

export function gainToDb(gain) {
  return gain > 0 ? LN_TO_DB * log(gain) : -Infinity;
}

/** Power ratio to decibels (10 log10). */
export function powerToDb(power) {
  return power > 0 ? POW_TO_DB * log(power) : -Infinity;
}

const SEMITONE_LN = LN2 / 12;

/** MIDI note number (fractional allowed) to frequency, A4 = 440 Hz. */
export function mtof(midi) {
  return 440 * exp((midi - 69) * SEMITONE_LN);
}

/** Frequency ratio for a pitch offset in semitones. */
export function semitoneRatio(semitones) {
  return exp(semitones * SEMITONE_LN);
}

/** Modified Bessel function of the first kind, order 0 (for Kaiser windows). */
export function besselI0(x) {
  const h = x * 0.5;
  const h2 = h * h;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 300; k++) {
    term *= h2 / (k * k);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return sum;
}

/** Normalised sinc: sin(pi x) / (pi x). */
export function sinc(x) {
  if (x === 0) return 1;
  return sinTurns(x * 0.5) / (PI * x);
}

/** Round to a fixed number of decimals, deterministically (for reports and manifests). */
export function roundTo(value, decimals) {
  if (!Number.isFinite(value)) return value;
  let scale = 1;
  for (let i = 0; i < decimals; i++) scale *= 10;
  return Math.round(value * scale) / scale;
}

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}
