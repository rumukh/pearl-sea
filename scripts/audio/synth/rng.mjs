/**
 * Seeded, platform-independent randomness. Only 32-bit integer operations (Math.imul, shifts,
 * xor) and exact division by 2^32 are used, so every platform produces the same stream.
 * Math.random is never used anywhere in the audio pipeline.
 */

/** FNV-1a over the textual form of the parts, then a murmur3 finaliser. Returns a uint32 seed. */
export function hashSeed(...parts) {
  const text = parts.map((part) => String(part)).join('\u001f');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: small, fast, well-distributed 32-bit generator. */
export class Rng {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [-1, 1). */
  bipolar() {
    return 2 * this.next() - 1;
  }

  range(lo, hi) {
    return lo + (hi - lo) * this.next();
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  pick(items) {
    return items[this.int(items.length)];
  }

  /** Approximately normal (Irwin-Hall of four uniforms), unit variance, bounded to +-3.46. */
  gauss() {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508075688772;
  }
}

/** Colored noise source. Pink uses Paul Kellet's refined filter; brown is a leaky integrator. */
export class Noise {
  constructor(seed, color = 'white') {
    this.rng = new Rng(seed);
    this.color = color;
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
    this.b3 = 0;
    this.b4 = 0;
    this.b5 = 0;
    this.b6 = 0;
    this.brown = 0;
    if (!['white', 'pink', 'brown'].includes(color))
      throw new Error(`Unknown noise color ${color}`);
  }

  tick() {
    const white = this.rng.bipolar();
    if (this.color === 'white') return white;
    if (this.color === 'pink') {
      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.969 * this.b2 + white * 0.153852;
      this.b3 = 0.8665 * this.b3 + white * 0.3104856;
      this.b4 = 0.55 * this.b4 + white * 0.5329522;
      this.b5 = -0.7616 * this.b5 - white * 0.016898;
      const pink =
        this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
      this.b6 = white * 0.115926;
      return pink * 0.11;
    }
    this.brown = (this.brown + 0.02 * white) / 1.02;
    return this.brown * 3.5;
  }
}
