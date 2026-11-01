/**
 * Older content packs, fetched only when a save needs one. Every shipped revision is archived,
 * gzip-compressed, as `content/history/<revision>.json.gz` (the contract's `contentHistoryPath`,
 * docs/contract.md §7.6) and shipped with the site (and with the offline install), so a save made
 * before an update restores with exactly the pack it was played with, then moves to the newest
 * pack in the grotto (persistence/game-session.ts). The site serves an archive as the gzip file
 * it is, without a Content-Encoding, so the loader decompresses it with `DecompressionStream`; a
 * browser without one, like any archive that cannot be read, leaves the save to recovery
 * (`content-unavailable`). Each pack is validated against the contract's registration like the
 * current pack, and must be the pack and revision its name says.
 */
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import {
  CONTENT_HISTORY_DIRECTORY,
  contentHistoryPath,
  contentRegistration,
} from '../../rules/contract';
import type { ContentData } from '../../rules/contract';
import { SHIPPED_REVISION } from '../persistence/game-session';
import { fetchSiteBytes } from './site';
import type { FileFetcher } from './site';

export const HISTORY_DIRECTORY = CONTENT_HISTORY_DIRECTORY;

export function historyPath(revision: string): string {
  if (!SHIPPED_REVISION.test(revision)) throw new RangeError('Not a content revision.');
  return contentHistoryPath(revision);
}

/** The text a gzip file holds, decompressed by the platform; rejects when it cannot be. */
export async function gunzipText(archive: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot decompress archived content packs.');
  }
  const stream = new Blob([archive]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/**
 * A loader of archived packs for `GameDefinition.loadHistory`. A pack is fetched once per page;
 * a failed fetch is forgotten, so "Zkusit znovu" fetches it again (back online, say).
 */
export function createHistoryLoader(
  baseUrl: string,
  current: Pick<ContentPack<ContentData>, 'id'>,
  fetcher?: FileFetcher,
): (revision: string) => Promise<ContentPack<ContentData>> {
  const loaded = new Map<string, Promise<ContentPack<ContentData>>>();
  return (revision) => {
    const known = loaded.get(revision);
    if (known) return known;
    const loading = (async () => {
      const file = historyPath(revision);
      const archive = await fetchSiteBytes(baseUrl, file, fetcher);
      let text: string;
      try {
        text = await gunzipText(archive);
      } catch (cause) {
        throw new Error(`${file} cannot be read as a gzip archive.`, { cause });
      }
      const pack = requireValue(parseContentJson(text, contentRegistration, file));
      if (pack.id !== current.id || pack.revision !== revision) {
        throw new RangeError(`${file} is not revision ${revision} of ${current.id}.`);
      }
      return pack;
    })();
    loaded.set(revision, loading);
    loading.catch(() => loaded.delete(revision));
    return loading;
  };
}
