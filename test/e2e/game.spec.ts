/**
 * The game in a real browser, played the way a child plays it: every tap and key on screen, every
 * step saved before the game moves on. Three journeys through the slice:
 *
 * - a new 3rd grader: the editor, the prologue, the first egg, the grotto and the whole first
 *   lesson of Slunná laguna (Perlový náhrdelník, Rybářské sítě, Krmení), with a slip on a board,
 *   a wrong answer that shows the right one, a reload that resumes the same step, Osmička cheering
 *   beside the results, and the friend hatching;
 * - a new 4th grader: the placement check (Osmička cheering a right answer), then Slovní rodinka
 *   and Ulita slov in Měsíční jeskyně, the 4th grade's first lesson;
 * - a 3rd grader who has played every lesson of the lagoon (seeded from S2's trace player): the
 *   battle with Muréna Mumla (the ink meter, her jokes, an ink blot to wipe), her freeing, the
 *   friends' gallery and her diploma in the grown-ups' area; and the same child at Pexeso, which
 *   names what makes a pair and waits for two cards that are no pair to be turned back.
 *
 * Every new screen passes axe's WCAG 2.1 A and AA rules, with less motion as a family that asks
 * for it sees the game. No errors, no failed requests, nothing sent to another origin.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import {
  arrangeBoard,
  boardOnScreen,
  checkBoard,
  createChild,
  dragFish,
  give,
  fourthGraderPlaced,
  lagoonPlayed,
  leaveScreen,
  PACK,
  movedOn,
  playRound,
  problemOnScreen,
  seedChild,
  shownScreen,
  solveBoards,
  throughResults,
  throughStory,
  turnPair,
  wrongAnswer,
  answerStep,
} from './support/game';
import { ART, GUIDE_ID } from '../../src/rules/contract';
import { observe } from './support/observe';
import { FAMILY_KEY, familyPayload, storeRecord } from './support/saves';
import type { Observations } from './support/observe';
import { enterGrownUps, noViolations, ready } from './support/screens';
import { fetchedSound, soundAfterFirstTap, soundFiles } from './support/sound';

test.use({ reducedMotion: 'reduce' });

/** The files of the grotto's music loop and the victory sting (S5's pack, docs/audio.md). */
const GROTTO_LOOP = '/assets/audio/music/grotto.ogg';
const VICTORY_STING = '/assets/audio/sfx/victory-sting.ogg';

/** The first child made in a new family gets the first slot. */
const CHILD = 'profile-1';

/** The child's Czech lines, as the screens show them (no-break spaces aside). */
const CS: Readonly<Record<string, string>> = JSON.parse(
  readFileSync(new URL('../../content/catalogs/cs.ui.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const shown = (text: string | null): string => (text ?? '').replace(/\u00a0/g, ' ');

function nothingWentWrong(seen: Observations): void {
  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
}

/** From the story after the egg's choice on to the grotto. */
async function chooseEgg(page: Page, egg?: string): Promise<void> {
  expect(await throughStory(page)).toBe('screen-eggs');
  await noViolations(page, 'the eggs');
  const choice = egg
    ? page.getByTestId(`egg-${egg}`)
    : page.locator('[data-testid^="egg-"]').first();
  await choice.click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
}

/** Start recording toasts; the returned function gives the texts of those shown since. */
async function recordToasts(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const scope = globalThis as { psToasts?: string[] };
    scope.psToasts = [];
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.matches('[data-testid="toast"]')) {
            scope.psToasts!.push(node.textContent ?? '');
          }
        }
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
  return () => page.evaluate(() => (globalThis as { psToasts?: string[] }).psToasts ?? []);
}

/**
 * Nápověda tapped twice on the first step that has a hint: the hint shows, the second tap only
 * shows it again (the rules take one hint a problem), and nothing complains. Then that step is
 * answered right.
 */
async function hintTwice(page: Page): Promise<void> {
  for (let guard = 0; guard < 10; guard++) {
    const hint = page.getByTestId('round-hint');
    if ((await hint.count()) === 0) {
      await answerStep(page, CHILD);
      continue;
    }
    const toasts = await recordToasts(page);
    await hint.click();
    await expect(page.getByTestId('hint-text')).toBeVisible();
    await hint.click();
    await expect(page.getByTestId('hint-text')).toBeVisible();
    await answerStep(page, CHILD);
    expect(await toasts(), 'toasts after a second tap on Nápověda').toEqual([]);
    return;
  }
  throw new Error('no step of the round has a hint');
}

/** Dnešní výprava: whatever the game has for today, past any story beat. */
async function goAdventuring(page: Page): Promise<string> {
  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  return throughStory(page);
}

test('a new 3rd grader dives in and hatches the first friend in Slunná laguna', async ({
  page,
  baseURL,
  browserName,
}) => {
  test.setTimeout(300_000);
  const seen = observe(page, new URL(baseURL!).origin);
  const sounds = soundFiles(page);
  await page.goto('./');
  await ready(page, 'title');
  // The first tap starts the sound: the grotto's loop is fetched for the title and the editor.
  await page.getByTestId('title-play').click();
  if ((await soundAfterFirstTap(page, browserName)) === 'ready') {
    await fetchedSound(sounds, GROTTO_LOOP);
  }
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await noViolations(page, 'the editor');
  await page.getByTestId('back').click();
  await ready(page, 'title');

  // "Ponořit se!" says "Chvilku…" while the first save and the game load (a moment on a first
  // visit); a mutation record keeps it, however quickly the game opens.
  await page.evaluate(() => {
    const scope = globalThis as { psBusy?: string[] };
    scope.psBusy = [];
    new MutationObserver(() => {
      const save = document.querySelector<HTMLElement>('[data-testid="diver-save"]');
      if (save?.dataset['busy'] === 'true') {
        scope.psBusy!.push(`${save.textContent} (${save.getAttribute('aria-disabled')})`);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
  expect(await page.evaluate(() => (globalThis as { psBusy?: string[] }).psBusy)).toContain(
    'Chvilku… (true)',
  );
  expect(await shownScreen(page)).toBe('screen-story');
  await expect(page.getByTestId('story-line')).not.toBeEmpty();
  await noViolations(page, 'the prologue');
  await chooseEgg(page, 'krab-tvrdak');

  await expect(page.getByTestId('hub-greeting')).toHaveText('Ahoj! Kam se dnes ponoříme?');
  await expect(page.getByTestId('hub-diver').locator('.ps-hub__diver-name')).toHaveText('Ema');
  await expect(page.getByTestId('hub-featured')).toHaveAttribute('data-friend', 'krab-tvrdak');
  await expect(page.getByTestId('hub-featured')).toHaveAttribute('data-stage', 'egg');
  await noViolations(page, 'the grotto');

  // Perlový náhrdelník: a check before the pearls are in order says so, and nothing is lost.
  expect(await goAdventuring(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'pearl-necklace');
  await noViolations(page, 'Perlový náhrdelník');
  const necklace = await boardOnScreen(page, CHILD);
  if (necklace.kind !== 'pearl-necklace') throw new Error(`a ${necklace.kind} board`);
  await page.getByTestId('board-submit').click();
  const message = page.getByTestId('board-message');
  await expect(message).toHaveText(
    /^(Ještě ne\. Zkus pořadí opravit\.|Hotovo! Jde se na další\.)$/,
  );
  if ((await message.textContent())!.startsWith('Ještě ne')) {
    await arrangeBoard(page, necklace);
    await checkBoard(page);
  }
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  // Osmička cheers beside the results of a finished round.
  const guide = page.getByTestId('results-guide');
  await expect(guide).toHaveAttribute('data-expression', 'happy');
  await expect(guide.locator(`[data-art-id="${ART.character(GUIDE_ID, 'happy')}"]`)).toBeVisible();
  await noViolations(page, 'the results of a board round');
  await throughResults(page);

  // Rybářské sítě, the first board's fish dragged onto their nets: with less motion too, each
  // lands in the net it is dropped on (PS-QA-09).
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'fishing-nets');
  await noViolations(page, 'Rybářské sítě');
  await dragFish(page, await boardOnScreen(page, CHILD));
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);

  // Krmení: one right, one wrong (the right one is shown), then a reload resumes the same step.
  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'feeding');
  await noViolations(page, 'Krmení');
  await hintTwice(page);
  const asked = await problemOnScreen(page, CHILD);
  await give(page, asked, wrongAnswer(asked));
  const feedback = page.getByTestId('feedback');
  await expect(feedback).toHaveAttribute('data-kind', 'miss');
  await expect(feedback).toContainText('Skoro!');
  await expect(feedback).toContainText('Správně je:');
  await noViolations(page, 'a wrong answer');
  await page.getByTestId('round-next').click();
  await movedOn(page, asked);

  const before = await problemOnScreen(page, CHILD);
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await noViolations(page, 'the divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await shownScreen(page)).toBe('screen-round');
  const after = await problemOnScreen(page, CHILD);
  expect([after.index, after.step, after.item]).toEqual([before.index, before.step, before.item]);

  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  const hatch = page.getByTestId('moment-hatch');
  await expect(hatch).toContainText('Hurá! Vajíčko se vylíhlo: Krab Tvrďák!');
  await noViolations(page, 'the friend hatching');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');
  await expect(page.getByTestId('hub-featured')).toHaveAttribute('data-stage', 'baby');
  nothingWentWrong(seen);
});

test('a new 4th grader takes the placement check, then plays Slovní rodinka and Ulita slov', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const seen = observe(page, new URL(baseURL!).origin);
  await page.goto('./');
  await ready(page, 'title');
  await createChild(page, { name: 'Tomáš', avatar: 'diver-5', address: 'boy', grade: 4 });
  await chooseEgg(page);

  // The placement check: a child who does not know yet starts at the 4th grade's beginning.
  await expect(page.getByTestId('adventure-next')).not.toBeEmpty();
  expect(await goAdventuring(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-placement', 'true');
  // The check counts its parts, not problems.
  await expect(page.getByTestId('round-progress')).toContainText('Části');
  await noViolations(page, 'the placement check');
  // Osmička keeps the child company: she cheers a right answer until the next miss. One right
  // answer of a step's three passes no step, so the child still starts at the beginning.
  const osmicka = page.getByTestId('round-friend');
  await expect(osmicka).toHaveAttribute('data-expression', 'idle');
  await answerStep(page, CHILD);
  await expect(osmicka).toHaveAttribute('data-expression', 'happy');
  await expect(
    osmicka.locator(`[data-art-id="${ART.character(GUIDE_ID, 'happy')}"]`),
  ).toBeVisible();
  await answerStep(page, CHILD, false);
  await expect(osmicka).toHaveAttribute('data-expression', 'idle');
  for (let guard = 0; guard < 20 && (await shownScreen(page)) === 'screen-round'; guard++) {
    await answerStep(page, CHILD, false);
  }
  expect(await shownScreen(page)).toBe('screen-results');
  // The check is no score for the child: its results thank them instead.
  await expect(page.getByTestId('results-placement')).toHaveText(
    'Díky! Osmička teď ví, kde začneš.',
  );
  await expect(page.getByTestId('results-score')).toHaveCount(0);
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');

  // Měsíční jeskyně 1: Slovní rodinka first. A check with words missing says so.
  expect(await goAdventuring(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-family');
  await expect(page.getByTestId('family-count')).toContainText('Vybraná slova: 0 /');
  await noViolations(page, 'Slovní rodinka');
  await page.getByTestId('board-submit').click();
  await expect(page.getByTestId('board-message')).toHaveText(
    'Ještě ne. Která slova jsou příbuzná?',
  );
  // Quick taps all count: a tap made while the one before is saving waits for it.
  const family = await boardOnScreen(page, CHILD);
  if (family.kind !== 'word-family') throw new Error(`a ${family.kind} board`);
  const members = family.words
    .filter(
      (entry) =>
        PACK.data.lexicon.words.find((word) => word.id === entry.word)?.family?.id ===
        family.family,
    )
    .map((entry) => entry.id);
  await page.evaluate((ids) => {
    for (const id of ids) {
      document.querySelector<HTMLButtonElement>(`[data-testid="family-${id}"]`)!.click();
    }
  }, members);
  for (const id of members) {
    await expect(page.getByTestId(`family-${id}`)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.getByTestId('family-count')).toContainText(`${members.length} / `);
  await noViolations(page, 'Slovní rodinka with words picked');
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);

  // Ulita slov: the word is cut and its parts named.
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-shell');
  await noViolations(page, 'Ulita slov');
  // Every cut between two letters is a whole 48 px target (PS-QA-01).
  const cuts = await page.locator('[data-testid^="cut-"]').evaluateAll((all) =>
    all.map((cut) => {
      const box = cut.getBoundingClientRect();
      return Math.min(box.width, box.height);
    }),
  );
  expect(cuts.length).toBeGreaterThan(0);
  expect(Math.min(...cuts)).toBeGreaterThanOrEqual(48);
  await page.getByTestId('board-submit').click();
  await expect(page.getByTestId('board-message')).toHaveText('Ještě ne. Zkus části opravit.');
  const shell = await boardOnScreen(page, CHILD);
  await arrangeBoard(page, shell);
  await noViolations(page, 'Ulita slov with the word cut');
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'feeding');
  nothingWentWrong(seen);
});

test('Muréna Mumla is washed clean, joins the gallery and earns a diploma', async ({
  page,
  baseURL,
  browserName,
}) => {
  test.setTimeout(300_000);
  const seen = observe(page, new URL(baseURL!).origin);
  const sounds = soundFiles(page);
  const lagoon = await lagoonPlayed();
  await page.goto('./');
  await ready(page, 'title');
  await seedChild(page, { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' }, lagoon);
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  const sound = await soundAfterFirstTap(page, browserName);
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');

  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await noViolations(page, 'the sea map');
  await page.getByTestId('region-sunny-lagoon').click();
  await ready(page, 'region');
  await noViolations(page, 'Slunná laguna');
  await page.getByTestId('level-sunny-lagoon.monster').click();
  await ready(page, 'level');
  await noViolations(page, 'the monster’s level');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());

  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'battle');
  await expect(page.getByTestId('battle-monster')).toHaveAttribute('data-monster', 'murena-mumla');
  await expect(page.getByTestId('monster-joke')).not.toBeEmpty();
  await noViolations(page, 'the battle');

  // The ink meter fills with every right answer; now and then she splashes a blot to wipe away.
  const meter = page.getByTestId('round-progress');
  for (let guard = 0; guard < 30 && (await page.getByTestId('ink-splash').count()) === 0; guard++) {
    await answerStep(page, CHILD);
  }
  const blot = page.getByTestId('ink-splash').first();
  await expect(blot).toBeVisible();
  await expect(meter).not.toHaveAttribute('aria-valuenow', '0');
  await noViolations(page, 'the battle with an ink blot');
  const blots = await page.getByTestId('ink-splash').count();
  await blot.click();
  await expect(page.getByTestId('ink-splash')).toHaveCount(blots - 1);

  // Washed clean: her freeing beat, then the results, with the victory sting.
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  const freed = page.getByTestId('moment-freed');
  await expect(freed).toContainText('Inkoust je smytý! Muréna Mumla se usmívá.');
  if (sound === 'ready') await fetchedSound(sounds, VICTORY_STING);
  await expect(page.getByTestId('moment-joke')).not.toBeEmpty();
  await noViolations(page, 'the freeing');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');

  await page.getByTestId('place-gallery').click();
  await expect(page.getByTestId('screen-gallery')).toBeVisible();
  await expect(page.getByTestId('gallery-murena-mumla')).toHaveAttribute('data-freed', 'true');
  await noViolations(page, 'the friends’ gallery');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await page.getByTestId('hub-goodbye').click();
  await expect(page.getByTestId('screen-goodbye')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dnešní ponor končí.');
  await noViolations(page, 'goodbye');
  await page.getByTestId('goodbye-bye').click();
  await ready(page, 'title');

  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-progress').click();
  // The 3rd grader's goals are open; the 4th grade's wait folded, so the tab stays short.
  await expect(
    page.getByTestId('progress-goals-3').locator('[data-testid^="goal-"]').first(),
  ).toBeVisible();
  await expect(
    page.getByTestId('progress-goals-4').locator('[data-testid^="goal-"]').first(),
  ).toBeHidden();
  await noViolations(page, 'the grown-ups’ progress');
  await page.getByTestId('diploma-murena-mumla').click();
  await ready(page, 'print');
  await expect(page.getByTestId('print-sheet')).toContainText(
    'Za odvahu v souboji s příšerou: Muréna Mumla.',
  );
  await noViolations(page, 'the diploma');
  nothingWentWrong(seen);
});

test('Pexeso says what makes a pair, and two cards that are no pair are turned back', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const seen = observe(page, new URL(baseURL!).origin);
  const lagoon = await lagoonPlayed();
  await page.goto('./');
  await ready(page, 'title');
  await seedChild(page, { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' }, lagoon);
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await page.getByTestId('region-sunny-lagoon').click();
  await ready(page, 'region');
  await page.getByTestId('level-sunny-lagoon.5').click();
  await ready(page, 'level');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());

  // Slunná laguna 5: Krmení, then Pexeso.
  expect(await throughStory(page)).toBe('screen-round');
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'memory-match');
  const board = await boardOnScreen(page, CHILD);
  if (board.kind !== 'memory-match') throw new Error(`a ${board.kind} board`);
  // The board says what makes a pair (PS-QA-06), as the other boards say their task.
  expect(shown(await page.getByTestId('board-task').textContent())).toBe(
    CS[`board.pairTask.${board.pair}`],
  );
  await noViolations(page, 'Pexeso');

  // Two cards that are no pair stay up, with no timer, until the child turns them back.
  const open = page.locator('[data-testid="board"] [data-testid^="card-"][data-matched="false"]');
  for (let guard = 0; ; guard++) {
    if (guard >= board.pairs) throw new Error('no two cards turned were a mismatch');
    const [first, second] = await open.evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => card.getAttribute('data-testid')!),
    );
    if ((await turnPair(page, first!, second!)) === 'miss') break;
  }
  await expect(page.getByTestId('board-message')).toHaveText(CS['board.mismatch']!);
  await noViolations(page, 'Pexeso with two cards that are no pair');
  await page.getByTestId('board-clear').click();
  await expect(page.getByTestId('board-clear')).toHaveCount(0);
  await expect(
    page.locator('[data-testid="board"] [data-up="true"][data-matched="false"]'),
  ).toHaveCount(0);
  nothingWentWrong(seen);
});

test('a second window on the same child says the game is open there, and reopens it', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const origin = new URL(baseURL!).origin;
  const seen = observe(page, origin);
  await page.goto('./');
  await ready(page, 'title');
  await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
  await chooseEgg(page, 'krab-tvrdak');

  const second = await context.newPage();
  const seenSecond = observe(second, origin);
  await second.goto('./');
  await ready(second, 'title');
  await second.getByTestId('title-play').click();
  await ready(second, 'divers');
  await second.getByTestId(`diver-${CHILD}`).click();
  expect(await shownScreen(second)).toBe('screen-hub');

  // The first window plays on, so its save is newer than what the second window read.
  expect(await goAdventuring(page)).toBe('screen-board');

  // The second window starts the same level: the game takes it but must not save over the newer
  // save. The level's story beat shows that, with the way back to the saved game.
  await leaveScreen(second, 'screen-hub', () => second.getByTestId('adventure').click());
  expect(await shownScreen(second)).toBe('screen-story');
  await expect(second.getByTestId('save-status')).toHaveAttribute('data-state', 'conflict');
  await noViolations(second, 'a story beat in a second window');
  await second.getByTestId('save-reopen').click();
  expect(await throughStory(second)).toBe('screen-board');
  await expect(second.getByTestId('screen-board')).toHaveAttribute(
    'data-activity',
    'pearl-necklace',
  );

  nothingWentWrong(seen);
  nothingWentWrong(seenSecond);
});

test('a grown-up runs the placement check again, and leaving it is told kindly', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const seen = observe(page, new URL(baseURL!).origin);
  const placed = await fourthGraderPlaced();
  await page.goto('./');
  await ready(page, 'title');
  await seedChild(page, { id: CHILD, name: 'Tomáš', avatar: 'diver-5', address: 'boy' }, placed);
  await page.reload();
  await ready(page, 'title');

  // Pro dospělé: the check starts the next time the child plays; while it waits, not again.
  await enterGrownUps(page);
  const rerun = page.getByTestId('setting-placement');
  await expect(rerun).toHaveText('Spustit kontrolu znovu');
  await noViolations(page, 'a child’s game settings with the placement check');
  await rerun.click();
  await expect(page.getByTestId('toast')).toHaveText(
    'Kontrola se spustí, až dítě příště začne hrát.',
  );
  await page.getByTestId('setting-placement').click();
  await expect(page.getByTestId('toast').last()).toHaveText(
    'Teď to nejde: právě probíhá kolo nebo příběh. Zkuste to, až skončí.',
  );
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');

  // The child plays: the check comes first. Leaving it says what stays.
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await shownScreen(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-placement', 'true');
  // What the grown-ups' area said stays there.
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await page.getByTestId('round-pause').click();
  await expect(page.getByTestId('pause-body')).toHaveText(
    'Když teď odejdeš, kontrola skončí. Co už máš hotové, ti zůstane. ' +
      'Spustit ji znovu může dospělý v části Pro dospělé.',
  );
  await expect(page.getByTestId('pause-quit')).toHaveText('Skončit kontrolu');
  await noViolations(page, 'the pause dialog of the placement check');
  await leaveScreen(page, 'screen-round', () => page.getByTestId('pause-quit').click());
  if ((await shownScreen(page)) === 'screen-results') await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');
  await expect(page.getByTestId('adventure-next')).toContainText('Další úroveň');
  nothingWentWrong(seen);
});

test('the grade a grown-up chooses before the first dive is the grade the child plays', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const seen = observe(page, new URL(baseURL!).origin);
  await page.goto('./');
  await ready(page, 'title');
  // The editor picked the 3rd grade, and the child's game has not opened yet.
  await storeRecord(
    page,
    FAMILY_KEY,
    await familyPayload({
      profiles: [{ id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 }],
      grownUpsLanguage: 'cs',
    }),
  );
  await page.reload();
  await ready(page, 'title');
  await enterGrownUps(page);
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('setting-grade-4').click();
  await expect(page.getByTestId('setting-grade-4')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');

  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  await chooseEgg(page);
  // A 4th grader's adventure begins with the placement check.
  await expect(page.getByTestId('adventure-next')).toHaveText('Ukaž, co umíš!');
  nothingWentWrong(seen);
});
