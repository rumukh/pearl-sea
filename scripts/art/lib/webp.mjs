// @ts-check
/**
 * Reads the canvas size and the chunk list of a WebP file (RIFF container: VP8, VP8L or VP8X)
 * without decoding it. Used to measure the art catalog and to prove shipped art carries no
 * metadata chunks (EXIF, XMP, ICCP).
 */

/**
 * @typedef {object} WebpInfo
 * @property {number} width
 * @property {number} height
 * @property {boolean} alpha
 * @property {boolean} lossless
 * @property {string[]} chunks FourCC of every chunk, in order.
 */

/** @param {Uint8Array} bytes @param {number} at */
function fourcc(bytes, at) {
  return String.fromCharCode(...bytes.subarray(at, at + 4));
}

/** @param {Uint8Array} bytes @param {number} at */
function u8(bytes, at) {
  const value = bytes[at];
  if (value === undefined) throw new Error('Truncated WebP data.');
  return value;
}

/** @param {Uint8Array} bytes @param {number} at */
function u24(bytes, at) {
  return u8(bytes, at) | (u8(bytes, at + 1) << 8) | (u8(bytes, at + 2) << 16);
}

/**
 * @param {Uint8Array} bytes
 * @returns {WebpInfo}
 */
export function readWebp(bytes) {
  if (bytes.length < 20 || fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WEBP') {
    throw new Error('Not a WebP file.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) throw new Error('RIFF size mismatch.');
  /** @type {string[]} */
  const chunks = [];
  let width = 0;
  let height = 0;
  let alpha = false;
  let lossless = false;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const kind = fourcc(bytes, at);
    const size = view.getUint32(at + 4, true);
    const data = at + 8;
    if (data + size > bytes.length) throw new Error(`Truncated ${kind} chunk.`);
    chunks.push(kind);
    if (kind === 'VP8X') {
      alpha = (u8(bytes, data) & 0x10) !== 0;
      width = u24(bytes, data + 4) + 1;
      height = u24(bytes, data + 7) + 1;
    } else if (kind === 'VP8 ' && width === 0) {
      width = view.getUint16(data + 6, true) & 0x3fff;
      height = view.getUint16(data + 8, true) & 0x3fff;
    } else if (kind === 'VP8L') {
      lossless = true;
      if (width === 0) {
        const bits = view.getUint32(data + 1, true);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        alpha = ((bits >>> 28) & 1) === 1;
      }
    }
    at = data + size + (size % 2);
  }
  if (width === 0 || height === 0) throw new Error('No WebP image chunk.');
  return { width, height, alpha, lossless, chunks };
}
