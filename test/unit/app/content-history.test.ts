/**
 * Archived content packs as the shell reads them (src/app/content/history.ts): the build's gzip
 * archives (`content/history/<revision>.json.gz`, docs/contract.md §7.6) are fetched as the bytes
 * the site serves, decompressed by the platform's `DecompressionStream`, and read exactly as
 * Node's zlib reads them. Anything else rejects, so a save waits for recovery instead of
 * restoring with the wrong pack.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseContentJson, requireValue } from '@aegis/runtime';
import { createHistoryLoader, gunzipText, historyPath } from '../../../src/app/content/history';
import type { FetchedFile, FileFetcher } from '../../../src/app/content/site';
import {
  CONTENT_HISTORY_DIRECTORY,
  CONTENT_PACK_ID,
  contentHistoryPath,
  contentRegistration,
} from '../../../src/rules/contract';
import { archivedRevision, readArchive } from '../../../scripts/lib/history.mjs';

const root = join(import.meta.dirname, '..', '..', '..');
const BASE = 'https://rumukh.github.io/pearl-sea/';
const revisions = readdirSync(join(root, ...CONTENT_HISTORY_DIRECTORY.split('/')))
  .map(archivedRevision)
  .filter((revision): revision is string => revision !== null)
  .sort();
const archive = (revision: string): Uint8Array =>
  readFileSync(join(root, ...contentHistoryPath(revision).split('/')));
const url = (revision: string): string => new URL(contentHistoryPath(revision), BASE).href;
/** A fresh ArrayBuffer holding exactly these bytes, as `Response.arrayBuffer()` gives. */
const buffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;

/** A static site that serves each file's bytes as they are (GitHub Pages sends no encoding). */
function site(files: Map<string, Uint8Array>): { fetcher: FileFetcher; requested: string[] } {
  const requested: string[] = [];
  const fetcher: FileFetcher = async (address) => {
    requested.push(address);
    const bytes = files.get(address);
    const file: FetchedFile = {
      ok: bytes !== undefined,
      status: bytes === undefined ? 404 : 200,
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => buffer(bytes ?? new Uint8Array()),
    };
    return file;
  };
  return { fetcher, requested };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('archived content packs', () => {
  it('are fetched from content/history/<revision>.json.gz', () => {
    expect(historyPath('1.2.0')).toBe('content/history/1.2.0.json.gz');
    for (const bad of ['../1.2.0', '', '1.2.0/../x']) {
      expect(() => historyPath(bad), bad).toThrow(RangeError);
    }
  });

  it('decompress in the platform to exactly the bytes zlib reads from them', async () => {
    expect(revisions.length, 'the build archives older revisions').toBeGreaterThanOrEqual(2);
    for (const revision of revisions) {
      const bytes = archive(revision);
      expect(await gunzipText(buffer(bytes)), revision).toBe(readArchive(bytes).toString('utf8'));
    }
  });

  it('load as the packs they hold, each fetched once', async () => {
    const files = new Map(revisions.map((revision) => [url(revision), archive(revision)]));
    const { fetcher, requested } = site(files);
    const load = createHistoryLoader(BASE, { id: CONTENT_PACK_ID }, fetcher);
    for (const revision of revisions) {
      const text = readArchive(archive(revision)).toString('utf8');
      const expected = requireValue(parseContentJson(text, contentRegistration, revision));
      const pack = await load(revision);
      expect(pack.id).toBe(CONTENT_PACK_ID);
      expect(pack.revision).toBe(revision);
      expect(pack).toEqual(expected);
      expect(await load(revision), 'the same pack again, without a fetch').toBe(pack);
    }
    expect(requested).toEqual(revisions.map(url));
  });

  it('reject an archive that cannot be read, and fetch it again on the next try', async () => {
    const revision = revisions[0]!;
    const good = archive(revision);
    const files = new Map<string, Uint8Array>();
    const { fetcher, requested } = site(files);
    const load = createHistoryLoader(BASE, { id: CONTENT_PACK_ID }, fetcher);
    const unreadable: [string, Uint8Array][] = [
      ['a truncated archive', good.subarray(0, good.length - 64)],
      // What a server that sent the archive with Content-Encoding: gzip would hand over.
      ['the pack decompressed by the browser', readArchive(good)],
    ];
    for (const [name, bytes] of unreadable) {
      files.set(url(revision), bytes);
      await expect(load(revision), name).rejects.toThrow(
        `${contentHistoryPath(revision)} cannot be read as a gzip archive.`,
      );
    }
    files.delete(url(revision));
    await expect(load(revision)).rejects.toThrow(
      `${contentHistoryPath(revision)} is unavailable (404).`,
    );
    files.set(url(revision), good);
    expect((await load(revision)).revision).toBe(revision);
    expect(requested).toEqual([url(revision), url(revision), url(revision), url(revision)]);
  });

  it('reject an archive that holds another revision', async () => {
    const [first, second] = revisions as [string, string];
    const { fetcher } = site(new Map([[url(second), archive(first)]]));
    const load = createHistoryLoader(BASE, { id: CONTENT_PACK_ID }, fetcher);
    await expect(load(second)).rejects.toThrow(
      `${contentHistoryPath(second)} is not revision ${second} of ${CONTENT_PACK_ID}.`,
    );
  });

  it('reject in a browser that cannot decompress, so the save waits for recovery', async () => {
    const revision = revisions[0]!;
    const { fetcher } = site(new Map([[url(revision), archive(revision)]]));
    const load = createHistoryLoader(BASE, { id: CONTENT_PACK_ID }, fetcher);
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(gunzipText(buffer(archive(revision)))).rejects.toThrow(
      'This browser cannot decompress archived content packs.',
    );
    await expect(load(revision)).rejects.toThrow(
      `${contentHistoryPath(revision)} cannot be read as a gzip archive.`,
    );
    vi.unstubAllGlobals();
    expect((await load(revision)).revision).toBe(revision);
  });
});
