/**
 * Walks through every screen and state the Slunná laguna slice can show, calling `visit` at
 * each stop. The same walks feed the accessibility sweep, the layout checks and the screenshots
 * for human review (docs/qa/screens.md), so all three always cover the same ground.
 *
 * Stop names are stable file names: `NN-what-it-shows`. Add new stops at the end of a walk (or
 * renumber deliberately) so screenshot history stays comparable. A walk plays the way a child
 * does, through the screen (support/game.ts gives the right answers from the stored save); a
 * child far into the slice is seeded with S2's trace player instead of being played to there.
 *
 * Every walk runs on a fixed day (`WALK_DAY`), so the game serves the same day's mix each run.
 */
import type { Page } from '@playwright/test';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { expect, test } from './fixtures';
import {
  answerStep,
  boardOnScreen,
  arrangeBoard,
  checkBoard,
  createChild,
  give,
  lagoonFreed,
  lagoonPlayed,
  leaveScreen,
  levelsPlayed,
  movedOn,
  openChild,
  playPexeso,
  playRound,
  problemOnScreen,
  seedChild,
  shownScreen,
  solveBoards,
  throughStory,
  turnPair,
  wrongAnswer,
} from './game';
import { FAMILY_KEY, storeRecord } from './saves';
import { unlessKnown } from './known-issues';
import { enterGrownUps, ready } from './screens';
import type { Stop } from './screens';

export type Visit = (stop: Stop) => Promise<void>;

/** The day every walk is played on (the page's clock is fixed to it). */
export const WALK_DAY = new Date('2026-11-02T09:30:00');

/** The first child of a new family takes the first slot. */
export const CHILD = 'profile-1';

/** Fix the page's date (timers keep running) and open the title. */
export async function boot(page: Page): Promise<void> {
  await page.clock.setFixedTime(WALK_DAY);
  await page.goto('./');
  await ready(page, 'title');
}

/** Put a seeded child (and nothing else) into a new family, then open the title again. */
export async function seedFamily(page: Page, snapshot: RuntimeSnapshot): Promise<void> {
  await boot(page);
  await seedChild(page, { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' }, snapshot);
  await page.reload();
  await ready(page, 'title');
}

/** How many px of the title's tagline the focused Hrát button's ring covers, top to bottom. */
async function ringOverlap(page: Page): Promise<number> {
  return page.getByTestId('title-play').evaluate((button) => {
    const style = getComputedStyle(button);
    const ring = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
    const tagline = document.querySelector('.ps-title__tagline')!.getBoundingClientRect();
    const top = button.getBoundingClientRect().top - (style.outlineStyle === 'none' ? 0 : ring);
    return Math.max(0, Math.round(tagline.bottom - top));
  });
}

/** Dnešní výprava: whatever the game has for today, past any story beat. */
export async function goAdventuring(page: Page): Promise<string> {
  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  return throughStory(page);
}

/** On through the results' big moments and the results, past any story, to the next screen. */
export async function pastResults(page: Page): Promise<string> {
  await expect(page.getByTestId('screen-results')).toBeVisible();
  for (let guard = 0; guard < 10 && (await page.getByTestId('moment-next').count()) > 0; guard++) {
    await page.getByTestId('moment-next').click();
  }
  await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').click());
  return throughStory(page);
}

/** Play whatever the screen holds (rounds, boards, results, story) until the grotto. */
export async function untilHub(page: Page): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
    const screen = await shownScreen(page);
    if (screen === 'screen-hub') return;
    if (screen === 'screen-round') await playRound(page, CHILD);
    else if (screen === 'screen-board') await solveBoards(page, CHILD);
    else if (screen === 'screen-results') await pastResults(page);
    else if (screen === 'screen-story') await throughStory(page);
    else throw new Error(`no way home from ${screen}`);
  }
  throw new Error('the grotto never came');
}

/** From the grotto through the sea map and the region to a level's intro. */
export async function openLevel(page: Page, level: string): Promise<void> {
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  const region = level.split('.')[0]!;
  await page.getByTestId(`region-${region}`).click();
  await ready(page, 'region');
  await page.getByTestId(`level-${level}`).click();
  await ready(page, 'level');
}

/**
 * A stop that depends on what the game serves (a hint, a mismatch, a chest) did not come this
 * run: its screen goes unphotographed and unchecked, so the QA summary says so.
 */
function notOffered(stop: string, why: string): void {
  test.info().annotations.push({ type: 'stop not met', description: `${stop}: ${why}` });
}

/** Whether the round on screen asks on the letter pad (four keys or more, not a two-key gap). */
async function onLetterPad(page: Page): Promise<boolean> {
  return (
    (await page.getByTestId('answer').getAttribute('data-input')) === 'letters' &&
    (await page.locator('[data-testid^="key-"]').count()) >= 4
  );
}

/** Play the round on screen until it asks on the letter pad; false when the round ends first. */
async function untilLetterPad(page: Page): Promise<boolean> {
  for (let guard = 0; guard < 40; guard++) {
    if ((await shownScreen(page)) !== 'screen-round') return false;
    if (await onLetterPad(page)) return true;
    await answerStep(page, CHILD);
  }
  return false;
}

// ------------------------------------------------------------------------------ walks

/**
 * A new family's first dive: the title, the profile editor, the prologue, the first egg, the
 * grotto and the whole first lesson of Slunná laguna up to the friend hatching. Ends at the
 * grotto with the baby crab.
 */
export async function firstDiveWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await visit({
    name: '01-title',
    play: true,
    description: 'The title: Perlové moře, Hrát and Pro dospělé',
  });
  await unlessKnown(test.info(), 'PS-QA-07', async () => {
    expect(await ringOverlap(page), 'Hrát’s focus ring stays clear of the tagline').toBe(0);
  });
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await visit({
    name: '02-editor',
    description: 'A new diver: name, eight pictures, kluk / holka / nechci říct, 3. or 4. třída',
  });
  await page.getByTestId('avatar-diver-2').click();
  await page.getByTestId('diver-save').click();
  await expect(page.getByTestId('diver-problem')).not.toBeEmpty();
  await visit({ name: '03-editor-problem', description: 'The editor asking kindly for a name' });
  await createChildFromEditor(page);
  expect(await shownScreen(page)).toBe('screen-story');
  await visit({
    name: '04-prologue',
    play: true,
    description: 'The prologue, line by line, with Dál and Přeskočit',
  });
  expect(await throughStory(page)).toBe('screen-eggs');
  await visit({
    name: '05-eggs',
    play: true,
    description: 'Profesorka Osmička offers the three lagoon eggs',
  });
  await page.getByTestId('egg-krab-tvrdak').click();
  await visit({ name: '06-eggs-chosen', play: true, description: 'Krab Tvrďák’s egg chosen' });
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await visit({
    name: '07-grotto-egg',
    play: true,
    description:
      'The grotto on the first day: the egg, Dnešní výprava, today’s goal and quests, the places',
  });

  // Lesson 1: Perlový náhrdelník, Rybářské sítě, Krmení.
  await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
  expect(await shownScreen(page)).toBe('screen-story');
  await visit({
    name: '08-region-story',
    play: true,
    description: 'Osmička welcomes the diver to Slunná laguna',
  });
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'pearl-necklace');
  await visit({
    name: '09-necklace',
    play: true,
    description: 'Perlový náhrdelník: word pearls to thread in alphabetical order',
  });
  await page.getByTestId('board-submit').click();
  await expect(page.getByTestId('board-message')).not.toBeEmpty();
  await visit({
    name: '10-necklace-not-yet',
    play: true,
    description: 'The necklace checked before it is done: “Ještě ne”, the pearls in place marked',
  });
  const necklace = await boardOnScreen(page, CHILD);
  await arrangeBoard(page, necklace);
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  await visit({
    name: '11-board-results',
    play: true,
    description: 'A board round done: coins, and on to the next game',
  });
  expect(await pastResults(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'fishing-nets');
  await visit({
    name: '12-nets',
    play: true,
    description: 'Rybářské sítě: fish-words to sort into the nets',
  });
  const nets = await boardOnScreen(page, CHILD);
  if (nets.kind === 'fishing-nets') {
    const fish = page.getByTestId(`fish-${nets.fish[0]!.id}`);
    await fish.click();
    await expect(fish).toHaveAttribute('aria-pressed', 'true');
    await visit({
      name: '13-nets-fish-picked',
      play: true,
      description: 'Rybářské sítě: a fish picked up, the nets ready',
    });
    // A second tap puts it back in the pool.
    await fish.click();
    await expect(fish).toHaveAttribute('aria-pressed', 'false');
  }
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  expect(await pastResults(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'feeding');
  await visit({
    name: '14-feeding',
    play: true,
    description: 'Krmení: a word with an ink blot, the friend waiting for shrimp',
  });
  await answerStep(page, CHILD);
  const asked = await problemOnScreen(page, CHILD);
  if ((await page.getByTestId('round-hint').count()) > 0) {
    await page.getByTestId('round-hint').click();
    await expect(page.getByTestId('hint-text')).toBeVisible();
    await visit({
      name: '15-hint',
      play: true,
      description: 'Krmení with its hint: the strategy, not the answer',
    });
  } else {
    notOffered('15-hint', 'the second problem had no Nápověda');
  }
  await give(page, asked, wrongAnswer(asked));
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
  await visit({
    name: '16-miss',
    play: true,
    description: 'A miss: “Skoro!”, the right answer in the gap, Dál',
  });
  await page.getByTestId('round-next').click();
  await movedOn(page, asked);
  await page.getByTestId('round-pause').click();
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  await visit({ name: '17-pause', play: true, description: 'The pause dialog over a round' });
  await page.getByTestId('pause-resume').click();
  await expect(page.getByTestId('pause-dialog')).toHaveCount(0);
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(page.getByTestId('moment-hatch')).toBeVisible();
  await visit({
    name: '18-hatch',
    play: true,
    description: 'The big moment: the egg hatches, Krab Tvrďák is born',
  });
  await page.getByTestId('moment-next').click();
  await expect(page.getByTestId('moment-next')).toHaveCount(0);
  await visit({
    name: '19-lesson-results',
    play: true,
    description: 'The lesson’s results: stars, score, coins, news',
  });
  await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await visit({
    name: '20-grotto-baby',
    play: true,
    description: 'The grotto with the baby crab, its growth meter and a quest to claim',
  });
}

/** The rest of the editor for the first child, after the stop asking for a name. */
async function createChildFromEditor(page: Page): Promise<void> {
  await page.getByTestId('diver-name').fill('Ema');
  await page.getByTestId('address-girl').click();
  await page.getByTestId('grade-3').click();
  await leaveScreen(page, 'screen-editor', () => page.getByTestId('diver-save').click());
}

/**
 * The lagoon after four lessons, on a later day: the daily adventure's Svačinka, the map, a region
 * and a level, Inkoustová věta, Pexeso, Lov chyb, the treasure chest, U Mrože, the friends'
 * wardrobe, the album, the Great Shell and goodbye.
 */
export async function lagoonWalk(page: Page, visit: Visit): Promise<void> {
  const four = await levelsPlayed(
    ['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3', 'sunny-lagoon.4'],
    'e2e-walk-lagoon',
  );
  await seedFamily(page, four);
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-divers')).toBeVisible();
  await visit({
    name: '21-divers',
    description: 'Kdo se potápí? The family’s divers and a new one',
  });
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await visit({
    name: '22-grotto-new-day',
    play: true,
    description: 'A new day in the grotto: three baby friends, today’s plan',
  });

  // Dnešní výprava on a new day: the friends are hungry, so a snack of review comes first.
  expect(await goAdventuring(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'snack');
  await visit({
    name: '23-snack',
    play: true,
    description:
      'Dnešní výprava on a new day: Svačinka, a review round for the hungry friends; a word the child knows well is answered on the letter pad (e é ě je, i í y ý …)',
  });
  // The first dive shows the two-tile choice; the letter pad comes with words the child knows
  // well. Unless the snack opened on it, it is looked for in the snack, then in lesson 5's Krmení.
  const letterPad = {
    name: '23-letter-pad',
    play: true,
    description: 'The letter pad (i í y ý …), for a word the child knows well',
  };
  let letterPadSeen = await onLetterPad(page);
  if (!letterPadSeen && (await untilLetterPad(page))) {
    letterPadSeen = true;
    await visit(letterPad);
  }
  await untilHub(page);

  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await visit({
    name: '24-map',
    play: true,
    description: 'The sea map: Slunná laguna open, the deep still dark',
  });
  await page.getByTestId('region-sunny-lagoon').click();
  await ready(page, 'region');
  await visit({
    name: '25-region',
    play: true,
    description: 'Slunná laguna: its lessons and Muréna Mumla’s cave',
  });
  await page.getByTestId('level-sunny-lagoon.5').click();
  await ready(page, 'level');
  await visit({
    name: '26-level',
    play: true,
    description: 'A lesson’s intro: its games, stars and Hrát',
  });
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  // Lesson 5: Krmení, Pexeso, Inkoustová věta.
  if (!letterPadSeen && (await untilLetterPad(page))) {
    letterPadSeen = true;
    await visit(letterPad);
  }
  if (!letterPadSeen) {
    notOffered(
      letterPad.name,
      'neither Svačinka nor lesson 5’s Krmení asked on the big letter pad',
    );
  }
  await playRound(page, CHILD);
  expect(await pastResults(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'memory-match');
  await visit({ name: '27-pexeso', play: true, description: 'Pexeso: pearl cards face down' });
  await unlessKnown(test.info(), 'PS-QA-06', async () => {
    await expect(
      page.getByTestId('board').locator('.ps-board__task'),
      'Pexeso says what makes a pair, as the other boards say what to do',
    ).not.toBeEmpty({ timeout: 1_000 });
  });
  const cards = await page
    .locator('[data-testid^="card-"]')
    .evaluateAll((all) => all.map((card) => card.getAttribute('data-testid')!));
  let mismatch = false;
  for (const second of cards.slice(1)) {
    if ((await turnPair(page, cards[0]!, second)) === 'miss') {
      mismatch = true;
      break;
    }
  }
  if (mismatch) {
    await visit({
      name: '28-pexeso-turn-back',
      play: true,
      description: 'Pexeso: two cards that are no pair, and Otočit zpět',
    });
  } else {
    notOffered('28-pexeso-turn-back', 'the first card made a pair with every other card turned');
  }
  await playPexeso(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  expect(await pastResults(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'ink-sentence');
  await visit({
    name: '29-ink-sentence',
    play: true,
    description: 'Inkoustová věta: a sentence with ink-blot gaps, one at a time',
  });
  await answerStep(page, CHILD);
  if ((await shownScreen(page)) === 'screen-round') {
    await visit({
      name: '30-ink-sentence-on',
      play: true,
      description: 'Inkoustová věta after a right answer: the gap filled',
    });
  } else {
    notOffered('30-ink-sentence-on', 'the round ended with its first answer');
  }
  await playRound(page, CHILD);
  expect(await shownScreen(page)).toBe('screen-results');
  await visit({
    name: '31-results-score',
    play: true,
    description: 'The results of a sentence round: stars, score and coins',
  });
  await untilHub(page);

  // Lesson 6: Krmení, Lov chyb.
  await openLevel(page, 'sunny-lagoon.6');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await playRound(page, CHILD);
  expect(await pastResults(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'bug-hunt');
  await visit({
    name: '32-bug-hunt-find',
    play: true,
    description: 'Lov chyb: tap the word the ink spelled wrong',
  });
  await answerStep(page, CHILD);
  await visit({
    name: '33-bug-hunt-fix',
    play: true,
    description: 'Lov chyb: now fix the wrong word',
  });
  await playRound(page, CHILD);
  // Every Lov chyb problem has two steps: a score that pairs right steps with problems said
  // "Správně: 10 / 5" (PS-QA-03, fixed by #27, which shows the right answers alone).
  expect(await throughStory(page)).toBe('screen-results');
  const score = (await page.getByTestId('results-score').textContent()) ?? '';
  const ratio = /(\d+) \/ (\d+)/.exec(score);
  if (ratio) {
    expect(Number(ratio[1]), `never more right than answered: “${score}”`).toBeLessThanOrEqual(
      Number(ratio[2]),
    );
  }
  await untilHub(page);

  // The treasure chest, once today's goal is met.
  for (let guard = 0; guard < 6 && (await page.getByTestId('chest-open').count()) === 0; guard++) {
    await goAdventuring(page);
    await untilHub(page);
  }
  const claim = page.locator('[data-testid^="quest-claim-"]');
  if ((await claim.count()) > 0) {
    await visit({
      name: '34-grotto-quests',
      play: true,
      description: 'The grotto with today’s goal met and a quest’s coins to claim',
    });
  } else {
    notOffered('34-grotto-quests', 'no quest had coins to claim');
  }
  if ((await page.getByTestId('chest-open').count()) > 0) {
    await page.getByTestId('chest-open').click();
    await expect(page.getByTestId('chest-dialog')).toBeVisible();
    await visit({
      name: '35-chest',
      play: true,
      description: 'The treasure chest, opened after today’s goal',
    });
    await page.getByTestId('chest-close').click();
    await expect(page.getByTestId('screen-hub')).toBeVisible();
  } else {
    notOffered('35-chest', 'today’s goal was not met within six more adventures');
  }

  // U Mrože, the wardrobe, the album, the Great Shell.
  await page.getByTestId('place-shop').click();
  await expect(page.getByTestId('screen-shop')).toBeVisible();
  await visit({ name: '36-shop', description: 'U Mrože: Mrož Vousáč’s hats, goggles and scarves' });
  const affordable = page.locator('[data-testid^="buy-"]:not([disabled])');
  if ((await affordable.count()) > 0) {
    const item = (await affordable.first().getAttribute('data-testid'))!.replace(/^buy-/, '');
    await affordable.first().click();
    await expect(page.getByTestId(`item-${item}`)).toHaveAttribute('data-owned', 'true');
    await visit({ name: '37-shop-bought', description: 'U Mrože after buying: the item owned' });
  } else {
    notOffered('37-shop-bought', 'the diver could afford nothing');
  }
  await page.getByTestId('shop-dress').click();
  await expect(page.getByTestId('screen-friends')).toBeVisible();
  await visit({
    name: '38-friends',
    description: 'Kamarádi: the friends, the wardrobe and the grotto’s decorations',
  });
  const wear = page.locator('select[data-testid^="wear-"]:not([disabled])');
  if ((await wear.count()) > 0) {
    const slot = wear.first();
    const value = await slot.locator('option').nth(1).getAttribute('value');
    await slot.selectOption(value!);
    await expect(page.getByTestId('screen-friends')).toBeVisible();
    await expect(page.locator('select[data-testid^="wear-"]').first()).toHaveValue(value!);
    await visit({ name: '39-friends-dressed', description: 'A friend wearing what was bought' });
  }
  await page.getByTestId('back').click();
  if (await page.getByTestId('screen-shop').isVisible()) await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await page.getByTestId('place-album').click();
  await expect(page.getByTestId('screen-album')).toBeVisible();
  await visit({ name: '40-album', description: 'The sticker album: the lagoon’s page' });
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await page.getByTestId('place-shell').click();
  await expect(page.getByTestId('screen-shell')).toBeVisible();
  await visit({
    name: '41-great-shell',
    description: 'Velká lastura: the pearls of every topic, cloudy to gold',
  });
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await page.getByTestId('hub-goodbye').click();
  await expect(page.getByTestId('screen-goodbye')).toBeVisible();
  await visit({
    name: '42-goodbye',
    play: true,
    description: 'Goodbye: the diary card of what today brought',
  });
}

/** Muréna Mumla's battle, her freeing, the gallery and an Inkoustík ambush after her. */
export async function monsterWalk(page: Page, visit: Visit): Promise<void> {
  await seedFamily(page, await lagoonPlayed());
  expect(await openChild(page, CHILD)).toBe('screen-hub');
  await openLevel(page, 'sunny-lagoon.monster');
  await visit({
    name: '43-monster-level',
    play: true,
    description: 'Muréna Mumla’s level: the battle ahead',
  });
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await shownScreen(page)).toBe('screen-story');
  await visit({
    name: '44-monster-story',
    play: true,
    description: 'Muréna Mumla wakes up, inky and grumpy',
  });
  expect(await throughStory(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-activity', 'battle');
  await visit({
    name: '45-battle',
    play: true,
    description: 'The battle: Bublinka, the inked Muréna, her joke, the ink meter',
  });
  for (let guard = 0; guard < 30 && (await page.getByTestId('ink-splash').count()) === 0; guard++) {
    await answerStep(page, CHILD);
  }
  if ((await page.getByTestId('ink-splash').count()) > 0) {
    await visit({
      name: '46-battle-ink',
      play: true,
      description: 'Harmless ink blots on the screen, to wipe off with a tap',
    });
    await page.getByTestId('ink-splash').first().click();
  } else {
    notOffered('46-battle-ink', 'Muréna threw no ink in 30 answers');
  }
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(page.getByTestId('moment-freed')).toBeVisible();
  await expect(page.getByTestId('moment-joke')).not.toBeEmpty();
  await visit({
    name: '47-freed',
    play: true,
    description:
      'Washed clean: Muréna Mumla smiles and tells her last joke (the victory sting plays)',
  });
  await page.getByTestId('moment-next').click();
  for (let guard = 0; guard < 10 && (await page.getByTestId('moment-next').count()) > 0; guard++) {
    await page.getByTestId('moment-next').click();
  }
  await visit({
    name: '48-freed-results',
    play: true,
    description: 'The monster level’s results after her freeing: stars, score, coins, news',
  });
  await pastResults(page);
  await untilHub(page);
  await page.getByTestId('place-gallery').click();
  await expect(page.getByTestId('screen-gallery')).toBeVisible();
  await visit({
    name: '49-gallery',
    description: 'Galerie přátel: Muréna Mumla freed, the other monsters waiting',
  });
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  // After Muréna, an Inkoustík may ambush a round and smudge the next word.
  for (let round = 0; round < 6 && (await page.getByTestId('ambush').count()) === 0; round++) {
    await goAdventuring(page);
    for (let guard = 0; guard < 40; guard++) {
      if ((await shownScreen(page)) !== 'screen-round') break;
      if ((await page.getByTestId('ambush').count()) > 0) break;
      await answerStep(page, CHILD);
    }
    if ((await page.getByTestId('ambush').count()) > 0) break;
    await untilHub(page);
  }
  if ((await page.getByTestId('ambush').count()) > 0) {
    await visit({
      name: '50-ambush',
      play: true,
      description: 'An Inkoustík ambush: answer right to splash it away',
    });
  } else {
    notOffered('50-ambush', 'no Inkoustík ambushed six adventures');
  }
}

/** A new 4th grader: the placement check, then Kořínek's first lesson in Měsíční jeskyně. */
export async function fourthGradeWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await page.getByTestId('title-play').click();
  await page.getByTestId('diver-name').fill('Tomáš');
  await page.getByTestId('avatar-diver-5').click();
  await page.getByTestId('address-boy').click();
  await page.getByTestId('grade-4').click();
  await visit({ name: '51-editor-grade-4', description: 'The editor for a 4th grader' });
  await leaveScreen(page, 'screen-editor', () => page.getByTestId('diver-save').click());
  expect(await throughStory(page)).toBe('screen-eggs');
  await page.locator('[data-testid^="egg-"]').first().click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
  await visit({
    name: '52-grotto-placement',
    play: true,
    description: 'A 4th grader’s grotto: Ukaž, co umíš is today’s adventure',
  });
  expect(await goAdventuring(page)).toBe('screen-round');
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-placement', 'true');
  await visit({
    name: '53-placement',
    play: true,
    description: 'Ukaž, co umíš: the placement check',
  });
  for (let guard = 0; guard < 30 && (await shownScreen(page)) === 'screen-round'; guard++) {
    await answerStep(page, CHILD, false);
  }
  expect(await shownScreen(page)).toBe('screen-results');
  await visit({
    name: '54-placement-results',
    play: true,
    description: 'The placement check’s results',
  });
  expect(await pastResults(page)).toBe('screen-hub');
  expect(await goAdventuring(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-family');
  await visit({
    name: '55-word-family',
    play: true,
    description: 'Slovní rodinka: pick every word of one family',
  });
  await arrangeBoard(page, await boardOnScreen(page, CHILD));
  await visit({
    name: '56-word-family-picked',
    play: true,
    description: 'Slovní rodinka with the family picked',
  });
  await checkBoard(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  expect(await pastResults(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'word-shell');
  await visit({
    name: '57-word-shell',
    play: true,
    description: 'Ulita slov: cut the word into its parts',
  });
  await arrangeBoard(page, await boardOnScreen(page, CHILD));
  await visit({
    name: '58-word-shell-cut',
    play: true,
    description: 'Ulita slov with the word cut and its parts named',
  });
  await checkBoard(page);
}

/** The grown-ups' area for a family with a child who freed Muréna. */
export async function grownUpsWalk(page: Page, visit: Visit): Promise<void> {
  await seedFamily(page, await lagoonFreed());
  await page.getByTestId('title-grownups').click();
  await expect(page.getByTestId('gate-hold')).toBeFocused();
  await visit({ name: '59-gate', description: 'The grown-ups’ gate: press and hold the lock' });
  await page.keyboard.down(' ');
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible();
  await page.keyboard.up(' ');
  await visit({ name: '60-gate-question', description: 'The gate’s question and its number pad' });
  const a = Number(await question.getAttribute('data-a'));
  const b = Number(await question.getAttribute('data-b'));
  await page.keyboard.type(String(a * b));
  await page.keyboard.press('Enter');
  await ready(page, 'grownups');
  await visit({
    name: '61-settings',
    description: 'Pro dospělé, Nastavení: language, read-aloud, Ema’s game and settings',
  });
  await page.getByTestId('grownups-tab-progress').click();
  await expect(page.getByTestId('grownups-progress')).toBeVisible();
  await visit({
    name: '62-progress',
    description: 'Pokrok: days, answers, the goals of the 3rd grade, what goes wrong most',
  });
  const cards = page.getByTestId('print-cards');
  if ((await cards.count()) > 0) {
    await cards.click();
    await ready(page, 'print');
    await visit({ name: '63-print-cards', description: 'Flashcards of the hardest words, on A4' });
    await page.getByTestId('print-back').click();
    await ready(page, 'grownups');
  } else {
    notOffered('63-print-cards', 'Pokrok offered no flashcards');
  }
  const diploma = page.locator('[data-testid^="diploma-"]');
  if ((await diploma.count()) > 0) {
    await diploma.first().click();
    await ready(page, 'print');
    await visit({ name: '64-print-diploma', description: 'Muréna Mumla’s diploma, on A4' });
    await page.getByTestId('print-back').click();
    await ready(page, 'grownups');
  } else {
    notOffered('64-print-diploma', 'Pokrok offered no diploma');
  }
  await page.getByTestId('grownups-tab-data').click();
  await expect(page.getByTestId('grownups-data')).toBeVisible();
  await visit({
    name: '65-backups',
    description: 'Zálohy: a backup to save or load, progress to erase, storage',
  });
  await page.getByTestId('grownups-tab-offline').click();
  await expect(page.getByTestId('offline-status')).toBeVisible();
  await visit({
    name: '66-offline',
    description: 'Bez internetu: install the game for offline play',
  });
  await page.getByTestId('grownups-tab-about').click();
  await expect(page.getByTestId('about-version')).toBeVisible();
  await visit({ name: '67-about', description: 'O hře: the version, privacy and licences' });
  await page.getByTestId('grownups-tab-settings').click();
  await page.getByTestId('grownups-language-en').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('For grown-ups');
  await visit({ name: '68-settings-english', description: 'The grown-ups’ area in English' });
  await page.getByTestId('grownups-language-cs').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pro dospělé');
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-divers')).toBeVisible();
  await page.getByTestId(`diver-edit-${CHILD}`).click();
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await visit({ name: '69-editor-change', description: 'Changing a diver, with Odebrat' });
}

/** What a grown-up sees when the saved family cannot be read. */
export async function troubleWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await storeRecord(page, FAMILY_KEY, '{"broken": true');
  await page.reload();
  await ready(page, 'recovery');
  await visit({
    name: '70-recovery',
    description: 'The family record cannot be read: what a grown-up can do',
  });
  await page.getByTestId('recovery-reset').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await visit({
    name: '71-recovery-confirm',
    description: 'Confirming a reset of exactly that record',
  });
  await page.getByTestId('confirm-cancel').click();
  await ready(page, 'recovery');
}

/**
 * A diver whose grown-up chose Velikost písma 200 % plays on another day: the grotto, Svačinka
 * with a miss, the results, the map, a region and a lesson's intro, Pexeso and Inkoustová věta,
 * the shop, the friends, the album, the Great Shell and goodbye (reflow at large text).
 */
export async function largeTextWalk(page: Page, visit: Visit): Promise<void> {
  const four = await levelsPlayed(
    ['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3', 'sunny-lagoon.4'],
    'e2e-walk-large-text',
  );
  await seedFamily(page, four);
  await enterGrownUps(page);
  await page.getByTestId('setting-text-200').click();
  await expect(page.getByTestId('setting-text-200')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await visit({ name: '22-grotto-new-day', description: 'The grotto at 200 % text' });
  expect(await goAdventuring(page)).toBe('screen-round');
  await visit({ name: '23-snack', description: 'Svačinka, a problem round, at 200 % text' });
  const asked = await problemOnScreen(page, CHILD);
  await give(page, asked, wrongAnswer(asked));
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
  await visit({ name: '16-miss', description: 'A miss at 200 % text' });
  await page.getByTestId('round-next').click();
  await movedOn(page, asked);
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await visit({ name: '31-results-score', description: 'Results at 200 % text' });
  await untilHub(page);
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await visit({ name: '24-map', description: 'The sea map at 200 % text: region cards' });
  await page.getByTestId('region-sunny-lagoon').click();
  await ready(page, 'region');
  await visit({ name: '25-region', description: 'Slunná laguna’s levels at 200 % text' });
  await page.getByTestId('level-sunny-lagoon.5').click();
  await ready(page, 'level');
  await visit({ name: '26-level', description: 'A lesson’s intro at 200 % text' });
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await playRound(page, CHILD);
  expect(await pastResults(page)).toBe('screen-board');
  await visit({ name: '27-pexeso', description: 'Pexeso at 200 % text' });
  await playPexeso(page);
  expect(await solveBoards(page, CHILD)).toBe('screen-results');
  expect(await pastResults(page)).toBe('screen-round');
  await visit({ name: '29-ink-sentence', description: 'Inkoustová věta at 200 % text' });
  await playRound(page, CHILD);
  await untilHub(page);
  await page.getByTestId('place-shop').click();
  await expect(page.getByTestId('screen-shop')).toBeVisible();
  await visit({ name: '36-shop', description: 'U Mrože at 200 % text' });
  await page.getByTestId('shop-dress').click();
  await expect(page.getByTestId('screen-friends')).toBeVisible();
  await visit({ name: '38-friends', description: 'Kamarádi at 200 % text' });
  await page.getByTestId('back').click();
  if (await page.getByTestId('screen-shop').isVisible()) await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await page.getByTestId('place-album').click();
  await expect(page.getByTestId('screen-album')).toBeVisible();
  await visit({ name: '40-album', description: 'The album at 200 % text' });
  await page.getByTestId('back').click();
  await page.getByTestId('place-shell').click();
  await expect(page.getByTestId('screen-shell')).toBeVisible();
  await visit({ name: '41-great-shell', description: 'Velká lastura at 200 % text' });
  await page.getByTestId('back').click();
  await page.getByTestId('hub-goodbye').click();
  await expect(page.getByTestId('screen-goodbye')).toBeVisible();
  await visit({ name: '42-goodbye', description: 'Goodbye at 200 % text' });
}

export { createChild, enterGrownUps };
