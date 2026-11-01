/**
 * 16-bit PCM WAV (RIFF) writer and strict reader, plus float-to-int16 quantisation with seeded
 * TPDF dither. Output is a canonical 44-byte header followed by little-endian samples, so the same
 * samples always produce the same bytes.
 */
import { Rng } from './rng.mjs';

/** Quantise floats in [-1, 1) to int16 with optional TPDF dither (1 LSB peak each side). */
export function quantize(samples, { dither = true, seed = 1, edges = 0 } = {}) {
  const n = samples.length;
  const out = new Int16Array(n);
  const rng = new Rng(seed);
  for (let i = 0; i < n; i++) {
    let v = samples[i] * 32768;
    // Dither is withheld on `edges` samples at both ends so one-shots start and end on true zero.
    if (dither && i >= edges && i < n - edges) v += rng.next() - rng.next();
    let q = Math.round(v);
    if (q > 32767) q = 32767;
    else if (q < -32768) q = -32768;
    out[i] = q;
  }
  return out;
}

export function encodeWav(int16, sampleRate) {
  const dataBytes = int16.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < int16.length; i++) buf.writeInt16LE(int16[i], 44 + 2 * i);
  return buf;
}

/** Parse and validate a canonical PCM WAV produced by encodeWav (any other layout is rejected). */
export function decodeWav(buf) {
  const fail = (why) => {
    throw new Error(`Invalid WAV: ${why}`);
  };
  if (buf.length < 44) fail('too short');
  if (buf.toString('ascii', 0, 4) !== 'RIFF') fail('missing RIFF');
  if (buf.readUInt32LE(4) !== buf.length - 8) fail('RIFF size mismatch');
  if (buf.toString('ascii', 8, 12) !== 'WAVE') fail('missing WAVE');
  if (buf.toString('ascii', 12, 16) !== 'fmt ') fail('missing fmt chunk');
  if (buf.readUInt32LE(16) !== 16) fail('unexpected fmt size');
  const format = buf.readUInt16LE(20);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const byteRate = buf.readUInt32LE(28);
  const blockAlign = buf.readUInt16LE(32);
  const bitsPerSample = buf.readUInt16LE(34);
  if (format !== 1) fail('not PCM');
  if (channels !== 1) fail('not mono');
  if (bitsPerSample !== 16) fail('not 16-bit');
  if (blockAlign !== 2 || byteRate !== sampleRate * 2)
    fail('inconsistent block align or byte rate');
  if (buf.toString('ascii', 36, 40) !== 'data') fail('missing data chunk');
  const dataBytes = buf.readUInt32LE(40);
  if (dataBytes !== buf.length - 44 || dataBytes % 2 !== 0) fail('data size mismatch');
  const samples = new Int16Array(dataBytes / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(44 + 2 * i);
  return { format, channels, sampleRate, bitsPerSample, samples };
}

/** Int16 samples to floats in [-1, 1). */
export function toFloat(int16) {
  const out = new Float64Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 32768;
  return out;
}
