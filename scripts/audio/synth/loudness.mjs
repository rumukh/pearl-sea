/**
 * Loudness metering after ITU-R BS.1770-4 (mono): K-weighting, momentary (400 ms) maximum,
 * short-term (3 s) maximum and gated integrated loudness. Loop-aware: circular measurement wraps
 * windows around the seam, matching what a looping player actually reproduces.
 */
import { biquadProcess, kWeightingCoefficients } from './filters.mjs';
import { powerToDb } from './dmath.mjs';

export function kWeighted(x, fs, circular = false) {
  const y = Float64Array.from(x);
  for (const c of kWeightingCoefficients(fs)) biquadProcess(y, c, circular);
  return y;
}

/** Mean-square of K-weighted windows: windowSec long, hopSec apart. */
function windowPowers(x, fs, windowSec, hopSec, circular) {
  const y = kWeighted(x, fs, circular);
  const n = y.length;
  const w = Math.round(windowSec * fs);
  const hop = Math.round(hopSec * fs);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + y[i] * y[i];
  const powers = [];
  if (circular) {
    if (w > n) throw new Error('Loop is shorter than the loudness window');
    for (let start = 0; start < n; start += hop) {
      const end = start + w;
      const sum =
        end <= n ? prefix[end] - prefix[start] : prefix[n] - prefix[start] + prefix[end - n];
      powers.push(sum / w);
    }
  } else if (n <= w) {
    powers.push(prefix[n] / w);
  } else {
    for (let start = 0; start + w <= n; start += hop)
      powers.push((prefix[start + w] - prefix[start]) / w);
    const lastStart = n - w;
    if (lastStart % hop !== 0) powers.push((prefix[n] - prefix[lastStart]) / w);
  }
  return powers;
}

const toLufs = (power) => -0.691 + powerToDb(power);

export function momentaryMax(x, fs, circular = false) {
  let best = 0;
  for (const p of windowPowers(x, fs, 0.4, 0.1, circular)) if (p > best) best = p;
  return toLufs(best);
}

export function shortTermMax(x, fs, circular = false) {
  let best = 0;
  for (const p of windowPowers(x, fs, 3, 0.1, circular)) if (p > best) best = p;
  return toLufs(best);
}

/** Gated integrated loudness (absolute gate -70 LUFS, relative gate -10 LU). */
export function integrated(x, fs, circular = false) {
  const blocks = windowPowers(x, fs, 0.4, 0.1, circular).filter((p) => toLufs(p) > -70);
  if (blocks.length === 0) return -Infinity;
  let mean = 0;
  for (const p of blocks) mean += p;
  mean /= blocks.length;
  const relative = toLufs(mean) - 10;
  const gated = blocks.filter((p) => toLufs(p) > relative);
  let sum = 0;
  for (const p of gated) sum += p;
  return toLufs(sum / gated.length);
}
