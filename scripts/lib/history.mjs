// @ts-check
/**
 * The content history archive format (docs/contract.md §7.6), shared by content-bump.mjs, which
 * writes archives, and validate-content.mjs, build.mjs and the tests, which read them.
 *
 * An archive is the pack deployed as `<revision>`, byte for byte, gzip-compressed as
 * `content/history/<revision>.json.gz`: one gzip member whose header is fixed (no file name,
 * comment or extra field, modification time 0, OS byte 255 "unknown"), so the machine that wrote
 * it leaves no trace. The compressed bytes still depend on the zlib build, so an archive is
 * written once and never regenerated: every check compares the decompressed bytes.
 */
import { crc32, gunzipSync, gzipSync } from 'node:zlib';

/** The same values as in src/rules/contract/content.ts (test/tooling/history-archive.test.ts). */
export const HISTORY_DIRECTORY = 'content/history';
export const HISTORY_EXTENSION = '.json.gz';

/** RFC 1952's "unknown" operating system; zlib writes 3 on Linux and 10 on Windows. */
const OS_UNKNOWN = 255;

/** @param {string} revision */
export function archiveName(revision) {
  return `${revision}${HISTORY_EXTENSION}`;
}

/**
 * The revision an archive's file name claims, or null for a name that is not an archive's.
 * @param {string} name
 * @returns {string | null}
 */
export function archivedRevision(name) {
  return name.endsWith(HISTORY_EXTENSION) && name.length > HISTORY_EXTENSION.length
    ? name.slice(0, -HISTORY_EXTENSION.length)
    : null;
}

/**
 * An archive of a pack's exact bytes.
 * @param {Uint8Array} pack
 * @returns {Buffer}
 */
export function compressArchive(pack) {
  const archive = gzipSync(pack, { level: 9 });
  archive[9] = OS_UNKNOWN;
  return archive;
}

/**
 * The pack bytes an archive holds. Throws unless the archive is a single gzip member with the
 * fixed header whose trailer (CRC-32 and length) covers everything it decompresses to, so that
 * every gzip reader, `DecompressionStream` included, reads the same pack from it.
 * @param {Uint8Array} archive
 * @returns {Buffer}
 */
export function readArchive(archive) {
  const bytes = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) {
    throw new Error('not a gzip file');
  }
  if (bytes[3] !== 0) throw new Error('the gzip header names a file or carries extra fields');
  if (bytes.readUInt32LE(4) !== 0) throw new Error('the gzip header carries a modification time');
  if (bytes[9] !== OS_UNKNOWN) throw new Error('the gzip header names an operating system');
  /** @type {Buffer} */
  let pack;
  try {
    pack = gunzipSync(bytes);
  } catch (error) {
    throw new Error(
      `the archive does not decompress (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const crc = bytes.readUInt32LE(bytes.length - 8);
  const size = bytes.readUInt32LE(bytes.length - 4);
  if (crc !== crc32(pack) || size !== pack.length >>> 0) {
    throw new Error('the archive is not a single gzip member');
  }
  return pack;
}
