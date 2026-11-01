/**
 * Content history in a real browser (docs/contract.md §7.6): a child whose save pins an older
 * content revision opens the game. The shell fetches that revision's gzip archive
 * (`content/history/<revision>.json.gz`, served as the gzip file it is), decompresses it with the
 * browser's `DecompressionStream`, restores the save with exactly that pack, and at the grotto
 * moves the save to the newest pack with the child's progress kept.
 *
 * The save is made in Node: S2's trace player plays the archived pack and its snapshot is stored
 * as the shell's checkpoint would store it (`support/saves.ts`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import { readArchive, archivedRevision } from '../../scripts/lib/history.mjs';
import { pearlSeaGame } from '../../src/app/game/definition';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import {
  CONTENT_HISTORY_DIRECTORY,
  contentHistoryPath,
  contentRegistration,
} from '../../src/rules/contract';
import type { GameView } from '../../src/rules/contract';
import { PERFECT, Player } from '../traces/support';
import { GAME, PACK, SEED_DAY, storedView, throughStory } from './support/game';
import { observe } from './support/observe';
import { FAMILY_KEY, familyPayload, gamePayload, storeRecord } from './support/saves';
import { ready } from './support/screens';

test.use({ reducedMotion: 'reduce' });

const CHILD = 'profile-1';
const root = new URL('../../', import.meta.url);

/** The newest archived revision: the one an update most recently left saves on. */
const OLD: string = readdirSync(new URL(`${CONTENT_HISTORY_DIRECTORY}/`, root))
  .map(archivedRevision)
  .filter((revision): revision is string => revision !== null)
  .reduce((newest, revision) => {
    const [a, b] = [revision, newest].map((r) => r.split('.').map(Number)) as [number[], number[]];
    const at = a.findIndex((part, i) => part !== b[i]);
    return at >= 0 && a[at]! > b[at]! ? revision : newest;
  });
const OLD_PACK = requireValue(
  parseContentJson(
    readArchive(readFileSync(new URL(contentHistoryPath(OLD), root))).toString('utf8'),
    contentRegistration,
    contentHistoryPath(OLD),
  ),
);
const OLD_GAME = pearlSeaGame(pearlSeaAdapter, OLD_PACK);

/** A 3rd grader who chose Krab and played the first lesson of Slunná laguna on the old pack. */
async function playedOnOldPack(): Promise<RuntimeSnapshot> {
  const player = new Player(PERFECT, 'e2e-history', OLD_GAME.adapter, OLD_GAME.content);
  try {
    expect(await player.begin('krab-tvrdak', SEED_DAY), player.failures.join(', ')).toBe(true);
    await player.playLevel('sunny-lagoon.1');
    expect(player.failures).toEqual([]);
    return player.host.snapshot();
  } finally {
    await player.dispose();
  }
}

/** The stored game once it pins the newest pack (the oracle restores only that), else null. */
async function storedOnNewestPack(page: Page): Promise<GameView | null> {
  try {
    return await storedView(page, CHILD);
  } catch {
    return null;
  }
}

test('a save made on an older revision restores with its archived pack, then moves on', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  expect(OLD, 'the build archives an older revision than the one it serves').not.toBe(
    PACK.revision,
  );
  const snapshot = await playedOnOldPack();
  expect(snapshot.content.revision).toBe(OLD);

  const seen = observe(page, new URL(baseURL!).origin);
  const archives: { url: string; status: number; type?: string; encoding?: string }[] = [];
  page.on('response', (response) => {
    if (!response.url().includes('/content/history/')) return;
    const headers = response.headers();
    archives.push({
      url: response.url(),
      status: response.status(),
      type: headers['content-type'],
      encoding: headers['content-encoding'],
    });
  });

  await page.goto('./');
  await ready(page, 'title');
  await storeRecord(
    page,
    FAMILY_KEY,
    await familyPayload({
      profiles: [{ id: CHILD, name: 'Ema', avatar: 'diver-3', address: 'girl' }],
      grownUpsLanguage: 'cs',
    }),
  );
  await storeRecord(
    page,
    { gameId: GAME.gameId, profileId: CHILD },
    await gamePayload(OLD_GAME, CHILD, snapshot),
  );
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');

  // The old pack came from its archive, as the gzip file it is: no Content-Encoding, so the
  // bytes the offline installer hashes are the archive's own.
  expect(archives.length, 'the archived pack was fetched').toBeGreaterThan(0);
  for (const archive of archives) {
    expect(archive).toEqual({
      url: new URL(contentHistoryPath(OLD), baseURL).href,
      status: 200,
      type: 'application/gzip',
      encoding: undefined,
    });
  }

  // At the grotto the save moved to the newest pack, keeping what was played on the old one.
  let moved: GameView | null = null;
  await expect
    .poll(
      async () => {
        moved = await storedOnNewestPack(page);
        return moved !== null;
      },
      { message: `the save moves from ${OLD} to ${PACK.revision}`, timeout: 15_000 },
    )
    .toBe(true);
  const view = moved! as GameView;
  expect(view.onboarding.firstFriend).toBe('krab-tvrdak');
  const lagoon = view.hub.regions.find((region) => region.id === 'sunny-lagoon');
  expect(lagoon?.levels.find((level) => level.id === 'sunny-lagoon.1')?.status).toBe('completed');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
});
