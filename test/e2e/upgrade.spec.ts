/**
 * A save from an older state version opens in this build through the save migrations
 * (docs/contract.md §7.6, `SAVE_MIGRATIONS` in src/app/game/definition.ts), stored as a deployed
 * build stored it: the SDK's envelope under that version's policy.
 *
 * Version 1 → 2: a `family` or `test-word` hint named the asked word itself, which version 2 would
 * show as an example on another word and so give the answer away. A round in flight on such a
 * problem opens where it was, without that hint, and plays on; the next checkpoint stores the
 * current version. A backup file from version 1 loads in Pro dospělé the same way.
 */
import { MemorySaveStorage, SaveService } from '@aegis/browser/save';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { Page } from '@playwright/test';
import type { PearlSeaGame } from '../../src/app/game/definition';
import { createBackup } from '../../src/app/persistence/backup';
import { checkpointMetadata, gamePolicy } from '../../src/app/persistence/game-session';
import { STATE_VERSION } from '../../src/rules/contract';
import type { Hint, ProblemView } from '../../src/rules/contract';
import {
  GAME,
  LAGOON_LESSONS,
  SEED_DAY,
  answerStep,
  shownScreen,
  throughStory,
} from './support/game';
import { FAMILY_KEY, familyPayload, readRecord, storeRecord } from './support/saves';
import { expect, test } from './support/fixtures';
import { enterGrownUps, ready } from './support/screens';
import { PERFECT, Player } from '../traces/support';

const CHILD = 'profile-1';
const DIVER = { name: 'Ema', avatar: 'diver-2', address: 'girl' } as const;

/** The hint of the step on screen. */
function stepHint({ problem, step }: ProblemView): Hint | null {
  if (problem.kind === 'gaps') return problem.gaps[step]?.hint ?? null;
  if (problem.kind === 'mistake') return step === 1 ? problem.fix.hint : null;
  return problem.kind === 'classify' || problem.kind === 'odd' || problem.kind === 'relation'
    ? problem.hint
    : null;
}

interface InFlight {
  readonly snapshot: RuntimeSnapshot;
  readonly index: number;
  readonly step: number;
}

/**
 * A 3rd grader in a lagoon round whose step on screen has a `test-word` or `family` hint (the
 * rules played in Node): the kind of save version 1 stored with the asked word in its hint.
 */
async function roundInFlight(): Promise<InFlight> {
  const player = new Player(PERFECT, 'e2e-upgrade', GAME.adapter, GAME.content);
  try {
    if (!(await player.begin('krab-tvrdak', SEED_DAY))) {
      throw new Error(`the seeded child could not begin: ${player.failures.join(', ')}`);
    }
    for (const level of LAGOON_LESSONS) {
      if (!(await player.act({ type: 'startLevel', level }))) continue;
      await player.settleStory();
      for (let activity = 0; activity < 10; activity++) {
        for (let guard = 0; guard < 300; guard++) {
          const round = player.view().round;
          if (!round || round.status !== 'active') break;
          if (round.type !== 'problems' || !round.problem) {
            await player.playRound();
            continue;
          }
          const kind = stepHint(round.problem)?.kind;
          if (kind === 'test-word' || kind === 'family') {
            const { index, step } = round.problem;
            return { snapshot: player.host.snapshot(), index, step };
          }
          await player.answer();
        }
        if (player.view().round === null) break;
        await player.act({ type: 'endRound', reason: 'done' });
        await player.settleStory();
        const run = player.view().run;
        if (run === null || run.result !== null) break;
        await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
        await player.settleStory();
      }
    }
    throw new Error('no step of the lagoon has a test-word or family hint');
  } finally {
    await player.dispose();
  }
}

/** The envelope a build of state version 1 stored for `snapshot`. */
async function versionOne(snapshot: RuntimeSnapshot): Promise<string> {
  const game = { ...GAME, adapter: { ...GAME.adapter, stateVersion: 1 } } as PearlSeaGame;
  const old = { ...snapshot, stateVersion: 1 };
  const storage = new MemorySaveStorage();
  const policy = gamePolicy(game, CHILD);
  const saves = new SaveService(storage, policy);
  await saves.load();
  await saves.save({ ...checkpointMetadata(game, CHILD, old), state: old });
  return (await storage.read(policy)).current!.payload;
}

/** From the title, open the child and expect the round in flight, the old hint gone. */
async function resumesWithoutTheHint(page: Page, flight: InFlight): Promise<void> {
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-round');
  const card = page.getByTestId('problem');
  await expect(card).toHaveAttribute('data-index', String(flight.index));
  await expect(card).toHaveAttribute('data-step', String(flight.step));
  await expect(page.getByTestId('round-hint'), 'the hint that named the asked word').toHaveCount(0);
  await answerStep(page, CHILD);
  expect(await shownScreen(page)).toBe('screen-round');
  const stored = JSON.parse((await readRecord(page, { gameId: GAME.gameId, profileId: CHILD }))!);
  expect(stored.schemaVersion).toBe(STATE_VERSION);
}

test('a save from state version 1 opens its round in flight without the old hint and plays on', async ({
  page,
}) => {
  test.setTimeout(240_000);
  expect(STATE_VERSION, 'this check reads version 1 saves').toBeGreaterThan(1);
  const flight = await roundInFlight();
  await page.goto('./');
  await ready(page, 'title');
  await storeRecord(
    page,
    FAMILY_KEY,
    await familyPayload({ profiles: [{ id: CHILD, ...DIVER }], grownUpsLanguage: 'cs' }),
  );
  await storeRecord(
    page,
    { gameId: GAME.gameId, profileId: CHILD },
    await versionOne(flight.snapshot),
  );
  await page.reload();
  await ready(page, 'title');
  await resumesWithoutTheHint(page, flight);
});

test('a backup from state version 1 loads in Pro dospělé and plays on the same way', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const flight = await roundInFlight();
  const backup = createBackup(DIVER, await versionOne(flight.snapshot), undefined);
  await page.goto('./');
  await ready(page, 'title');
  await storeRecord(
    page,
    FAMILY_KEY,
    await familyPayload({ profiles: [{ id: CHILD, ...DIVER }], grownUpsLanguage: 'cs' }),
  );
  await page.reload();
  await ready(page, 'title');
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-data').click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByTestId(`backup-import-${CHILD}`).click();
  await (
    await choosing
  ).setFiles({ name: 'ema.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('toast')).toHaveAttribute('data-tone', 'success');
  await page.goto('./');
  await ready(page, 'title');
  await resumesWithoutTheHint(page, flight);
});
