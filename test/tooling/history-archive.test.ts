/**
 * The content history archive format (scripts/lib/history.mjs, docs/contract.md §7.6): an
 * archive is the deployed pack's exact bytes in one gzip member with a fixed header, named by its
 * revision, and the toolchain and the contract agree on where archives live.
 */
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_HISTORY_DIRECTORY,
  CONTENT_HISTORY_EXTENSION,
  contentHistoryPath,
} from '../../src/rules/contract';
import {
  HISTORY_DIRECTORY,
  HISTORY_EXTENSION,
  archiveName,
  archivedRevision,
  compressArchive,
  readArchive,
} from '../../scripts/lib/history.mjs';

/** A pack's bytes as prettier writes them, with Czech text and a final newline. */
const PACK = Buffer.from(
  '{\n  "id": "pearl-sea",\n  "revision": "1.0.0",\n  "title": "Perlové moře"\n}\n',
);

describe('content history archives', () => {
  it('live where the contract says, named by their revision', () => {
    expect(HISTORY_DIRECTORY).toBe(CONTENT_HISTORY_DIRECTORY);
    expect(HISTORY_EXTENSION).toBe(CONTENT_HISTORY_EXTENSION);
    expect(contentHistoryPath('1.2.0')).toBe('content/history/1.2.0.json.gz');
    expect(`${HISTORY_DIRECTORY}/${archiveName('1.2.0')}`).toBe(contentHistoryPath('1.2.0'));
    expect(archivedRevision('1.2.0.json.gz')).toBe('1.2.0');
    for (const name of ['1.2.0.json', '1.2.0.gz', '.json.gz', 'README.md']) {
      expect(archivedRevision(name), name).toBeNull();
    }
  });

  it('hold the pack byte for byte, in one gzip member with a fixed header', () => {
    const archive = compressArchive(PACK);
    expect(readArchive(archive).equals(PACK)).toBe(true);
    // Magic, deflate, no flags, modification time 0; byte 9 is the OS, pinned to "unknown".
    expect([...archive.subarray(0, 8)]).toEqual([0x1f, 0x8b, 8, 0, 0, 0, 0, 0]);
    expect(archive[9]).toBe(255);
  });

  it('accept any compression of the same bytes: archives are compared decompressed', () => {
    const other = gzipSync(PACK, { level: 1 });
    other[9] = 255;
    expect(other.equals(compressArchive(PACK))).toBe(false);
    expect(readArchive(other).equals(PACK)).toBe(true);
  });

  it('refuse anything a gzip reader could read differently', () => {
    const good = compressArchive(PACK);
    const changed = (at: number, value: number) => {
      const bytes = Buffer.from(good);
      bytes[at] = value;
      return bytes;
    };
    const cases: [string, Buffer, RegExp][] = [
      ['plain JSON', PACK, /not a gzip file/],
      ['a file name flag', changed(3, 8), /names a file/],
      ['a modification time', changed(4, 1), /modification time/],
      ['zlib’s Linux OS byte', changed(9, 3), /operating system/],
      ['zlib’s Windows OS byte', changed(9, 10), /operating system/],
      ['a second member', Buffer.concat([good, good]), /single gzip member/],
      ['trailing bytes', Buffer.concat([good, Buffer.from([0, 0, 0, 0])]), /single gzip member/],
    ];
    for (const [name, bytes, message] of cases) {
      expect(() => readArchive(bytes), name).toThrow(message);
    }
  });
});
