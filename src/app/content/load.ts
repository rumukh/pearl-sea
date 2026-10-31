/**
 * The game's content pack (S3's `content/pearl-sea.content.json`, the contract's `CONTENT_FILE`),
 * fetched from the same origin and validated against the contract's registration (schema,
 * references, cross-checks) before any rule sees it. A pack that fails validation never reaches a
 * runtime host: boot shows the error screen instead.
 */
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { CONTENT_FILE, contentRegistration } from '../../rules/contract';
import type { ContentData } from '../../rules/contract';
import { fetchSiteText } from './site';
import type { Fetcher } from './site';

export const CONTENT_PATH = `content/${CONTENT_FILE}`;

export async function loadContentPack(
  baseUrl: string,
  fetcher?: Fetcher,
): Promise<ContentPack<ContentData>> {
  const text = await fetchSiteText(baseUrl, CONTENT_PATH, fetcher);
  return requireValue(parseContentJson(text, contentRegistration, CONTENT_FILE));
}
