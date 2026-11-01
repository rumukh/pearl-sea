/**
 * Envelopes: curved breakpoint segments, ADSR and control curves. Curves use one exp() per
 * segment and recursive multiplication per sample, all deterministic.
 *
 * Curve convention for a segment from v0 to v1: 0 = linear; c > 0 = fast start, slow finish
 * (natural decays and soft attacks); c < 0 = slow start, fast finish (swells).
 */
import { exp, semitoneRatio, sinTurns } from './dmath.mjs';

/** Write a curved ramp v0 -> v1 into out[start, start + len). The value v1 is reached at start + len. */
export function fillSegment(out, start, len, v0, v1, curve = 0) {
  if (len <= 0) return;
  const end = Math.min(out.length, start + len);
  if (!curve || (curve < 1e-6 && curve > -1e-6)) {
    const step = (v1 - v0) / len;
    for (let i = start; i < end; i++) out[i] = v0 + step * (i - start);
    return;
  }
  const q = exp(-curve / len);
  const norm = 1 / (1 - exp(-curve));
  const dv = v1 - v0;
  let e = 1;
  for (let i = start; i < end; i++) {
    out[i] = v0 + dv * (1 - e) * norm;
    e *= q;
  }
}

/** Value of a curved segment at progress x in [0, 1]. */
export function segmentValue(v0, v1, x, curve = 0) {
  if (!curve || (curve < 1e-6 && curve > -1e-6)) return v0 + (v1 - v0) * x;
  return v0 + ((v1 - v0) * (1 - exp(-curve * x))) / (1 - exp(-curve));
}

/**
 * Evaluate breakpoint points [[t, v, curve?], ...] at time t (seconds). Before the first point the
 * first value holds; after the last point the last value holds. The curve of a point shapes the
 * segment arriving at it.
 */
export function evalPoints(points, t) {
  if (!points || points.length === 0) return 0;
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1, c = 0] = points[i];
    if (t < t1) {
      const [t0, v0] = points[i - 1];
      const span = t1 - t0;
      return span <= 0 ? v1 : segmentValue(v0, v1, (t - t0) / span, c);
    }
  }
  return points[points.length - 1][1];
}

/** Render breakpoint points into a per-sample array of length n. */
export function renderPoints(points, n, fs) {
  const out = new Float64Array(n);
  if (!points || points.length === 0) return out;
  const first = Math.max(0, Math.min(n, Math.round(points[0][0] * fs)));
  out.fill(points[0][1], 0, first);
  let cursor = first;
  for (let i = 1; i < points.length; i++) {
    const [t1, v1, c = 0] = points[i];
    const end = Math.max(cursor, Math.min(n, Math.round(t1 * fs)));
    fillSegment(out, cursor, end - cursor, points[i - 1][1], v1, c);
    cursor = end;
  }
  out.fill(points[points.length - 1][1], cursor, n);
  return out;
}

export const ADSR_DEFAULTS = Object.freeze({
  a: 0.005,
  h: 0,
  d: 0.1,
  s: 1,
  r: 0.08,
  peak: 1,
  aCurve: 0,
  dCurve: 4,
  rCurve: 4,
});

/** Length in seconds of an envelope spec for a given gate (time until it is silent for good). */
export function envelopeLength(spec, gate) {
  if (spec && spec.points) return spec.points[spec.points.length - 1][0];
  const env = { ...ADSR_DEFAULTS, ...(spec || {}) };
  const natural = env.s === 0 ? env.a + env.h + env.d : Infinity;
  return Math.min(gate, natural) + (env.s === 0 && gate >= natural ? 0 : env.r);
}

/** Render an amplitude envelope (ADSR or points) for a gate length, n samples at fs. */
export function renderEnvelope(spec, gate, n, fs) {
  if (spec && spec.points) return renderPoints(spec.points, n, fs);
  const env = { ...ADSR_DEFAULTS, ...(spec || {}) };
  const out = new Float64Array(n);
  const a = Math.round(env.a * fs);
  const h = Math.round(env.h * fs);
  const d = Math.round(env.d * fs);
  const r = Math.round(env.r * fs);
  const g = Math.round(gate * fs);
  fillSegment(out, 0, a, 0, env.peak, env.aCurve);
  out.fill(env.peak, Math.min(n, a), Math.min(n, a + h));
  fillSegment(out, a + h, d, env.peak, env.s, env.dCurve);
  out.fill(env.s, Math.min(n, a + h + d), n);
  if (g < n) {
    const level = g < a ? (a === 0 ? env.peak : out[g]) : out[g];
    fillSegment(out, g, r, level, 0, env.rCurve);
    out.fill(0, Math.min(n, g + r), n);
  }
  return out;
}

/**
 * Per-sample frequency array: base frequency times pitch envelope (semitones), vibrato and slow
 * drift. Ratios are evaluated every `block` samples and interpolated linearly in between.
 */
export function renderFrequency(base, n, fs, { pitchEnv, vibrato, drift } = {}, rng, block = 32) {
  const out = new Float64Array(n);
  if (!pitchEnv && !vibrato && !drift) {
    out.fill(base);
    return out;
  }
  const vibPhase = vibrato && vibrato.phase !== undefined ? vibrato.phase : 0;
  // Smooth random drift: random targets every `drift.period` seconds, cosine-free linear blend.
  let driftPoints;
  if (drift) {
    const period = drift.period || 0.25;
    const count = Math.ceil(n / fs / period) + 2;
    driftPoints = [];
    for (let i = 0; i < count; i++) driftPoints.push(rng.bipolar() * (drift.cents / 100));
  }
  const offsetAt = (t) => {
    let st = pitchEnv ? evalPoints(pitchEnv, t) : 0;
    if (vibrato && vibrato.depth) {
      const delay = vibrato.delay || 0;
      if (t > delay) {
        const fade = vibrato.fade || 0;
        const ramp = fade > 0 ? Math.min(1, (t - delay) / fade) : 1;
        st += vibrato.depth * ramp * sinTurns(vibrato.rate * (t - delay) + vibPhase);
      }
    }
    if (driftPoints) {
      const period = drift.period || 0.25;
      const pos = t / period;
      const i = Math.floor(pos);
      const frac = pos - i;
      const x = frac * frac * (3 - 2 * frac);
      st += driftPoints[i] + (driftPoints[i + 1] - driftPoints[i]) * x;
    }
    return st;
  };
  let prev = base * semitoneRatio(offsetAt(0));
  for (let start = 0; start < n; start += block) {
    const end = Math.min(n, start + block);
    const next = base * semitoneRatio(offsetAt(end / fs));
    const step = (next - prev) / (end - start);
    for (let i = start; i < end; i++) out[i] = prev + step * (i - start);
    prev = next;
  }
  return out;
}

/** Raised-cosine fade gain for x in [0, 1] (0 -> 1). */
export function raisedCosine(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 0.5 - 0.5 * sinTurns(x * 0.5 + 0.25);
}

/** Apply declick fades in place: raised-cosine fade-in and fade-out (in samples). */
export function applyFades(buffer, fadeIn, fadeOut) {
  const n = buffer.length;
  for (let i = 0; i < fadeIn && i < n; i++) buffer[i] *= raisedCosine(i / fadeIn);
  for (let i = 0; i < fadeOut && i < n; i++) buffer[n - 1 - i] *= raisedCosine(i / fadeOut);
}
