/**
 * The packs the rules' tests play: the rules' lagoon fixture (lagoon-pack.ts), the contract's
 * small mini pack (test/fixtures/contract/mini-pack.json) and the game's own pack
 * (content/pearl-sea.content.json), all validated by the contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseContentJson, requireValue, validateContent } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { CONTENT_FILE, contentRegistration } from '../../../src/rules/contract';
import type { ContentData } from '../../../src/rules/contract';
import { lagoonPackJson } from './lagoon-pack';

export { LAGOON_EGGS, lagoonPack, lagoonPackJson } from './lagoon-pack';

/** The lagoon fixture with a change (a balance number, a level), validated again. */
export function lagoonPackWith(change: (data: ContentData) => void): ContentPack<ContentData> {
  const json = lagoonPackJson();
  change(json.data);
  return requireValue(validateContent(json, contentRegistration, 'lagoon-changed'));
}

const MINI_PACK = join(import.meta.dirname, '..', 'contract', 'mini-pack.json');

/** The contract's mini pack (two regions of a few words each), validated. */
export function miniPack(): ContentPack<ContentData> {
  return requireValue(
    parseContentJson(readFileSync(MINI_PACK, 'utf8'), contentRegistration, 'mini-pack.json'),
  );
}

const REAL_PACK = join(import.meta.dirname, '..', '..', '..', 'content', CONTENT_FILE);
let real: ContentPack<ContentData> | undefined;

/** The game's content pack (content/pearl-sea.content.json, S3), validated once per test file. */
export function realPack(): ContentPack<ContentData> {
  real ??= requireValue(
    parseContentJson(readFileSync(REAL_PACK, 'utf8'), contentRegistration, CONTENT_FILE),
  );
  return real;
}
