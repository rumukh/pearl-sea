/**
 * Playing by keyboard alone and by touch alone (docs/app.md §8, plan §0: touch-first with full
 * keyboard support).
 *
 * - Keyboard: a new diver from the title to the hatched friend, every control reached with Tab
 *   (or the arrows inside a group) and used with Enter, Space, the arrows or a typed letter. Each
 *   control reached shows a focus ring, and each new screen puts focus somewhere useful.
 * - Touch: the same lesson on a touch tablet, every control tapped, and a fish dragged into its
 *   net with a finger.
 */
import type { Page } from '@playwright/test';
import { focusStop } from './support/a11y';
import { expect, test } from './support/fixtures';
import {
  boardOnScreen,
  leaveScreen,
  levelsPlayed,
  problemOnScreen,
  rightAnswer,
  movedOn,
  shownScreen,
  throughStory,
  PACK,
} from './support/game';
import { rightNet } from '../traces/support';
import { boot, CHILD, openLevel, seedFamily } from './support/tour';
import { compareCzech } from '../../src/rules/contract';

test.use({ reducedMotion: 'reduce' });

/**
 * Press Tab until the control `testId` has focus, and if focus leaves the page first, Shift+Tab
 * back from where it was (a keyboard user goes both ways); it must show a focus ring.
 */
async function tabTo(page: Page, testId: string | RegExp, limit = 40): Promise<void> {
  const wanted = (id: string | null): boolean =>
    id !== null && (typeof testId === 'string' ? id === testId : testId.test(id));
  for (const key of ['Tab', 'Shift+Tab'] as const) {
    for (let press = 0; press < limit; press++) {
      const stop = await focusStop(page);
      if (wanted(stop.id)) {
        expect(stop.ring, `${stop.id} shows a focus ring`).toBe(true);
        expect(stop.onScreen, `${stop.id} is on screen when focused`).toBe(true);
        return;
      }
      if (stop.page && press > 0) {
        // Focus went to the browser's own controls: take the window back and turn around.
        await page.bringToFront();
        break;
      }
      await page.keyboard.press(key);
    }
  }
  throw new Error(`Tab and Shift+Tab never reached ${String(testId)}`);
}

/** Wait for the screen after `testId` to be shown (the stage not busy, another screen). */
async function nextScreen(page: Page, from: string): Promise<string> {
  await expect(page.getByTestId(from)).toHaveCount(0, { timeout: 20_000 });
  return shownScreen(page);
}

/** Check the board, then wait for the next board or the screen after the last one. */
async function submitted(page: Page, act: () => Promise<void>): Promise<void> {
  const board = await page.getByTestId('board').getAttribute('data-board');
  await act();
  await page.waitForFunction(
    (board) => {
      const slot = document.querySelector<HTMLElement>('[data-testid="board"]');
      return !slot || slot.dataset['board'] !== board;
    },
    board,
    { timeout: 20_000 },
  );
  await shownScreen(page);
}

/** Read on through story beats with Enter on whatever has focus (Dál, or the choice). */
async function storyByKeys(page: Page): Promise<string> {
  for (let guard = 0; guard < 40; guard++) {
    const screen = await shownScreen(page);
    if (screen !== 'screen-story') return screen;
    const line = await page.getByTestId('story-line').textContent();
    await tabTo(page, /^story-(next|choice-.+)$/);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (before) =>
        document.querySelector('[data-testid="screen-story"] [data-testid="story-line"]')
          ?.textContent !== before ||
        document.querySelector('[data-testid="screen-story"]') === null,
      line,
      { timeout: 20_000 },
    );
  }
  throw new Error('the story did not end');
}

test('a new diver plays the first lesson by keyboard alone', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  await tabTo(page, 'title-play');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await tabTo(page, 'diver-name');
  await page.keyboard.type('Ema');
  await tabTo(page, /^avatar-diver-\d$/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await tabTo(page, /^address-/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await tabTo(page, /^grade-/);
  await tabTo(page, 'diver-save');
  await page.keyboard.press('Enter');
  await nextScreen(page, 'screen-editor');

  expect(await storyByKeys(page)).toBe('screen-eggs');
  await tabTo(page, 'egg-krab-tvrdak');
  await page.keyboard.press('Enter');
  await tabTo(page, 'eggs-next');
  await page.keyboard.press('Enter');
  await nextScreen(page, 'screen-eggs');
  expect(await storyByKeys(page)).toBe('screen-hub');
  expect((await focusStop(page)).id, 'the grotto offers Dnešní výprava first').toBe('adventure');
  await page.keyboard.press('Enter');
  await nextScreen(page, 'screen-hub');
  expect(await storyByKeys(page)).toBe('screen-board');

  // Perlový náhrdelník (two boards): a pearl moves left or right with the arrow keys.
  for (let guard = 0; guard < 4 && (await shownScreen(page)) === 'screen-board'; guard++) {
    const necklace = await boardOnScreen(page, CHILD);
    if (necklace.kind !== 'pearl-necklace') throw new Error(`a ${necklace.kind} board`);
    const order = [...necklace.pearls].sort((a, b) => compareCzech(a.text, b.text));
    for (const [place, pearl] of order.entries()) {
      await tabTo(page, `pearl-${pearl.id}`);
      for (let moves = 0; moves < 8; moves++) {
        const at = await page
          .locator('.ps-necklace__string > li > button')
          .evaluateAll(
            (buttons, id) => buttons.findIndex((b) => b.getAttribute('data-testid') === id),
            `pearl-${pearl.id}`,
          );
        if (at === place) break;
        await page.keyboard.press(at > place ? 'ArrowLeft' : 'ArrowRight');
        await expect(
          page.locator('.ps-necklace__string > li > button').nth(at > place ? at - 1 : at + 1),
        ).toHaveAttribute('data-testid', `pearl-${pearl.id}`);
      }
    }
    await tabTo(page, 'board-submit');
    await submitted(page, () => page.keyboard.press('Enter'));
  }
  expect(await shownScreen(page)).toBe('screen-results');
  await tabTo(page, 'results-next');
  await leaveScreen(page, 'screen-results', () => page.keyboard.press('Enter'));
  expect(await storyByKeys(page)).toBe('screen-board');

  // Rybářské sítě: Enter on a fish picks it up, Enter on a net puts it there.
  for (let guard = 0; guard < 4 && (await shownScreen(page)) === 'screen-board'; guard++) {
    const nets = await boardOnScreen(page, CHILD);
    if (nets.kind !== 'fishing-nets') throw new Error(`a ${nets.kind} board`);
    for (const fish of nets.fish) {
      const net = rightNet(PACK.data, nets, fish);
      await tabTo(page, `fish-${fish.id}`);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(`fish-${fish.id}`)).toHaveAttribute('aria-pressed', 'true');
      await tabTo(page, `net-${net}`);
      await page.keyboard.press('Enter');
      await expect(
        page.locator(`.ps-net-area[data-net="${net}"] [data-testid="fish-${fish.id}"]`),
      ).toBeVisible();
    }
    await tabTo(page, 'board-submit');
    await submitted(page, () => page.keyboard.press('Enter'));
  }
  expect(await shownScreen(page)).toBe('screen-results');
  await tabTo(page, 'results-next');
  await leaveScreen(page, 'screen-results', () => page.keyboard.press('Enter'));
  expect(await storyByKeys(page)).toBe('screen-round');

  // Krmení: a typed letter picks its tile (a letter a US keyboard has), or the arrows walk the
  // tiles to it (í, ý, ě …); Enter sends it.
  for (let guard = 0; guard < 60 && (await shownScreen(page)) === 'screen-round'; guard++) {
    const asked = await problemOnScreen(page, CHILD);
    const answer = rightAnswer(asked);
    if (answer.kind !== 'text') throw new Error(`a ${answer.kind} answer in Krmení`);
    const focus = await focusStop(page);
    expect
      .soft(focus.id ?? '', 'the answer pad has focus for a new problem')
      .toMatch(/^(answer|choice-.+|key-.+)$/);
    const prefix = asked.input === 'letters' ? 'key' : 'choice';
    const wanted = `${prefix}-${answer.value}`;
    if (/^[a-z]$/.test(answer.value)) {
      await page.keyboard.press(answer.value);
      await expect(page.getByTestId(wanted)).toHaveAttribute('aria-pressed', 'true');
    } else {
      for (let step = 0; step < 8 && (await focusStop(page)).id !== wanted; step++) {
        await page.keyboard.press('ArrowRight');
      }
      for (let step = 0; step < 8 && (await focusStop(page)).id !== wanted; step++) {
        await page.keyboard.press('ArrowLeft');
      }
      expect((await focusStop(page)).id, 'the arrows reach every tile').toBe(wanted);
    }
    await page.keyboard.press('Enter');
    await movedOn(page, asked);
  }
  expect(await storyByKeys(page)).toBe('screen-results');
  for (let guard = 0; guard < 5 && (await page.getByTestId('moment-next').count()) > 0; guard++) {
    await tabTo(page, 'moment-next');
    await page.keyboard.press('Enter');
  }
  await tabTo(page, 'results-next');
  await leaveScreen(page, 'screen-results', () => page.keyboard.press('Enter'));
  expect(await storyByKeys(page)).toBe('screen-hub');
  await expect(page.getByTestId('hub-featured')).toHaveAttribute('data-stage', 'baby');
});

test.describe('on a touch tablet', () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 800 } });

  test('a new diver taps through the first lesson', async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page);
    await page.getByTestId('title-play').tap();
    await page.getByTestId('diver-name').fill('Ema');
    await page.getByTestId('avatar-diver-2').tap();
    await page.getByTestId('address-girl').tap();
    await page.getByTestId('grade-3').tap();
    await leaveScreen(page, 'screen-editor', () => page.getByTestId('diver-save').tap());
    expect(await throughStory(page)).toBe('screen-eggs');
    await page.getByTestId('egg-krab-tvrdak').tap();
    await page.getByTestId('eggs-next').tap();
    await nextScreen(page, 'screen-eggs');
    expect(await throughStory(page)).toBe('screen-hub');
    await page.getByTestId('adventure').tap();
    await nextScreen(page, 'screen-hub');
    expect(await throughStory(page)).toBe('screen-board');

    for (let guard = 0; guard < 4 && (await shownScreen(page)) === 'screen-board'; guard++) {
      const necklace = await boardOnScreen(page, CHILD);
      if (necklace.kind !== 'pearl-necklace') throw new Error(`a ${necklace.kind} board`);
      const order = [...necklace.pearls].sort((a, b) => compareCzech(a.text, b.text));
      const places = page.locator('.ps-necklace__string > li > button');
      for (const [place, pearl] of order.entries()) {
        if ((await places.nth(place).getAttribute('data-testid')) === `pearl-${pearl.id}`) continue;
        await page.getByTestId(`pearl-${pearl.id}`).tap();
        await places.nth(place).tap();
        await expect(places.nth(place)).toHaveAttribute('data-testid', `pearl-${pearl.id}`);
      }
      await submitted(page, () => page.getByTestId('board-submit').tap());
    }
    expect(await shownScreen(page)).toBe('screen-results');
    await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').tap());
    expect(await throughStory(page)).toBe('screen-board');

    // Rybářské sítě, tapped: a fish, then its net.
    const nets = await boardOnScreen(page, CHILD);
    if (nets.kind !== 'fishing-nets') throw new Error(`a ${nets.kind} board`);
    for (const fish of nets.fish) {
      const target = rightNet(PACK.data, nets, fish);
      await page.getByTestId(`fish-${fish.id}`).tap();
      await page.getByTestId(`net-${target}`).tap();
      await expect(
        page.locator(`.ps-net-area[data-net="${target}"] [data-testid="fish-${fish.id}"]`),
      ).toBeVisible();
    }
    await page.getByTestId('board-submit').tap();
    expect(await nextScreen(page, 'screen-board')).toBe('screen-results');
    await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').tap());
    expect(await throughStory(page)).toBe('screen-round');

    for (let guard = 0; guard < 60 && (await shownScreen(page)) === 'screen-round'; guard++) {
      const asked = await problemOnScreen(page, CHILD);
      const answer = rightAnswer(asked);
      if (answer.kind !== 'text') throw new Error(`a ${answer.kind} answer in Krmení`);
      const prefix = asked.input === 'letters' ? 'key' : 'choice';
      await page.getByTestId('answer').getByTestId(`${prefix}-${answer.value}`).tap();
      await movedOn(page, asked);
    }
    expect(await throughStory(page)).toBe('screen-results');
    for (let guard = 0; guard < 5 && (await page.getByTestId('moment-next').count()) > 0; guard++) {
      await page.getByTestId('moment-next').tap();
    }
    await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').tap());
    expect(await throughStory(page)).toBe('screen-hub');
    await expect(page.getByTestId('hub-featured')).toHaveAttribute('data-stage', 'baby');
  });

  for (const motion of ['no-preference', 'reduce'] as const) {
    // With less motion, a dragged fish used to swim back to the pool (PS-QA-09, fixed by #36).
    test(`fish dragged with a finger land in their nets (${motion === 'reduce' ? 'less motion' : 'normal motion'})`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: motion });
      await dragBoard(page);
      const nets = await boardOnScreen(page, CHILD);
      if (nets.kind !== 'fishing-nets') throw new Error(`a ${nets.kind} board`);
      for (const fish of nets.fish) {
        const net = rightNet(PACK.data, nets, fish);
        await fingerDrag(page, `fish-${fish.id}`, `net-${net}`);
        await expect(
          page.locator(`.ps-net-area[data-net="${net}"] [data-testid="fish-${fish.id}"]`),
          `${fish.text} dragged onto its net lands there`,
        ).toBeVisible({ timeout: 2_000 });
      }
    });
  }
});

/** A diver who played two lessons, on Slunná laguna 3's first board: Rybářské sítě. */
async function dragBoard(page: Page): Promise<void> {
  await seedFamily(page, await levelsPlayed(['sunny-lagoon.1', 'sunny-lagoon.2'], 'e2e-drag'));
  // Taps are covered above; here only the drags are a finger's.
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await openLevel(page, 'sunny-lagoon.3');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-board');
  await expect(page.getByTestId('screen-board')).toHaveAttribute('data-activity', 'fishing-nets');
}

/**
 * Drag `from` onto `to` with a finger (touch events, which the browser turns into pointer
 * events) where the engine can be driven so (Chromium), else with a mouse: the same pointer drag.
 */
async function fingerDrag(page: Page, from: string, to: string): Promise<void> {
  const a = (await page.getByTestId(from).boundingBox())!;
  const b = (await page.getByTestId(to).boundingBox())!;
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = await page
    .context()
    .newCDPSession(page)
    .catch(() => null);
  if (!cdp) {
    test.info().annotations.push({
      type: 'engine limitation',
      description: 'no touch drag to drive in this engine; the fish are dragged with a mouse',
    });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
    return;
  }
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(start.x, start.y),
  });
  for (let step = 1; step <= 10; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(
        start.x + ((end.x - start.x) * step) / 10,
        start.y + ((end.y - start.y) * step) / 10,
      ),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
