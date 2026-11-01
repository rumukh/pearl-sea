/**
 * Playing Perlové moře in a real browser, the way a child does: through the editor, the story,
 * the grotto, rounds and boards, with every answer given on screen.
 *
 * What is right comes from the game itself: the save the page stored (the shell saves every
 * step before it moves on) is read back and restored into a runtime host in Node, and its view
 * says what the problem or board on screen asks. Screens name what they show by position only
 * (`data-round`, `data-index`, `data-step`, `data-board`), never by item, so nothing on the page
 * gives an answer away. Boards are solved from the board view and the lexicon, as S2's trace
 * player solves them.
 *
 * A seeded child skips ahead: S2's `Player` plays the real pack in Node, and its snapshot is
 * stored as the shell's checkpoint would store it (`saves.ts`).
 */
import { readFileSync } from 'node:fs';
import { importSave } from '@aegis/browser/save';
import { createRuntimeHost, parseContentJson, requireValue } from '@aegis/runtime';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pearlSeaGame } from '../../../src/app/game/definition';
import type { PearlSeaGame, PearlSeaPack } from '../../../src/app/game/definition';
import { gamePolicy } from '../../../src/app/persistence/game-session';
import { pearlSeaAdapter } from '../../../src/rules/adapter';
import { compareCzech, contentRegistration } from '../../../src/rules/contract';
import type {
  AnswerValue,
  BoardView,
  DiverAvatar,
  FormOfAddress,
  GameView,
  Grade,
  MinigameRoundView,
  ProblemView,
  ProfileId,
} from '../../../src/rules/contract';
import { PERFECT, Player, rightNet, shellParts } from '../../traces/support';
import { FAMILY_KEY, familyPayload, gamePayload, readRecord, storeRecord } from './saves';

const PACK_FILE = new URL('../../../content/pearl-sea.content.json', import.meta.url);

/** The content pack the site serves. */
export const PACK: PearlSeaPack = requireValue(
  parseContentJson(readFileSync(PACK_FILE, 'utf8'), contentRegistration, 'pearl-sea.content.json'),
);
export const GAME: PearlSeaGame = pearlSeaGame(pearlSeaAdapter, PACK);

/** A day long past for seeded games: the page's own day is always a later one. */
export const SEED_DAY = '2026-01-05';

// ------------------------------------------------------------------------------ the stored game

/** The game as the page stored it for `profileId` (restored in Node), or `null` before a save. */
export async function storedView(page: Page, profileId: string): Promise<GameView | null> {
  const payload = await readRecord(page, { gameId: GAME.gameId, profileId });
  if (payload === null) return null;
  const envelope = importSave(payload, gamePolicy(GAME, profileId));
  const host = createRuntimeHost({ adapter: GAME.adapter, content: GAME.content, seed: 'oracle' });
  try {
    requireValue(await host.restore(envelope.state));
    return host.getView();
  } finally {
    await host.dispose();
  }
}

/** Wait until the stored game shows what `pick` looks for, and return that. */
async function untilStored<T>(
  page: Page,
  profileId: string,
  pick: (view: GameView) => T | undefined,
  what: string,
): Promise<T> {
  let found: T | undefined;
  await expect
    .poll(
      async () => {
        const view = await storedView(page, profileId);
        found = view === null ? undefined : pick(view);
        return found !== undefined;
      },
      { message: `the stored game reaches ${what}`, timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

// ------------------------------------------------------------------------------ screens

/** The screen on the stage once no navigation is under way (its `screen-…` test ID). */
export async function shownScreen(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    () => {
      const stage = document.querySelector('[data-testid="stage"]');
      if (!stage || stage.getAttribute('aria-busy') === 'true') return null;
      const screen = stage.querySelector<HTMLElement>('[data-testid^="screen-"]');
      return screen?.dataset['testid'] ?? null;
    },
    undefined,
    { timeout: 20_000 },
  );
  return (await handle.jsonValue()) as string;
}

/** Act, then wait until the screen `testId` on the stage now is gone or has been rebuilt. */
export async function leaveScreen(
  page: Page,
  testId: string,
  act: () => Promise<void>,
): Promise<void> {
  await page.evaluate((testId) => {
    const screen = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (screen) screen.dataset['e2eLeaving'] = 'true';
  }, testId);
  await act();
  await expect(page.locator(`[data-testid="${testId}"][data-e2e-leaving]`)).toHaveCount(0, {
    timeout: 20_000,
  });
}

/** Read on through story beats (skipping what may be skipped) until the game shows another screen. */
export async function throughStory(page: Page): Promise<string> {
  for (let guard = 0; guard < 40; guard++) {
    const screen = await shownScreen(page);
    if (screen !== 'screen-story') return screen;
    const line = await page.getByTestId('story-line').textContent();
    const skip = page.getByTestId('story-skip');
    const onward = (await skip.count()) > 0 ? skip : page.getByTestId('story-next');
    const button =
      (await onward.count()) > 0 ? onward : page.locator('[data-testid^="story-choice-"]');
    await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>('[data-testid="screen-story"]');
      if (screen) screen.dataset['e2eLeaving'] = 'true';
    });
    await button.first().click();
    // A beat's closing line comes on the same screen; anything else rebuilds it.
    await page.waitForFunction(
      (before) => {
        const screen = document.querySelector('[data-testid="screen-story"][data-e2e-leaving]');
        return (
          !screen || screen.querySelector('[data-testid="story-line"]')?.textContent !== before
        );
      },
      line,
      { timeout: 20_000 },
    );
  }
  throw new Error('the story did not end');
}

/** Through the results: every big moment, then on (the next activity, or home). */
export async function throughResults(page: Page): Promise<void> {
  await expect(page.getByTestId('screen-results')).toBeVisible();
  for (let guard = 0; guard < 10; guard++) {
    const moment = page.getByTestId('moment-next');
    if ((await moment.count()) === 0) break;
    await moment.click();
  }
  await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').click());
}

// ------------------------------------------------------------------------------ children

export interface Child {
  readonly name: string;
  readonly avatar: DiverAvatar;
  readonly address: FormOfAddress;
  readonly grade: Grade;
}

/** Make a new child in the editor, from the title screen, and dive in. */
export async function createChild(page: Page, child: Child): Promise<void> {
  await page.getByTestId('title-play').click();
  const editor = page.getByTestId('screen-editor');
  await expect(editor).toBeVisible();
  await page.getByTestId('diver-name').fill(child.name);
  await page.getByTestId(`avatar-${child.avatar}`).click();
  await page.getByTestId(`address-${child.address}`).click();
  await page.getByTestId(`grade-${child.grade}`).click();
  await leaveScreen(page, 'screen-editor', () => page.getByTestId('diver-save').click());
}

/** A child already in the family record and with a stored game at `snapshot`. */
export async function seedChild(
  page: Page,
  child: Omit<Child, 'grade'> & { readonly id: ProfileId },
  snapshot: RuntimeSnapshot,
): Promise<void> {
  const { id, name, avatar, address } = child;
  await storeRecord(
    page,
    FAMILY_KEY,
    await familyPayload({ profiles: [{ id, name, avatar, address }], grownUpsLanguage: 'cs' }),
  );
  await storeRecord(
    page,
    { gameId: GAME.gameId, profileId: id },
    await gamePayload(GAME, id, snapshot),
  );
}

/** A 3rd grader who has played every lesson of Slunná laguna, up to its monster. */
export async function lagoonPlayed(): Promise<RuntimeSnapshot> {
  return levelsPlayed(LAGOON_LESSONS, 'e2e-lagoon');
}

/** Slunná laguna's lessons, in order (without the monster's level). */
export const LAGOON_LESSONS: readonly string[] = PACK.data.levels
  .filter((level) => level.region === 'sunny-lagoon' && level.kind !== 'monster')
  .sort((a, b) => a.order - b.order)
  .map((level) => level.id);

/**
 * A 3rd grader who played the whole lagoon today (`day`, the page's own date, `pageDay`): today's
 * goal met, the day's quests done but their coins not claimed, and the treasure chest waiting.
 * The quests of a first day all come with the lagoon (answers right, fast and in a row, a board, a
 * level), so the grotto shows three rewards to claim and the chest: its fullest state.
 */
export async function lagoonPlayedToday(day: string): Promise<RuntimeSnapshot> {
  return levelsPlayed(LAGOON_LESSONS, 'e2e-today', 'krab-tvrdak', 0, day);
}

/** The page's own date, as the shell reads it (`localDay` in persistence/day.ts). */
export function pageDay(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
}

/**
 * A 3rd grader who played the whole lagoon, Muréna Mumla's battle too, missing one answer in
 * five: progress with words to practise and a monster's diploma for the grown-ups' area.
 */
export async function lagoonFreed(): Promise<RuntimeSnapshot> {
  return levelsPlayed([...LAGOON_LESSONS, 'sunny-lagoon.monster'], 'e2e-freed', 'krab-tvrdak', 5);
}

/**
 * A 3rd grader who chose `egg` and played `levels` in order on `day` (SEED_DAY unless the test
 * needs today: S2's trace player on the real pack), then went home: the snapshot a save of that
 * child holds. `slips` makes every n-th answer a miss, as a child who is still learning gives them.
 */
export async function levelsPlayed(
  levels: readonly string[],
  seed = 'e2e-levels',
  egg = 'krab-tvrdak',
  slips = 0,
  day = SEED_DAY,
): Promise<RuntimeSnapshot> {
  const style =
    slips > 0
      ? { ...PERFECT, right: (n: number) => n % slips !== 0, elapsedMs: () => 2500 }
      : PERFECT;
  const player = new Player(style, seed, GAME.adapter, GAME.content);
  try {
    if (!(await player.begin(egg, day))) {
      throw new Error(`the seeded child could not begin: ${player.failures.join(', ')}`);
    }
    for (const level of levels) await player.playLevel(level);
    if (player.failures.length > 0) {
      throw new Error(`the seeded child got stuck: ${player.failures.join(', ')}`);
    }
    return player.host.snapshot();
  } finally {
    await player.dispose();
  }
}

/** From the title, choose a child already in the family and play: resolves to the screen. */
export async function openChild(page: Page, profileId: string): Promise<string> {
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-divers')).toBeVisible();
  await page.getByTestId(`diver-${profileId}`).click();
  return throughStory(page);
}

/**
 * A 4th grader past the placement check (nothing placed), at the deep sea's first level. With
 * `ahead`, the grown-ups have opened that region early (Pro dospělé) and the child has played
 * its `levels`: a later lesson without the journey before it.
 */
export async function fourthGraderPlaced(ahead?: {
  readonly region: string;
  readonly levels: readonly string[];
}): Promise<RuntimeSnapshot> {
  const player = new Player(PERFECT, 'e2e-grade-4', GAME.adapter, GAME.content);
  try {
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 4 } });
    if (!(await player.begin('krab-tvrdak', SEED_DAY))) {
      throw new Error(`the seeded child could not begin: ${player.failures.join(', ')}`);
    }
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    for (let guard = 0; guard < 30 && player.view().round?.status === 'active'; guard++) {
      await player.answerAs(false);
    }
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
    if (player.failures.length > 0 || player.view().onboarding.placement !== 'done') {
      throw new Error(`the placement check did not end: ${player.failures.join(', ')}`);
    }
    if (ahead) {
      await player.act({
        type: 'setSetting',
        setting: { key: 'unlockAhead', value: [ahead.region] },
      });
      for (const level of ahead.levels) await player.playLevel(level);
      if (player.failures.length > 0) {
        throw new Error(`the seeded child got stuck: ${player.failures.join(', ')}`);
      }
    }
    return player.host.snapshot();
  } finally {
    await player.dispose();
  }
}

// ------------------------------------------------------------------------------ problems

/** The problem step on screen, as the stored game has it (with its answers). */
export async function problemOnScreen(page: Page, profileId: string): Promise<ProblemView> {
  const round = await page.getByTestId('screen-round').getAttribute('data-round');
  const card = page.getByTestId('problem');
  const index = Number(await card.getAttribute('data-index'));
  const step = Number(await card.getAttribute('data-step'));
  return untilStored(
    page,
    profileId,
    (view) => {
      const current = view.round;
      return current?.type === 'problems' &&
        current.id === round &&
        current.problem?.index === index &&
        current.problem.step === step
        ? current.problem
        : undefined;
    },
    `problem ${index}, step ${step}`,
  );
}

/** The right answer to a problem at its step. */
export function rightAnswer(view: ProblemView): AnswerValue {
  const { problem, step } = view;
  switch (problem.kind) {
    case 'gaps':
      return { kind: 'text', value: problem.gaps[step]!.correct };
    case 'mistake':
      return step === 0
        ? { kind: 'pick', index: problem.wrong }
        : { kind: 'text', value: problem.fix.correct };
    case 'classify':
      return { kind: 'option', value: problem.correct };
    case 'odd':
    case 'relation':
      return { kind: 'pick', index: problem.correct };
  }
}

/** A wrong answer a child could give: another offered choice, key or word. */
export function wrongAnswer(view: ProblemView): AnswerValue {
  const { problem, step } = view;
  const right = rightAnswer(view);
  switch (right.kind) {
    case 'pick': {
      const count =
        problem.kind === 'mistake'
          ? problem.tokens.length
          : problem.kind === 'odd'
            ? problem.words.length
            : problem.kind === 'relation'
              ? problem.options.length
              : 1;
      return { kind: 'pick', index: (right.index + 1) % count };
    }
    case 'option':
      return {
        kind: 'option',
        value: problem.kind === 'classify' ? problem.options.find((o) => o !== right.value)! : '',
      };
    case 'text': {
      const gap =
        problem.kind === 'gaps'
          ? problem.gaps[step]!
          : problem.kind === 'mistake'
            ? problem.fix
            : null;
      const pool = gap === null ? [] : view.input === 'letters' ? gap.keys : gap.options;
      return {
        kind: 'text',
        value: view.input === 'typed' ? `${right.value}x` : pool.find((o) => o !== right.value)!,
      };
    }
  }
}

/** Give an answer on screen: a choice tile, a key of the letter pad, a typed word or a word pick. */
export async function give(page: Page, view: ProblemView, value: AnswerValue): Promise<void> {
  const answer = page.getByTestId('answer');
  switch (value.kind) {
    case 'pick':
      await answer.getByTestId(`pick-${value.index}`).click();
      return;
    case 'option':
      await answer.getByTestId(`option-${value.value}`).click();
      return;
    case 'text':
      if (view.input === 'typed') {
        await answer.getByTestId('typed-field').fill(value.value);
        await answer.getByTestId('typed-ok').click();
      } else {
        const prefix = view.input === 'letters' ? 'key' : 'choice';
        await answer.getByTestId(`${prefix}-${value.value}`).click();
      }
      return;
  }
}

/**
 * Answer the step on screen, right or wrong, and wait until the round moves on: the next step
 * or problem, or another screen once the round is over. A wrong answer is taken back with "Dál".
 */
export async function answerStep(
  page: Page,
  profileId: string,
  right = true,
): Promise<ProblemView> {
  const view = await problemOnScreen(page, profileId);
  await give(page, view, right ? rightAnswer(view) : wrongAnswer(view));
  if (!right) {
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
    await page.getByTestId('round-next').click();
  }
  await movedOn(page, view);
  return view;
}

/** Wait until the round shows another step or problem than sked, or another screen. */
export async function movedOn(page: Page, asked: ProblemView): Promise<void> {
  await page.waitForFunction(
    ({ index, step }) => {
      const card = document.querySelector<HTMLElement>('[data-testid="problem"]');
      return !card || card.dataset['index'] !== index || card.dataset['step'] !== step;
    },
    { index: String(asked.index), step: String(asked.step) },
    { timeout: 20_000 },
  );
}

/** Answer every step right until the round is over; resolves to the screen that follows. */
export async function playRound(page: Page, profileId: string): Promise<string> {
  for (let guard = 0; guard < 120; guard++) {
    const screen = await shownScreen(page);
    if (screen !== 'screen-round') return screen;
    await answerStep(page, profileId);
  }
  throw new Error('the round did not end');
}

// ------------------------------------------------------------------------------ boards

/** The board on screen, as the stored game has it. */
export async function boardOnScreen(page: Page, profileId: string): Promise<BoardView> {
  const round = await page.getByTestId('screen-board').getAttribute('data-round');
  const board = Number(await page.getByTestId('board').getAttribute('data-board'));
  return untilStored(
    page,
    profileId,
    (view) => {
      const current = view.round;
      return current?.type === 'minigame' && current.id === round && current.board === board
        ? (current as MinigameRoundView).current
        : undefined;
    },
    `board ${board}`,
  );
}

/** Check the board as it is, and wait for the next board or the screen after the last. */
export async function checkBoard(page: Page): Promise<void> {
  const board = await page.getByTestId('board').getAttribute('data-board');
  await page.getByTestId('board-submit').click();
  await page.waitForFunction(
    (board) => {
      const slot = document.querySelector<HTMLElement>('[data-testid="board"]');
      return !slot || slot.dataset['board'] !== board;
    },
    board,
    { timeout: 20_000 },
  );
}

/** The pearls' right order: alphabetical (ch after h), or the order of the school rhyme. */
function necklaceOrder(board: Extract<BoardView, { kind: 'pearl-necklace' }>): string[] {
  const words = PACK.data.lexicon.words;
  const families = PACK.data.lexicon.families;
  const rhyme = (word: string): number => {
    const family = words.find((w) => w.id === word)?.family?.id;
    return families.find((f) => f.id === family)?.order ?? 0;
  };
  const sorted =
    board.order === 'alphabet'
      ? [...board.pearls].sort((a, b) => compareCzech(a.text, b.text))
      : [...board.pearls].sort((a, b) => rhyme(a.word) - rhyme(b.word));
  return sorted.map((pearl) => pearl.id);
}

/** Make the board right on screen, move by move, without checking it. */
export async function arrangeBoard(page: Page, board: BoardView): Promise<void> {
  const slot = page.getByTestId('board');
  switch (board.kind) {
    case 'pearl-necklace': {
      const order = necklaceOrder(board);
      const places = slot.locator('.ps-necklace__string > li > button');
      for (const [index, id] of order.entries()) {
        if ((await places.nth(index).getAttribute('data-testid')) === `pearl-${id}`) continue;
        await slot.getByTestId(`pearl-${id}`).click();
        await places.nth(index).click();
        await expect(places.nth(index)).toHaveAttribute('data-testid', `pearl-${id}`);
      }
      return;
    }
    case 'fishing-nets':
      for (const fish of board.fish) {
        const net = rightNet(PACK.data, board, fish);
        await slot.getByTestId(`fish-${fish.id}`).click();
        await slot.getByTestId(`net-${net}`).click();
        await expect(
          slot.locator(`.ps-net-area[data-net="${net}"] [data-testid="fish-${fish.id}"]`),
        ).toBeVisible();
      }
      return;
    case 'word-shell': {
      const word = PACK.data.lexicon.words.find((w) => w.id === board.word)!;
      const target = shellParts(word.segments ?? [], board.roles);
      for (const at of target.cuts) {
        await slot.getByTestId(`cut-${at}`).click();
        await expect(slot.getByTestId(`cut-${at}`)).toHaveAttribute('aria-pressed', 'true');
      }
      for (const [part, role] of target.labels.entries()) {
        if (role === null) continue;
        await slot.getByTestId(`role-${part}-${role}`).click();
        await expect(slot.getByTestId(`role-${part}-${role}`)).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
      if (target.zeroEnding) {
        await slot.getByTestId('zero-ending').click();
        await expect(slot.getByTestId('zero-ending')).toHaveAttribute('aria-pressed', 'true');
      }
      return;
    }
    case 'word-family':
      for (const entry of board.words) {
        const word = PACK.data.lexicon.words.find((w) => w.id === entry.word);
        if (word?.family?.id !== board.family) continue;
        await slot.getByTestId(`family-${entry.id}`).click();
        await expect(slot.getByTestId(`family-${entry.id}`)).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
      return;
    case 'memory-match':
      throw new Error('Pexeso is played turn by turn: playPexeso');
  }
}

/**
 * Turn two Pexeso cards on screen and wait for the game's answer: a pair (both stay matched), a
 * mismatch ("Otočit zpět" appears), or the next board once the last pair is found.
 */
export async function turnPair(
  page: Page,
  first: string,
  second: string,
): Promise<'pair' | 'miss'> {
  const board = await page.getByTestId('board').getAttribute('data-board');
  await page.getByTestId(first).click();
  await expect(page.getByTestId(first)).toHaveAttribute('data-up', 'true');
  await page.getByTestId(second).click();
  await page.waitForFunction(
    ({ second, board }) => {
      const slot = document.querySelector<HTMLElement>('[data-testid="board"]');
      if (!slot || slot.dataset['board'] !== board) return true;
      const card = document.querySelector<HTMLElement>(`[data-testid="${second}"]`);
      return (
        !card ||
        card.dataset['matched'] === 'true' ||
        document.querySelector('[data-testid="board-clear"]') !== null
      );
    },
    { second, board },
    { timeout: 20_000 },
  );
  return (await page.getByTestId('board-clear').count()) > 0 ? 'miss' : 'pair';
}

/**
 * Play the Pexeso board on screen to its end the way a child with a perfect memory but no
 * answer key would: try the first open card with each other open card it has not been tried
 * with, turning a mismatch back with "Otočit zpět". The game itself says what is a pair, so the
 * test never needs to know.
 */
export async function playPexeso(page: Page): Promise<void> {
  const tried = new Set<string>();
  const board = await page.getByTestId('board').getAttribute('data-board');
  for (let guard = 0; guard < 200; guard++) {
    const slot = page.getByTestId('board');
    if ((await shownScreen(page)) !== 'screen-board') return;
    if ((await slot.getAttribute('data-board')) !== board) return;
    if ((await page.getByTestId('board-clear').count()) > 0) {
      await page.getByTestId('board-clear').click();
      await expect(page.getByTestId('board-clear')).toHaveCount(0);
      continue;
    }
    const open = await slot
      .locator('[data-testid^="card-"][data-matched="false"]')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-testid')!));
    if (open.length === 0) return;
    const first = open[0]!;
    const second = open.slice(1).find((card) => !tried.has(`${first}|${card}`));
    if (!second) throw new Error(`no untried card for ${first}`);
    if ((await turnPair(page, first, second)) === 'miss') tried.add(`${first}|${second}`);
  }
  throw new Error('the Pexeso board did not end');
}

/**
 * Drag every fish of Rybářské sítě onto its net with the mouse, as a child drags with a finger,
 * each one landing in the net it was dropped on.
 */
export async function dragFish(page: Page, board: BoardView): Promise<void> {
  if (board.kind !== 'fishing-nets') throw new Error(`a ${board.kind} board`);
  const slot = page.getByTestId('board');
  const middle = async (testId: string): Promise<{ x: number; y: number }> => {
    const box = await slot.getByTestId(testId).boundingBox();
    if (!box) throw new Error(`${testId} is not on the screen`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  for (const fish of board.fish) {
    const net = rightNet(PACK.data, board, fish);
    const from = await middle(`fish-${fish.id}`);
    const to = await middle(`net-${net}`);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await expect(
      slot.locator(`.ps-net-area[data-net="${net}"] [data-testid="fish-${fish.id}"]`),
      `fish ${fish.id} lands in net ${net}`,
    ).toBeVisible();
  }
}

/** Solve every board of the round on screen; resolves to the screen that follows. */
export async function solveBoards(page: Page, profileId: string): Promise<string> {
  for (let guard = 0; guard < 10; guard++) {
    const screen = await shownScreen(page);
    if (screen !== 'screen-board') return screen;
    const activity = await page.getByTestId('screen-board').getAttribute('data-activity');
    if (activity === 'memory-match') {
      await playPexeso(page);
      continue;
    }
    await arrangeBoard(page, await boardOnScreen(page, profileId));
    await checkBoard(page);
  }
  throw new Error('the boards did not end');
}
