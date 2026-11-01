/**
 * Read-aloud with the device's own Czech voices (docs/app.md §10, plan §0): a stand-in speech
 * engine (support/speech.ts) offers local and remote voices and records what would be spoken.
 *
 * - Only a local Czech voice is ever used (`localService`, a `cs` language), even when the
 *   browser's default voice is a remote "natural" one: Zuzana on an iPad, at a calm 0.9.
 * - The words follow the screen: a story line as written, a problem as its prompt and the word
 *   with the gap said as a pause, never its spelling.
 * - Auto-read speaks each new problem; pausing stops the voice.
 * - With no local Czech voice the speaker buttons are hidden, nothing is spoken, and the
 *   grown-ups' area says why and how to add one.
 */
import { expect, test } from './support/fixtures';
import { levelsPlayed, problemOnScreen, throughStory } from './support/game';
import { enterGrownUps, ready } from './support/screens';
import {
  installSpeech,
  NO_LOCAL_CZECH,
  publishVoices,
  REMOTE_CZECH,
  speechLog,
  spokenTexts,
  TYPICAL_VOICES,
  ZUZANA,
} from './support/speech';
import { boot, CHILD, goAdventuring, seedFamily } from './support/tour';
import type { Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

/**
 * A diver who played the lagoon's first lesson comes back another day: Dnešní výprava starts a
 * problem round (Svačinka first, as the friends are hungry).
 */
async function onAProblem(page: Page): Promise<void> {
  await seedFamily(page, await levelsPlayed(['sunny-lagoon.1'], 'e2e-read-aloud'));
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  expect(await goAdventuring(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute(
    'data-activity',
    /^(feeding|snack)$/,
  );
}

/** The written problem on screen: its prompt, and the word with its gap as "…". */
async function writtenProblem(page: Page): Promise<{ prompt: string; word: string }> {
  const view = await problemOnScreen(page, CHILD);
  const prompt = (await page.getByTestId('problem-prompt').textContent())!.trim();
  if (view.problem.kind !== 'gaps') throw new Error(`a ${view.problem.kind} problem`);
  return { prompt, word: (await page.getByTestId('problem-text').textContent())!.trim() };
}

test.describe('with Zuzana on the device', () => {
  test.beforeEach(async ({ context }) => {
    await installSpeech(context, TYPICAL_VOICES);
  });

  test('the story and a problem are read with the local Czech voice only, calmly', async ({
    page,
  }) => {
    await boot(page);
    await page.getByTestId('title-play').click();
    await page.getByTestId('diver-name').fill('Ema');
    await page.getByTestId('avatar-diver-2').click();
    await page.getByTestId('address-girl').click();
    await page.getByTestId('grade-3').click();
    await page.getByTestId('diver-save').click();
    await expect(page.getByTestId('screen-story')).toBeVisible();
    const line = (await page.getByTestId('story-line').textContent())!;
    const before = (await speechLog(page)).spoken.length;
    await page.getByTestId('story-read').click();
    await expect.poll(async () => (await spokenTexts(page)).slice(before)).toEqual([line]);
    for (const spoken of (await speechLog(page)).spoken) {
      expect(spoken.voiceURI, `never the remote default voice: ${spoken.text}`).toBe(
        ZUZANA.voiceURI,
      );
      expect(spoken.voiceLocal).toBe(true);
      expect(spoken.lang).toBe('cs-CZ');
      expect(spoken.rate, 'a calm pace for 8-10-year-olds').toBe(0.9);
    }

    await onAProblem(page);
    const { prompt } = await writtenProblem(page);
    const view = await problemOnScreen(page, CHILD);
    const said = (await speechLog(page)).spoken.length;
    await page.getByTestId('read-aloud').click();
    await expect.poll(async () => (await speechLog(page)).spoken.length).toBe(said + 1);
    const spoken = (await speechLog(page)).spoken.at(-1)!;
    expect(spoken.voiceURI).toBe(ZUZANA.voiceURI);
    expect(spoken.text.startsWith(prompt), `"${spoken.text}" starts with "${prompt}"`).toBe(true);
    if (view.problem.kind === 'gaps') {
      const gap = view.problem.gaps[view.step]!.correct;
      const whole = view.problem.parts
        .map((part) => (part.kind === 'text' ? part.text : gap))
        .join('');
      expect(spoken.text, 'the gap is a pause').toContain('…');
      expect(spoken.text, `the answer is never read out: ${whole}`).not.toContain(whole);
    }
    expect(
      (await speechLog(page)).spoken.every((line) => line.voiceURI !== REMOTE_CZECH.voiceURI),
    ).toBe(true);
  });

  test('auto-read speaks each new problem, and pausing stops the voice', async ({ page }) => {
    await seedFamily(page, await levelsPlayed(['sunny-lagoon.1'], 'e2e-auto-read'));
    await enterGrownUps(page);
    await page.getByTestId('setting-auto-read').click();
    await expect(page.getByTestId('setting-auto-read')).toBeChecked();
    await page.getByTestId('grownups-close').click();
    await ready(page, 'title');
    await page.getByTestId('title-play').click();
    await page.getByTestId(`diver-${CHILD}`).click();
    expect(await throughStory(page)).toBe('screen-hub');
    expect(await goAdventuring(page)).toBe('screen-round');
    const first = await writtenProblem(page);
    await expect
      .poll(async () => (await spokenTexts(page)).at(-1) ?? '', {
        message: 'the first problem is read without a tap',
      })
      .toContain(first.prompt);
    const cancels = (await speechLog(page)).cancels;
    await page.getByTestId('round-pause').click();
    await expect(page.getByTestId('pause-dialog')).toBeVisible();
    expect((await speechLog(page)).cancels, 'pausing silences the voice').toBeGreaterThan(cancels);
  });
});

test.describe('without a local Czech voice', () => {
  test.beforeEach(async ({ context }) => {
    await installSpeech(context, NO_LOCAL_CZECH);
  });

  test('the speakers are hidden, nothing is spoken, and the grown-ups’ area says why', async ({
    page,
  }) => {
    await onAProblem(page);
    await expect(page.getByTestId('problem')).toBeVisible();
    await expect(page.getByTestId('read-aloud'), 'no remote voice, no English voice').toHaveCount(
      0,
    );
    expect((await speechLog(page)).spoken).toEqual([]);
    await page.goto('./');
    await enterGrownUps(page);
    await expect(page.getByTestId('voice-none')).toContainText(
      'Toto zařízení nemá český hlas, který běží přímo v něm.',
    );
    await expect(page.getByTestId('setting-voice')).toHaveCount(0);
    await expect(page.getByTestId('grownups-voice')).toContainText('Zuzana');
    expect((await speechLog(page)).spoken).toEqual([]);
  });

  test('a Czech voice that arrives late is offered in the grown-ups’ area at once', async ({
    page,
  }) => {
    await seedFamily(page, await levelsPlayed([], 'e2e-late-voice'));
    await enterGrownUps(page);
    await expect(page.getByTestId('voice-none')).toBeVisible();
    await publishVoices(page, TYPICAL_VOICES);
    await expect(page.getByTestId('voice-available')).toBeVisible();
    await expect(page.getByTestId('setting-voice')).toContainText('Zuzana');
  });
});
