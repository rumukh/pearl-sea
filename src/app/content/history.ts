/**
 * Older content packs, fetched only when a save needs one. Every shipped revision is archived in
 * `content/history/<revision>.json` and shipped with the site (and with the offline install), so
 * a save made before an update restores with exactly the pack it was played with, then moves to
 * the newest pack in the grotto (persistence/game-session.ts). Each file is validated against the
 * contract's registration like the current pack, and must be the pack and revision its name says.
 */
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { contentRegistration } from '../../rules/contract';
import type { ContentData } from '../../rules/contract';
import { SHIPPED_REVISION } from '../persistence/game-session';
import { fetchSiteText } from './site';
import type { Fetcher } from './site';

export const HISTORY_DIRECTORY = 'content/history';

export function historyPath(revision: string): string {
  if (!SHIPPED_REVISION.test(revision)) throw new RangeError('Not a content revision.');
  return `${HISTORY_DIRECTORY}/${revision}.json`;
}

/**
 * A loader of archived packs for `GameDefinition.loadHistory`. A pack is fetched once per page;
 * a failed fetch is forgotten, so "Zkusit znovu" fetches it again (back online, say).
 */
export function createHistoryLoader(
  baseUrl: string,
  current: Pick<ContentPack<ContentData>, 'id'>,
  fetcher?: Fetcher,
): (revision: string) => Promise<ContentPack<ContentData>> {
  const loaded = new Map<string, Promise<ContentPack<ContentData>>>();
  return (revision) => {
    const known = loaded.get(revision);
    if (known) return known;
    const loading = (async () => {
      const file = historyPath(revision);
      const text = await fetchSiteText(baseUrl, file, fetcher);
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
