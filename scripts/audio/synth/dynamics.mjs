/**
 * Dynamics: a transparent look-ahead soft limiter. Gain is computed from a soft-knee curve that
 * approaches the ceiling asymptotically, held over the look-ahead window, released smoothly and
 * box-filtered, so the gain never moves abruptly (no clicks) and peaks never exceed the ceiling.
 */
import { dbToGain, exp, gainToDb, tanh } from './dmath.mjs';

/** Sliding-window minimum over the previous `w` samples (monotonic deque). */
function slidingMin(values, w) {
  const n = values.length;
  const out = new Float64Array(n);
  const deque = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    while (tail > head && values[deque[tail - 1]] >= values[i]) tail--;
    deque[tail++] = i;
    if (deque[head] <= i - w) head++;
    out[i] = values[deque[head]];
  }
  return out;
}

function limitLinear(x, fs, opts) {
  const ceilingDb = opts.ceilingDb ?? -1.5;
  const kneeDb = opts.kneeDb ?? 3;
  const w = Math.max(1, Math.round(((opts.lookaheadMs ?? 2) * fs) / 1000));
  const release = exp(-1 / (((opts.releaseMs ?? 80) * fs) / 1000));
  const kneeStart = ceilingDb - kneeDb;
  const kneeLinear = dbToGain(kneeStart);
  const n = x.length + w - 1;
  const required = new Float64Array(n).fill(1);
  for (let i = 0; i < x.length; i++) {
    const a = x[i] < 0 ? -x[i] : x[i];
    if (a > kneeLinear) {
      const level = gainToDb(a);
      const target = kneeStart + kneeDb * tanh((level - kneeStart) / kneeDb);
      required[i] = dbToGain(target - level);
    }
  }
  const held = slidingMin(required, w);
  let s = 1;
  for (let i = 0; i < n; i++) {
    const h = held[i];
    s = h <= s ? h : h + (s - h) * release;
    held[i] = s;
  }
  const out = new Float64Array(x.length);
  // Box filter over the previous w smoothed gains (unity before the start of the buffer).
  let sum = w;
  const gains = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    sum += held[i] - (i >= w ? held[i - w] : 1);
    gains[i] = sum / w;
  }
  for (let i = 0; i < x.length; i++) out[i] = x[i] * Math.min(1, gains[i + w - 1]);
  return out;
}

/**
 * Soft look-ahead limiter. opts: ceilingDb, kneeDb, lookaheadMs, releaseMs. With circular = true
 * the buffer is one loop period: it is processed as three periods and the settled middle one is
 * returned, so gain state is continuous across the seam.
 */
export function limit(x, fs, opts = {}, circular = false) {
  if (!circular) return limitLinear(x, fs, opts);
  const n = x.length;
  const ext = new Float64Array(3 * n);
  ext.set(x, 0);
  ext.set(x, n);
  ext.set(x, 2 * n);
  return limitLinear(ext, fs, opts).slice(n, 2 * n);
}
