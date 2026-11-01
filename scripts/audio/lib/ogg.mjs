// @ts-check
/**
 * A minimal Ogg Vorbis reader for the audio pack. It reads the identification header (channels
 * and sample rate), the comment header (vendor string and tags) and the stream length in samples
 * (the granule position of the last page). It decodes no audio and needs no dependency.
 */

/**
 * @typedef {object} OggVorbisInfo
 * @property {number} channels
 * @property {number} sampleRate
 * @property {number} samples Total PCM samples per channel (the last granule position).
 * @property {string} vendor
 * @property {string[]} tags `KEY=value` user comments.
 * @property {number} streams Logical bitstreams in the file (1 for a plain Vorbis file).
 */

const CAPTURE = [0x4f, 0x67, 0x67, 0x53]; // "OggS"
const VORBIS = [0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]; // "vorbis"

/** @param {Uint8Array} bytes @param {number} at */
function byte(bytes, at) {
  const value = bytes[at];
  if (value === undefined) throw new Error('Truncated Ogg data.');
  return value;
}

/** @param {Uint8Array} bytes @param {number} at @param {number[]} pattern */
function matches(bytes, at, pattern) {
  return pattern.every((value, index) => bytes[at + index] === value);
}

/** @param {Uint8Array[]} parts */
function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** @param {Uint8Array} bytes */
function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * @param {Uint8Array} bytes
 * @returns {OggVorbisInfo}
 */
export function readOggVorbis(bytes) {
  const view = viewOf(bytes);
  /** @type {Uint8Array[]} */
  const packets = [];
  /** @type {Uint8Array[]} */
  let partial = [];
  /** @type {Set<number>} */
  const serials = new Set();
  let last = -1n;
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 27 > bytes.length || !matches(bytes, offset, CAPTURE)) {
      throw new Error(`No Ogg page at byte ${offset}.`);
    }
    if (byte(bytes, offset + 4) !== 0) throw new Error(`Unknown Ogg version at byte ${offset}.`);
    const granule = view.getBigInt64(offset + 6, true);
    serials.add(view.getUint32(offset + 14, true));
    const segments = byte(bytes, offset + 26);
    let data = offset + 27 + segments;
    for (let index = 0; index < segments; index++) {
      const lace = byte(bytes, offset + 27 + index);
      if (packets.length < 2) partial.push(bytes.subarray(data, data + lace));
      data += lace;
      if (lace < 255 && packets.length < 2) {
        packets.push(concat(partial));
        partial = [];
      }
    }
    if (data > bytes.length) throw new Error('Truncated Ogg page.');
    if (granule !== -1n) last = granule;
    offset = data;
  }
  const [id, comment] = packets;
  if (id === undefined || comment === undefined) throw new Error('Missing Vorbis headers.');
  if (byte(id, 0) !== 1 || !matches(id, 1, VORBIS)) throw new Error('Not a Vorbis stream.');
  const channels = byte(id, 11);
  const sampleRate = viewOf(id).getUint32(12, true);
  if (byte(comment, 0) !== 3 || !matches(comment, 1, VORBIS)) {
    throw new Error('Missing Vorbis comment header.');
  }
  const commentView = viewOf(comment);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let at = 7;
  const vendorLength = commentView.getUint32(at, true);
  at += 4;
  const vendor = decoder.decode(comment.subarray(at, at + vendorLength));
  at += vendorLength;
  const count = commentView.getUint32(at, true);
  at += 4;
  /** @type {string[]} */
  const tags = [];
  for (let index = 0; index < count; index++) {
    const length = commentView.getUint32(at, true);
    at += 4;
    tags.push(decoder.decode(comment.subarray(at, at + length)));
    at += length;
  }
  if (last < 0n) throw new Error('No granule position: empty stream.');
  return { channels, sampleRate, samples: Number(last), vendor, tags, streams: serials.size };
}
