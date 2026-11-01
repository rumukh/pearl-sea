/**
 * The packs the rules' tests play: the rules' lagoon fixture (lagoon-pack.ts) and the contract's
 * small mini pack (test/fixtures/contract/mini-pack.json), both validated by the contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseContentJson, requireValue, validateContent } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { contentRegistration } from '../../../src/rules/contract';
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
