/**
 * Osmička's lesson, "Jak na to?" (docs/design.md §5.3): a child who meets a level's material
 * before school has taught it opens the lesson on the level's intro, over the level's board and
 * over its round, hears it read aloud, and goes on exactly where the game was. A monster's battle
 * gathers its region's lessons; Svačinka, which reviews many levels at once, has none.
 *
 * What the lesson must show comes from the content catalog as written (`lesson.<level>.<n>`, docs
 * /contract.md §7.4), so a line the shell drops, reorders or puts under the wrong level is caught.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  LAGOON_LESSONS,
  answerStep,
  lagoonPlayed,
  leaveScreen,
  levelsPlayed,
  problemOnScreen,
  solveBoards,
  throughResults,
  throughStory,
} from './support/game';
import { noViolations } from './support/screens';
import { installSpeech, spokenTexts, TYPICAL_VOICES } from './support/speech';
import { CHILD, goAdventuring, openLevel, seedFamily, untilHub } from './support/tour';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ context }) => {
  await installSpeech(context, TYPICAL_VOICES);
});

/** The Czech content lines as the catalog writes them. */
const CONTENT = JSON.parse(
  readFileSync(new URL('../../content/catalogs/cs.content.json', import.meta.url), 'utf8'),
) as Record<string, string>;

interface ShownSection {
  readonly level: string;
  readonly title: string;
  readonly lines: readonly string[];
}

/** A lesson level's lesson as the catalog writes it, under its level's title. */
function written(level: string): ShownSection {
  const lines: string[] = [];
  for (let line = 1; CONTENT[`lesson.${level}.${line}`] !== undefined; line++) {
    lines.push(CONTENT[`lesson.${level}.${line}`]!);
  }
  return { level, title: CONTENT[`level.${level}`]!, lines };
}

/**
 * The lesson on screen, section by section, its typesetting undone: the no-break space after a
 * one-letter word and the non-breaking hyphen of an ending are the catalog's plain characters.
 */
async function shownLesson(page: Page): Promise<ShownSection[]> {
  return page
    .getByTestId('lesson-text')
    .locator('section')
    .evaluateAll((sections) => {
      const plain = (text: string | null): string =>
        (text ?? '').replace(/\u00a0/g, ' ').replace(/\u2011/g, '-');
      return sections.map((section) => ({
        level: (section as HTMLElement).dataset['level'] ?? '',
        title: plain(section.querySelector('h3')?.textContent ?? null),
        lines: [...section.querySelectorAll('p')].map((line) => plain(line.textContent)),
      }));
    });
}

/** Open the child's game from the title, past any story, to the grotto. */
async function toGrotto(page: Page): Promise<void> {
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
}

test('Jak na to? teaches the listed words after B on the intro, over the necklace and Krmení', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await seedFamily(
    page,
    await levelsPlayed(
      [...LAGOON_LESSONS, 'sunny-lagoon.monster', 'coral-reef.1'],
      'e2e-lesson-reef',
    ),
  );
  await toGrotto(page);
  await openLevel(page, 'coral-reef.2');
  const lesson = page.getByTestId('lesson-dialog');
  const reef = [written('coral-reef.2')];

  // Before the level: Osmička explains the B rhyme, and reads it aloud with the device's voice.
  await page.getByTestId('level-lesson').click();
  await expect(lesson).toBeVisible();
  await expect(lesson.getByRole('heading', { level: 2 })).toHaveText('Osmička vysvětluje');
  expect(await shownLesson(page), 'the level’s lesson, line by line').toEqual(reef);
  await expect(
    page.getByTestId('lesson-text'),
    'the lesson takes the keyboard first, so it can be scrolled',
  ).toBeFocused();
  await noViolations(page, 'the lesson over the level’s intro');
  const before = (await spokenTexts(page)).length;
  await page.getByTestId('lesson-read').click();
  await expect.poll(async () => (await spokenTexts(page)).length).toBe(before + 1);
  const said = (await spokenTexts(page)).at(-1)!;
  expect(said, 'the lesson read aloud: its title, then the rhyme').toContain(
    'Vyjmenovaná slova po B. Vyjmenovaná slova po B: být, bydlit, obyvatel, byt,',
  );
  await page.keyboard.press('Escape');
  await expect(lesson, 'Escape closes the lesson').toHaveCount(0);
  await expect(page.getByTestId('screen-level')).toBeVisible();

  // The necklace asks for the rhyme: the lesson lies over the board, which waits as it was.
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'pearl-necklace');
  const board = await page.getByTestId('board').getAttribute('data-board');
  await page.getByTestId('board-lesson').click();
  await expect(lesson).toBeVisible();
  expect(await shownLesson(page), 'the same lesson over the necklace').toEqual(reef);
  await noViolations(page, 'the lesson over the necklace');
  await page.getByTestId('lesson-close').click();
  await expect(lesson).toHaveCount(0);
  await expect(page.getByTestId('board'), 'the necklace waits where it was').toHaveAttribute(
    'data-board',
    board!,
  );
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);

  // Krmení: the problem waits under the lesson for its answer.
  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'feeding');
  const asked = await problemOnScreen(page, CHILD);
  await page.getByTestId('round-lesson').click();
  await expect(lesson).toBeVisible();
  expect(await shownLesson(page), 'the same lesson over Krmení').toEqual(reef);
  await page.getByTestId('lesson-close').click();
  await expect(lesson).toHaveCount(0);
  const waiting = await problemOnScreen(page, CHILD);
  expect([waiting.index, waiting.step, waiting.item], 'the same step waits').toEqual([
    asked.index,
    asked.step,
    asked.item,
  ]);
  await answerStep(page, CHILD);
});

test('a monster’s Jak na to? gathers its region’s lessons, and Svačinka has none', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await seedFamily(page, await lagoonPlayed());
  await toGrotto(page);

  // A new day starts with Svačinka: it reviews many levels at once, so it has no lesson.
  expect(await goAdventuring(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'snack');
  await expect(page.getByTestId('round-pause')).toBeVisible();
  await expect(page.getByTestId('round-lesson'), 'no lesson in Svačinka').toHaveCount(0);
  await untilHub(page);

  // Muréna Mumla asks the whole lagoon: her lesson is the lagoon's lessons, in their order.
  const lagoon = LAGOON_LESSONS.map(written);
  await openLevel(page, 'sunny-lagoon.monster');
  await page.getByTestId('level-lesson').click();
  expect(await shownLesson(page), 'the lagoon’s lessons on the monster’s intro').toEqual(lagoon);
  await noViolations(page, 'a monster level’s lesson');
  await page.getByTestId('lesson-close').click();
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'battle');
  await page.getByTestId('round-lesson').click();
  expect(await shownLesson(page), 'the lagoon’s lessons in the battle').toEqual(lagoon);
  await page.getByTestId('lesson-close').click();
  await expect(page.getByTestId('lesson-dialog')).toHaveCount(0);
});
