/**
 * Time-based effects: an 8-line feedback delay network reverb with input diffusion and
 * frequency-dependent decay, and a damped feedback echo. Both support linear processing (one-shot
 * sounds, tails must fit in the buffer) and circular processing (loops: a priming pass wraps the
 * tail of the period around to its start, so the seam is sample-accurate).
 */
import { dbToGain, exp, LN10 } from './dmath.mjs';
import { applyEq, onePoleCoefficient as onePoleFactor } from './filters.mjs';

const BASE_DELAYS_MS = [23.1, 27.7, 31.3, 36.7, 40.9, 45.3, 49.1, 53.9];
const DIFFUSER_MS = [4.77, 3.59, 12.73, 9.3];
const HADAMARD_NORM = 0.35355339059327373; // 1 / sqrt(8)

function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function primeAtLeast(n) {
  let m = Math.max(2, n);
  while (!isPrime(m)) m++;
  return m;
}

class DelayLine {
  constructor(length) {
    this.buf = new Float64Array(length);
    this.pos = 0;
  }

  read() {
    return this.buf[this.pos];
  }

  write(v) {
    this.buf[this.pos] = v;
    this.pos++;
    if (this.pos === this.buf.length) this.pos = 0;
  }
}

/**
 * Create a reverb processor. Parameters: size (delay scale), decay (RT60 seconds at low and mid
 * frequencies), damping (Hz, the feedback lowpass: higher frequencies decay faster), predelay
 * (seconds), diffusion (0..0.8), lowcut/highcut (Hz, applied to the wet output).
 */
function createReverb(params, fs) {
  const size = params.size ?? 1;
  const decay = params.decay ?? 1.5;
  const damping = params.damping ?? 6000;
  const diffusion = params.diffusion ?? 0.62;
  const used = new Set();
  const lines = BASE_DELAYS_MS.map((ms) => {
    let len = primeAtLeast(Math.round((ms * size * fs) / 1000));
    while (used.has(len)) len = primeAtLeast(len + 1);
    used.add(len);
    return new DelayLine(len);
  });
  const gains = lines.map((line) => exp((-3 * LN10 * line.buf.length) / (fs * decay)));
  const dampA = onePoleFactor(damping, fs);
  const dampState = new Float64Array(8);
  const diffusers = DIFFUSER_MS.map(
    (ms) => new DelayLine(Math.max(1, Math.round((ms * size * fs) / 1000))),
  );
  const pre = new DelayLine(Math.max(1, Math.round((params.predelay ?? 0.012) * fs)));
  const o = new Float64Array(8);
  return (x) => {
    pre.write(x);
    let v = pre.read();
    for (let d = 0; d < 4; d++) {
      const line = diffusers[d];
      const g = d < 2 ? diffusion : diffusion * 0.83;
      const delayed = line.read();
      const out = -g * v + delayed;
      line.write(v + g * out);
      v = out;
    }
    for (let i = 0; i < 8; i++) {
      const raw = lines[i].read();
      dampState[i] = raw + dampA * (dampState[i] - raw);
      o[i] = dampState[i] * gains[i];
    }
    // Fast Walsh-Hadamard transform (orthogonal, energy preserving).
    for (let step = 1; step < 8; step <<= 1) {
      for (let i = 0; i < 8; i += step << 1) {
        for (let j = i; j < i + step; j++) {
          const a = o[j];
          const b = o[j + step];
          o[j] = a + b;
          o[j + step] = a - b;
        }
      }
    }
    let wet = 0;
    for (let i = 0; i < 8; i++) {
      const fed = o[i] * HADAMARD_NORM;
      lines[i].write(fed + v * 0.5);
      wet += i % 2 === 0 ? fed : -fed;
    }
    return wet * 0.5;
  };
}

function createEcho(params, fs) {
  const line = new DelayLine(Math.max(1, Math.round(params.time * fs)));
  const feedback = params.feedback ?? 0.35;
  const dampA = onePoleFactor(params.damping ?? 4000, fs);
  let state = 0;
  return (x) => {
    const delayed = line.read();
    state = delayed + dampA * (state - delayed);
    line.write(x + feedback * state);
    return delayed;
  };
}

function runProcessor(make, input, circular) {
  const tick = make();
  const n = input.length;
  const out = new Float64Array(n);
  if (circular) for (let i = 0; i < n; i++) tick(input[i]);
  for (let i = 0; i < n; i++) out[i] = tick(input[i]);
  return out;
}

/** Process a send bus through a reverb; returns the wet signal (already gain-adjusted and EQ'd). */
export function reverb(input, params, fs, circular = false) {
  const wet = runProcessor(() => createReverb(params, fs), input, circular);
  const eq = [];
  if (params.lowcut) eq.push({ type: 'highpass', freq: params.lowcut, q: 0.7071067811865476 });
  if (params.highcut) eq.push({ type: 'lowpass', freq: params.highcut, q: 0.7071067811865476 });
  applyEq(wet, eq, fs, circular);
  const gain = dbToGain(params.db ?? 0);
  for (let i = 0; i < wet.length; i++) wet[i] *= gain;
  return wet;
}

/** Process a send bus through a damped feedback echo; returns the wet signal. */
export function echo(input, params, fs, circular = false) {
  const wet = runProcessor(() => createEcho(params, fs), input, circular);
  const gain = dbToGain(params.db ?? 0);
  for (let i = 0; i < wet.length; i++) wet[i] *= gain;
  return wet;
}
