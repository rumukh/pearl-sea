/**
 * Sample-rate conversion helpers: Kaiser-windowed sinc FIR design, polyphase decimation from the
 * oversampled synthesis rate (linear or circular) and 4x interpolation for true-peak metering.
 */
import { besselI0, sinc, sqrt } from './dmath.mjs';

/** Kaiser-windowed sinc lowpass, odd length, unity DC gain. cutoff in cycles per sample. */
export function designLowpass(numTaps, cutoff, beta) {
  if (numTaps % 2 !== 1) throw new Error('numTaps must be odd');
  const taps = new Float64Array(numTaps);
  const c = (numTaps - 1) / 2;
  const i0b = besselI0(beta);
  let sum = 0;
  for (let n = 0; n < numTaps; n++) {
    const x = n - c;
    const r = c === 0 ? 0 : x / c;
    const w = besselI0(beta * sqrt(Math.max(0, 1 - r * r))) / i0b;
    const h = 2 * cutoff * sinc(2 * cutoff * x) * w;
    taps[n] = h;
    sum += h;
  }
  for (let n = 0; n < numTaps; n++) taps[n] /= sum;
  return taps;
}

const decimators = new Map();

/**
 * Anti-aliasing filter for decimation by `factor` to fsOut: passband to 0.43 fsOut (9.5 kHz at
 * 22.05 kHz), at least 90 dB attenuation from the output Nyquist frequency upwards.
 */
export function decimatorTaps(factor, fsOut) {
  const key = `${factor}:${fsOut}`;
  let taps = decimators.get(key);
  if (!taps) {
    const fsIn = fsOut * factor;
    const pass = 0.43 * fsOut;
    const stop = 0.5 * fsOut;
    const attenuation = 90;
    const beta = 0.1102 * (attenuation - 8.7);
    let numTaps = Math.ceil((attenuation - 7.95) / (14.36 * ((stop - pass) / fsIn))) + 1;
    if (numTaps % 2 === 0) numTaps++;
    taps = designLowpass(numTaps, (pass + stop) / 2 / fsIn, beta);
    decimators.set(key, taps);
  }
  return taps;
}

/** Extend a buffer by `pad` samples on both sides: zeros (linear) or wrapped samples (circular). */
function padded(input, pad, circular) {
  const n = input.length;
  const ext = new Float64Array(n + 2 * pad);
  ext.set(input, pad);
  if (circular) {
    for (let i = 0; i < pad; i++) {
      ext[pad - 1 - i] = input[(((n - 1 - i) % n) + n) % n];
      ext[pad + n + i] = input[i % n];
    }
  }
  return ext;
}

/** Decimate by an integer factor with a linear-phase FIR; output is time-aligned with the input. */
export function decimate(input, factor, fsOut, circular = false) {
  if (factor === 1) return Float64Array.from(input);
  if (circular && input.length % factor !== 0)
    throw new Error('Loop length must be a multiple of the oversampling factor');
  const taps = decimatorTaps(factor, fsOut);
  const N = taps.length;
  const D = (N - 1) / 2;
  const ext = padded(input, D, circular);
  const nOut = Math.floor(input.length / factor);
  const out = new Float64Array(nOut);
  for (let j = 0; j < nOut; j++) {
    const top = j * factor + 2 * D; // ext index of x[j*factor + D]
    let acc = 0;
    for (let k = 0; k < N; k++) acc += taps[k] * ext[top - k];
    out[j] = acc;
  }
  return out;
}

let interpolatorTaps;

/** 4x interpolation filter (polyphase), used for true-peak measurement. */
function interpolator() {
  if (!interpolatorTaps) interpolatorTaps = designLowpass(129, (0.5 / 4) * 0.97, 8);
  return interpolatorTaps;
}

/** Maximum absolute value of the 4x-interpolated signal (true peak, linear). */
export function truePeak(input, circular = false) {
  const taps = interpolator();
  const N = taps.length;
  const perPhase = Math.ceil(N / 4);
  const ext = padded(input, perPhase + 1, circular);
  const n = input.length;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = input[i] < 0 ? -input[i] : input[i];
    if (v > peak) peak = v;
  }
  for (let m = 0; m < n + perPhase; m++) {
    for (let p = 0; p < 4; p++) {
      let acc = 0;
      for (let k = 0; p + 4 * k < N; k++) {
        const idx = m - k + perPhase + 1;
        if (idx >= 0 && idx < ext.length) acc += taps[p + 4 * k] * ext[idx];
      }
      acc *= 4;
      const v = acc < 0 ? -acc : acc;
      if (v > peak) peak = v;
    }
  }
  return peak;
}
