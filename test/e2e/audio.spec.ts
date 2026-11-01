/**
 * Music and the victory sting (docs/app.md §9, plan §6 and §10): the first tap unlocks audio,
 * each screen's mood plays its loop (the grotto's, the lessons' practice loop, the battle's), and
 * freeing a monster stops the music for the 9-second victory sting before the music comes back.
 * Decoded audio stays within the manifest's own budget, all of it mono.
 *
 * The page's Web Audio is watched from outside (support/audio.ts): every context, decoded buffer
 * and buffer source, each sound known by its length in S5's manifest.
 *
 * PS-QA-02 (open): the SDK refuses the pack's sound IDs, so no audio context is ever made and the
 * game is silent. While it reproduces, each test records it and stops there.
 */
import type { Page, TestInfo } from '@playwright/test';
import {
  AUDIO_MANIFEST,
  audioLog,
  audioProbe,
  manifestSound,
  soundOf,
  startedSounds,
} from './support/audio';
import { expect, test } from './support/fixtures';
import { answerStep, lagoonPlayed, leaveScreen, playRound, throughStory } from './support/game';
import { unlessKnown } from './support/known-issues';
import { boot, CHILD, openLevel, seedFamily } from './support/tour';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(audioProbe);
});

/**
 * After the first taps: the music has started, or the engine said it cannot decode the pack.
 * False when there is nothing more to check (no audio at all, or no decoder).
 */
async function musicStarted(page: Page, testInfo: TestInfo): Promise<boolean> {
  let unlocked = false;
  await unlessKnown(testInfo, 'PS-QA-02', async () => {
    await expect
      .poll(async () => (await audioLog(page)).contexts, {
        message: 'the first tap unlocks audio (an audio context is made)',
        timeout: 5_000,
      })
      .toBeGreaterThan(0);
    unlocked = true;
  });
  if (!unlocked) return false;
  await expect
    .poll(
      async () => {
        const log = await audioLog(page);
        return log.started.length > 0 || log.failed.length > 0;
      },
      { message: 'the music starts or cannot be decoded', timeout: 20_000 },
    )
    .toBe(true);
  const log = await audioLog(page);
  if (log.started.length === 0) {
    // An engine without an Ogg Vorbis decoder (iPadOS before 18.4; Playwright's WebKit on
    // Windows) keeps the game silent, and the game must still work: the walks prove it does.
    testInfo.annotations.push({
      type: 'engine limitation',
      description: `this engine cannot decode the Ogg Vorbis pack (${log.failed[0]}); the game stays silent`,
    });
    return false;
  }
  return true;
}

test('each mood plays its loop, and freeing Muréna plays the victory sting between them', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await seedFamily(page, await lagoonPlayed());
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  if (!(await musicStarted(page, testInfo))) return;
  await expect
    .poll(() => startedSounds(page), { message: 'the grotto’s loop plays' })
    .toContain('music/grotto');

  await openLevel(page, 'sunny-lagoon.monster');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await expect
    .poll(() => startedSounds(page), { message: 'the battle has its own loop' })
    .toContain('music/battle');
  const battle = (await audioLog(page)).started.find(
    (played) => soundOf(played.duration) === 'music/battle',
  )!;
  expect(battle.loop, 'the battle music loops').toBe(true);

  await answerStep(page, CHILD);
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(page.getByTestId('moment-freed')).toBeVisible();
  await expect
    .poll(() => startedSounds(page), { message: 'the victory sting plays when she is freed' })
    .toContain('sfx/victory-sting');
  const log = await audioLog(page);
  const sting = log.started.find((played) => soundOf(played.duration) === 'sfx/victory-sting')!;
  expect(sting.loop, 'the sting is a one-shot').toBe(false);
  const lastLoop = log.started.filter((played) => played.loop && played.at <= sting.at).at(-1)!;
  expect(
    log.stopped.some(
      (stopped) => stopped.loop && stopped.at >= lastLoop.at && stopped.at <= sting.at,
    ),
    'the music stops before the sting starts',
  ).toBe(true);

  // Silent until the sting has ended, then the music the screen asks for comes back.
  const length = manifestSound('sfx/victory-sting').durationSeconds * 1000;
  await expect
    .poll(
      async () =>
        (await audioLog(page)).started.some((played) => played.loop && played.at > sting.at),
      { message: 'the music comes back after the sting', timeout: length + 10_000 },
    )
    .toBe(true);
  const back = (await audioLog(page)).started.find(
    (played) => played.loop && played.at > sting.at,
  )!;
  expect(back.at - sting.at, 'no music while the sting plays').toBeGreaterThanOrEqual(length - 250);
  expect(soundOf(back.duration), 'the results play the grotto’s loop').toBe('music/grotto');
});

test('lessons play the practice loop, and decoded audio stays mono and within its budget', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.getByTestId('title-play').click();
  await page.getByTestId('diver-name').fill('Ema');
  await page.getByTestId('avatar-diver-2').click();
  await page.getByTestId('grade-3').click();
  await leaveScreen(page, 'screen-editor', () => page.getByTestId('diver-save').click());
  expect(await throughStory(page)).toBe('screen-eggs');
  await page.getByTestId('egg-krab-tvrdak').click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await throughStory(page)).toBe('screen-board');
  if (!(await musicStarted(page, testInfo))) return;
  await expect
    .poll(() => startedSounds(page), { message: 'a lesson plays the practice loop' })
    .toContain('music/practice');
  const log = await audioLog(page);
  const bytes = log.decoded.reduce((sum, buffer) => sum + buffer.bytes, 0);
  testInfo.annotations.push({
    type: 'performance',
    description: `decoded audio after the grotto and a lesson: ${(bytes / 1_048_576).toFixed(1)} MiB in ${log.decoded.length} buffers (budget ${(AUDIO_MANIFEST.decoded.budgetBytes / 1_048_576).toFixed(0)} MiB for the whole pack)`,
  });
  expect(bytes, 'decoded audio').toBeLessThanOrEqual(AUDIO_MANIFEST.decoded.budgetBytes);
  for (const buffer of log.decoded) {
    expect(buffer.channels, `${soundOf(buffer.duration)} is mono`).toBe(1);
  }
});
