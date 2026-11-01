/**
 * The child's screens fit a landscape tablet or laptop window (S6's PS-QA-04 and PS-QA-05, as
 * Dragon Valley's playtest checks): at 100 % text the page itself never scrolls, so every control
 * is in view. The sizes are tablets in landscape (1024 × 768; 1024 × 698, an iPad's under Safari's
 * bars; 1180 × 820; 1280 × 800) and laptop windows (1366 × 657, 1536 × 730). Each journey stops at
 * the tallest states a screen can reach: a hint and a miss at once (a rule's long hint too,
 * shoda's in Krakatičí propast), a battle's miss with an ink blot, an Inkoustík's ambush, the
 * placement check, every kind of board, the big moments, the results, and the grotto with today's
 * rewards to claim and the chest (S6's PS-QA-19). At 200 % text on a phone, a round and U Mrože
 * keep to the screen's width.
 */
import type { Page } from '@playwright/test';
import type { RuntimeSnapshot } from '@aegis/runtime';
import type { ProblemView } from '../../src/rules/contract';
import {
  GAME,
  PACK,
  SEED_DAY,
  answerStep,
  arrangeBoard,
  boardOnScreen,
  checkBoard,
  createChild,
  fourthGraderPlaced,
  give,
  lagoonPlayed,
  lagoonPlayedToday,
  leaveScreen,
  movedOn,
  pageDay,
  playRound,
  problemOnScreen,
  seedChild,
  shownScreen,
  solveBoards,
  throughResults,
  throughStory,
  turnPair,
  wrongAnswer,
} from './support/game';
import { expect, test } from './support/fixtures';
import { enterGrownUps, ready, resize } from './support/screens';
import { PERFECT, Player } from '../traces/support';

test.use({ reducedMotion: 'reduce' });

const LANDSCAPE = [
  { width: 1024, height: 768 },
  { width: 1024, height: 698 },
  { width: 1180, height: 820 },
  { width: 1280, height: 800 },
  { width: 1366, height: 657 },
  { width: 1536, height: 730 },
] as const;

const PHONE = { width: 390, height: 844 } as const;

const CHILD = 'profile-1';

/** Wait for the size just set to be laid out and painted. */
async function painted(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

interface Extent {
  readonly height: number;
  readonly width: number;
  readonly window: { readonly height: number; readonly width: number };
}

function extent(page: Page): Promise<Extent> {
  return page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    window: { height: window.innerHeight, width: document.documentElement.clientWidth },
  }));
}

/**
 * At each landscape size the page needs no scrolling either way (reported, the walk goes on).
 * Every engine carries a resize into the page's `dvh` styles a moment late, so a size is measured
 * once the page has followed it (`resize` in support/screens.ts).
 */
async function fits(page: Page, where: string): Promise<void> {
  for (const size of LANDSCAPE) {
    await resize(page, size.width, size.height);
    await painted(page);
    const seen = await extent(page);
    const at = `${where} at ${size.width} × ${size.height}`;
    expect.soft(seen.height, `${at} needs page scrolling`).toBeLessThanOrEqual(seen.window.height);
    expect.soft(seen.width, `${at} scrolls sideways`).toBeLessThanOrEqual(seen.window.width);
  }
  await resize(page, LANDSCAPE[0].width, LANDSCAPE[0].height);
  await painted(page);
}

/** The page keeps to the screen's width (reported, the walk goes on). */
async function keepsWidth(page: Page, where: string): Promise<void> {
  await painted(page);
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect.soft(scroll, `${where} scrolls sideways`).toBeLessThanOrEqual(width);
}

async function openChild(page: Page, snapshot: RuntimeSnapshot): Promise<void> {
  await page.goto('./');
  await ready(page, 'title');
  await seedChild(page, { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' }, snapshot);
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
}

async function toLevel(page: Page, level: string): Promise<void> {
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await page.getByTestId(`region-${level.split('.')[0]}`).click();
  await ready(page, 'region');
  await page.getByTestId(`level-${level}`).click();
  await ready(page, 'level');
}

/** The spelling rule a step's hint explains, if its hint is a rule's. */
function hintRule(view: ProblemView): string | null {
  const { problem, step } = view;
  const hint =
    problem.kind === 'gaps'
      ? problem.gaps[step]?.hint
      : problem.kind === 'mistake' && step === 1
        ? problem.fix.hint
        : null;
  return hint?.kind === 'rule' ? hint.rule : null;
}

/** An ending's hyphen (_-a_) a line could break after, leaving it alone at a line's end. */
const LOOSE_ENDING = /(^|[\s(„‚"'/\u00a0])-\p{L}/u;

/** A step answered wrong, its miss on screen with the right answer and "Dál". */
async function miss(page: Page): Promise<void> {
  const asked = await problemOnScreen(page, CHILD);
  await give(page, asked, wrongAnswer(asked));
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
}

/**
 * A 3rd grader past Muréna Mumla, in a lesson round whose problem on screen an Inkoustík ambushes:
 * played in Node, a step at a time, until one does.
 */
async function ambushed(): Promise<RuntimeSnapshot> {
  const player = new Player(PERFECT, 'e2e-ambush', GAME.adapter, GAME.content);
  try {
    await player.begin('krab-tvrdak', SEED_DAY);
    const levels = PACK.data.levels
      .filter((level) => level.region === 'sunny-lagoon')
      .sort((a, b) => a.order - b.order);
    for (const level of levels) await player.playLevel(level.id);
    for (let guard = 0; guard < 600; guard++) {
      const round = player.view().round;
      if (round?.type === 'problems' && round.status === 'active' && round.problem?.ambush) {
        return player.host.snapshot();
      }
      if (round?.type === 'problems' && round.status === 'active') {
        await player.answer();
      } else if (round !== null) {
        await player.act({ type: 'endRound', reason: 'done' });
        await player.settleStory();
      } else {
        await player.act({ type: 'startLevel', level: 'sunny-lagoon.2' });
        await player.settleStory();
      }
    }
    throw new Error(`no Inkoustík ambushed a problem: ${player.failures.join(', ')}`);
  } finally {
    await player.dispose();
  }
}

test('a new 3rd grader’s first lesson fits a landscape screen', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await page.goto('./');
  await ready(page, 'title');
  await fits(page, 'the title');
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await fits(page, 'the editor');
  await page.getByTestId('back').click();
  await ready(page, 'title');
  await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
  expect(await throughStory(page)).toBe('screen-eggs');
  await fits(page, 'the eggs');
  await page.locator('[data-testid^="egg-"]').first().click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await fits(page, 'the grotto with the first egg');

  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await throughStory(page)).toBe('screen-board');
  await fits(page, 'Perlový náhrdelník');
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await fits(page, 'the results of a board');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-board');
  await fits(page, 'Rybářské sítě');
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);

  expect(await throughStory(page)).toBe('screen-round');
  await fits(page, 'Krmení');
  for (let guard = 0; (await page.getByTestId('round-hint').count()) === 0; guard++) {
    if (guard >= 10) throw new Error('no step of Krmení has a hint');
    await answerStep(page, CHILD);
  }
  await page.getByTestId('round-hint').click();
  await expect(page.getByTestId('hint-text')).toBeVisible();
  await fits(page, 'Krmení with its hint');
  await miss(page);
  await fits(page, 'Krmení with a hint and a miss');
  await page.getByTestId('round-next').click();
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(page.getByTestId('moment-hatch')).toBeVisible();
  await fits(page, 'the friend hatching');
  await page.getByTestId('moment-next').click();
  await expect(page.getByTestId('results-card')).toBeVisible();
  await fits(page, 'the results after the hatching');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');
  await fits(page, 'the grotto with the first friend');
});

test('the grotto of a whole lagoon, the battle and the freeing fit a landscape screen', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await openChild(page, await lagoonPlayed());
  expect(await throughStory(page)).toBe('screen-hub');
  await fits(page, 'the grotto with friends and a monster to free');
  await toLevel(page, 'sunny-lagoon.monster');
  await fits(page, 'the monster’s level');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await fits(page, 'the battle');
  for (let guard = 0; (await page.getByTestId('ink-splash').count()) === 0; guard++) {
    if (guard >= 30) throw new Error('Muréna splashed no ink');
    await answerStep(page, CHILD);
  }
  await miss(page);
  await fits(page, 'the battle with an ink blot and a miss');
  await page.getByTestId('round-next').click();
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(page.getByTestId('moment-freed')).toBeVisible();
  await fits(page, 'the freeing');
  await page.getByTestId('moment-next').click();
  await expect(page.getByTestId('results-card')).toBeVisible();
  await fits(page, 'the results of the battle');
});

test('the grotto with today’s rewards to claim and the chest fits a landscape screen', async ({
  page,
}) => {
  // S6's PS-QA-19: three quests' coins to claim and the chest waiting made the grotto 20 px too
  // tall at 1024 × 768.
  test.setTimeout(240_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await page.goto('./');
  await ready(page, 'title');
  await openChild(page, await lagoonPlayedToday(await pageDay(page)));
  expect(await throughStory(page)).toBe('screen-hub');
  await expect(page.locator('[data-testid^="quest-claim-"]')).toHaveCount(3);
  await expect(page.getByTestId('chest-open')).toBeVisible();
  await fits(page, 'the grotto with three rewards to claim and the chest');
});

test('an Inkoustík’s ambush and Pexeso fit a landscape screen', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await openChild(page, await ambushed());
  expect(await shownScreen(page)).toBe('screen-round');
  await expect(page.getByTestId('ambush')).toBeVisible();
  await fits(page, 'a round with an Inkoustík');
  await miss(page);
  await fits(page, 'a round with an Inkoustík and a miss');
  await page.getByTestId('round-next').click();
  await playRound(page, CHILD);
  await throughStory(page);
  if ((await shownScreen(page)) === 'screen-results') await throughResults(page);
  for (let guard = 0; (await shownScreen(page)) !== 'screen-hub'; guard++) {
    if (guard >= 10) throw new Error('the level did not end');
    const screen = await shownScreen(page);
    if (screen === 'screen-round') await playRound(page, CHILD);
    else if (screen === 'screen-board') await solveBoards(page, CHILD);
    else if (screen === 'screen-results') await throughResults(page);
    else await throughStory(page);
  }

  await toLevel(page, 'sunny-lagoon.5');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'memory-match');
  await fits(page, 'Pexeso');
  const board = await boardOnScreen(page, CHILD);
  if (board.kind !== 'memory-match') throw new Error(`a ${board.kind} board`);
  const open = page.locator('[data-testid="board"] [data-testid^="card-"][data-matched="false"]');
  for (let guard = 0; ; guard++) {
    if (guard >= board.pairs) throw new Error('no two cards turned were a mismatch');
    const [first, second] = await open.evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => card.getAttribute('data-testid')!),
    );
    if ((await turnPair(page, first!, second!)) === 'miss') break;
  }
  await fits(page, 'Pexeso with two cards that are no pair');
});

test('a new 4th grader’s placement check and Měsíční jeskyně fit a landscape screen', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await page.goto('./');
  await ready(page, 'title');
  await createChild(page, { name: 'Tomáš', avatar: 'diver-5', address: 'boy', grade: 4 });
  expect(await throughStory(page)).toBe('screen-eggs');
  await page.locator('[data-testid^="egg-"]').first().click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await throughStory(page)).toBe('screen-round');
  await fits(page, 'the placement check');
  await miss(page);
  await fits(page, 'the placement check with a miss');
  await page.getByTestId('round-next').click();
  for (let guard = 0; guard < 30 && (await shownScreen(page)) === 'screen-round'; guard++) {
    await answerStep(page, CHILD, false);
  }
  expect(await shownScreen(page)).toBe('screen-results');
  await fits(page, 'the placement check’s results');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-hub');

  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-family');
  await arrangeBoard(page, await boardOnScreen(page, CHILD));
  await fits(page, 'Slovní rodinka with its words picked');
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await throughResults(page);
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-shell');
  await arrangeBoard(page, await boardOnScreen(page, CHILD));
  await fits(page, 'Ulita slov with the word cut');
});

test('a rule’s long hint, with a miss, fits a landscape screen', async ({ page }) => {
  // Shoda's rule, a paragraph, under an ink sentence (the tallest problem layout; a taught problem
  // shows its note too) and under a Lov chyb's fix. At 273 characters it pushed "Dál" 52 px under
  // a 1024 × 698 window. A long hint is set smaller in a short window (round.ts
  // LONG_HINT_CHARACTERS), and its endings (-i, -y, -a) never leave their hyphen at a line's end.
  test.setTimeout(300_000);
  await page.setViewportSize(LANDSCAPE[0]);
  await openChild(
    page,
    await fourthGraderPlaced({ region: 'kraken-abyss', levels: ['kraken-abyss.1'] }),
  );
  expect(await throughStory(page)).toBe('screen-hub');
  await toLevel(page, 'kraken-abyss.2');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  const met = new Set<string>();
  for (let guard = 0; met.size < 2; guard++) {
    if (guard >= 60) {
      throw new Error(`shoda's hint came only in: ${[...met].join(', ') || 'no round'}`);
    }
    const screen = await shownScreen(page);
    if (screen === 'screen-results') await throughResults(page);
    if (screen !== 'screen-round') {
      await throughStory(page);
      continue;
    }
    const asked = await problemOnScreen(page, CHILD);
    const where = asked.problem.kind === 'gaps' ? 'an ink sentence' : 'a Lov chyb’s fix';
    if (hintRule(asked) !== 'shoda' || met.has(where)) {
      await answerStep(page, CHILD);
      continue;
    }
    await page.getByTestId('round-hint').click();
    await expect(page.getByTestId('hint-text')).toBeVisible();
    expect(await page.getByTestId('hint-text').textContent()).not.toMatch(LOOSE_ENDING);
    await fits(page, `${where} with shoda’s hint`);
    await give(page, asked, wrongAnswer(asked));
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
    expect(await page.locator('.ps-feedback__hint').textContent()).not.toMatch(LOOSE_ENDING);
    await fits(page, `${where} with shoda’s hint and a miss`);
    await page.getByTestId('round-next').click();
    await movedOn(page, asked);
    met.add(where);
  }
});

test('at 200 % text on a phone, a round and U Mrože keep to the screen’s width', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto('./');
  await ready(page, 'title');
  await seedChild(
    page,
    { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' },
    await lagoonPlayed(),
  );
  await page.reload();
  await ready(page, 'title');
  await enterGrownUps(page);
  await page.getByTestId('setting-text-200').click();
  await expect(page.getByTestId('setting-text-200')).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize(PHONE);
  await page.goto('./');
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await keepsWidth(page, 'the grotto');

  await page.getByTestId('place-shop').click();
  await expect(page.getByTestId('screen-shop')).toBeVisible();
  await keepsWidth(page, 'U Mrože');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();

  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await throughStory(page)).toBe('screen-round');
  for (let guard = 0; (await page.getByTestId('round-hint').count()) === 0; guard++) {
    if (guard >= 10) throw new Error('no step of the round has a hint');
    await answerStep(page, CHILD);
  }
  await keepsWidth(page, 'a round with Nápověda');
  await miss(page);
  await keepsWidth(page, 'a round with a miss');
});
