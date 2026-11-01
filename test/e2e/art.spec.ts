/**
 * S5's next paintings drop in without code changes. `support/art.ts` serves stand-ins of the real
 * formats for the batch S5 paints next, and the game is played with them:
 *
 * - each is drawn from the catalog, never as a placeholder;
 * - the title, the grotto and the lagoon are backdrops that cover their screens;
 * - on paintings of 1664 × 928, the map's region markers and the lagoon's level nodes keep the
 *   spots S5 paints open water at (`game/map.ts`);
 * - the inked and the freed Muréna stand on the same ground, however each is trimmed;
 * - Osmička cheers beside the results of a finished round;
 * - no text sits straight on a painting, and every screen passes axe;
 * - on a slow connection the title's painting is fetched while the content loads, so the title is
 *   there with it, and a painting that arrives after its screen fades in (none with less motion).
 */
import type { Page } from '@playwright/test';
import { levelSpots, regionSpot } from '../../src/app/game/map';
import { ART, GUIDE_ID } from '../../src/rules/contract';
import { drawnRects, NEXT_ART, painted, rehearseNextArt, textOffPaper } from './support/art';
import {
  lagoonPlayed,
  leaveScreen,
  PACK,
  playRound,
  seedChild,
  throughStory,
} from './support/game';
import { observe } from './support/observe';
import { noViolations, ready } from './support/screens';
import { expect, test } from './support/fixtures';

test.use({ reducedMotion: 'reduce' });

const CHILD = 'profile-1';

/** The screen on the stage is drawn over a painting: its text is on paper and axe passes. */
async function onPaper(page: Page, scope: string, what: string): Promise<void> {
  expect(await textOffPaper(page, scope), `text straight on the painting: ${what}`).toEqual([]);
  await noViolations(page, what);
}

/** A backdrop painting fills its whole screen, cropped rather than letterboxed. */
async function covers(page: Page, screen: string): Promise<void> {
  const fit = await page
    .getByTestId(screen)
    .locator('.ps-backdrop img')
    .evaluate((image) => {
      const shown = image.getBoundingClientRect();
      const screen = image.closest('main')!.getBoundingClientRect();
      return {
        fit: getComputedStyle(image).objectFit,
        covers:
          shown.left <= screen.left + 1 &&
          shown.top <= screen.top + 1 &&
          shown.right >= screen.right - 1 &&
          shown.bottom >= screen.bottom - 1,
      };
    });
  expect(fit, `the backdrop of ${screen}`).toEqual({ fit: 'cover', covers: true });
}

/** Where markers sit on a painting, in thousandths of the painting's drawn box. */
async function spotsOn(page: Page, picture: string, markers: string): Promise<number[][]> {
  const [box] = await drawnRects(page, picture);
  return page.locator(markers).evaluateAll(
    (elements, box) =>
      elements.map((element) => {
        const at = element.getBoundingClientRect();
        const x = (at.left + at.width / 2 - box!.left) / (box!.right - box!.left);
        const y = (at.top + at.height / 2 - box!.top) / (box!.bottom - box!.top);
        return [Math.round(x * 1000), Math.round(y * 1000)];
      }),
    box,
  );
}

function near(actual: number[][], expected: { x: number; y: number }[], what: string): void {
  expect(actual.length, what).toBe(expected.length);
  for (const [index, [x, y]] of actual.entries()) {
    expect(Math.abs(x! - expected[index]!.x), `${what} ${index}: x`).toBeLessThanOrEqual(4);
    expect(Math.abs(y! - expected[index]!.y), `${what} ${index}: y`).toBeLessThanOrEqual(4);
  }
}

test('S5’s next paintings drop in without code changes', async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const seen = observe(page, new URL(baseURL!).origin);
  await rehearseNextArt(page);
  const lagoon = await lagoonPlayed();

  // The title on its painting.
  await page.goto('./');
  await ready(page, 'title');
  await expect(painted(page, ART.scene('title'))).toBeVisible();
  await covers(page, 'title-screen');
  await onPaper(page, '[data-testid="title-screen"]', 'the title');

  // The grotto, with the lagoon's baby friend.
  await seedChild(page, { id: CHILD, name: 'Ema', avatar: 'diver-2', address: 'girl' }, lagoon);
  await page.reload();
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  await expect(painted(page, ART.scene('grotto'))).toBeVisible();
  await covers(page, 'screen-hub');
  await expect(painted(page, ART.friend('krab-tvrdak', 'baby')).first()).toBeVisible();
  await onPaper(page, '[data-testid="screen-hub"]', 'the grotto');

  // The shallows map: each region's marker on its spot.
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await expect(painted(page, ART.map('shallows'))).toBeVisible();
  const shallows = PACK.data.regions
    .filter((region) => region.map === 'shallows')
    .sort((a, b) => a.order - b.order);
  near(
    await spotsOn(page, '.ps-map__picture', '.ps-map__region'),
    shallows.map((region, index) => regionSpot(region.id, index, shallows.length)),
    'region marker',
  );
  await onPaper(page, '[data-testid="map-board"]', 'the shallows map');

  // Slunná laguna: the level nodes on their spots.
  await page.getByTestId('region-sunny-lagoon').click();
  await ready(page, 'region');
  await expect(painted(page, ART.scene('sunny-lagoon'))).toBeVisible();
  const levels = PACK.data.levels.filter((level) => level.region === 'sunny-lagoon');
  near(
    await spotsOn(page, '.ps-region__picture', '.ps-level-node'),
    levelSpots(levels.length),
    'level node',
  );
  await onPaper(page, '[data-testid="region-board"]', 'the lagoon');

  // The battle: the inked and the freed Muréna stand on the same ground.
  await page.getByTestId('level-sunny-lagoon.monster').click();
  await ready(page, 'level');
  await leaveScreen(page, 'screen-level', () => page.getByTestId('level-start').click());
  expect(await throughStory(page)).toBe('screen-round');
  await covers(page, 'screen-round');
  await expect(painted(page, ART.monster('murena-mumla', 'freed'))).toHaveCount(1);
  const [freed, inked] = await drawnRects(page, '[data-testid="battle-monster"] [data-art-id]');
  expect(Math.abs(freed!.bottom - inked!.bottom), 'the forms share their ground').toBeLessThan(1.5);
  expect(
    Math.abs(freed!.left + freed!.right - inked!.left - inked!.right) / 2,
    'the forms share their centre',
  ).toBeLessThan(1.5);
  await onPaper(page, '[data-testid="screen-round"]', 'the battle');

  // Washed clean: the freed painting, then Osmička cheering beside the results.
  await playRound(page, CHILD);
  expect(await throughStory(page)).toBe('screen-results');
  await expect(
    page
      .getByTestId('moment-freed')
      .locator(`[data-art-id="${ART.monster('murena-mumla', 'freed')}"] img`),
  ).toBeVisible();
  await onPaper(page, '[data-testid="screen-results"]', 'the freeing');
  for (let guard = 0; guard < 5 && (await page.getByTestId('moment-next').count()) > 0; guard++) {
    await page.getByTestId('moment-next').click();
  }
  await expect(painted(page, ART.character(GUIDE_ID, 'happy'))).toBeVisible();
  await onPaper(page, '[data-testid="screen-results"]', 'the results');
  await leaveScreen(page, 'screen-results', () => page.getByTestId('results-next').click());
  expect(await throughStory(page)).toBe('screen-hub');

  // Goodbye, over the grotto.
  await page.getByTestId('hub-goodbye').click();
  await expect(page.getByTestId('screen-goodbye')).toBeVisible();
  await covers(page, 'screen-goodbye');
  await onPaper(page, '[data-testid="screen-goodbye"]', 'goodbye');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
});

// ------------------------------------------------------------------------------ a slow connection

/** The title's painting among the stand-ins. */
const TITLE = NEXT_ART.find((art) => art.id === ART.scene('title'))!;
const TITLE_URL = `**/assets/art/${TITLE.file}`;

/** Hold every request for `url` back for `ms`, then let it go on as it would. */
async function slowly(page: Page, url: string, ms: number): Promise<void> {
  await page.route(url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fallback();
  });
}

/** Hold every request for `url` back until the returned function lets them go. */
async function heldBack(page: Page, url: string): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await released;
    await route.fallback();
  });
  return release;
}

interface ShownAtReady {
  readonly complete: boolean;
  readonly width: number;
}

/** Note, in the page, how the title's painting is drawn the moment the boot status says ready. */
async function noteTitleAtReady(page: Page): Promise<() => Promise<ShownAtReady | null>> {
  await page.addInitScript((id) => {
    const scope = globalThis as { psTitleAtReady?: ShownAtReady | null };
    scope.psTitleAtReady = null;
    new MutationObserver(() => {
      const status = document.querySelector('[data-testid="boot-status"]');
      if (scope.psTitleAtReady || status?.getAttribute('data-state') !== 'ready') return;
      const image = document.querySelector<HTMLImageElement>(`[data-art-id="${id}"] img`);
      scope.psTitleAtReady = {
        complete: image?.complete ?? false,
        width: image?.naturalWidth ?? 0,
      };
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
  }, ART.scene('title'));
  return () =>
    page.evaluate(
      () => (globalThis as { psTitleAtReady?: ShownAtReady | null }).psTitleAtReady ?? null,
    );
}

test('on a slow connection the title is there with its painting, fetched while the content loads', async ({
  page,
}) => {
  // S6's PS-QA-20: the title used to ask for its painting only once it was built, and showed bare
  // sea until the painting popped in.
  await rehearseNextArt(page);
  const asked: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith(`/assets/art/${TITLE.file}`)) asked.push(request.url());
  });
  // Registered after the rehearsal, these run first: the painting is slow, the content slower.
  await slowly(page, TITLE_URL, 1500);
  await slowly(page, '**/content/pearl-sea.content.json', 3000);
  const atReady = await noteTitleAtReady(page);
  await page.goto('./');
  await ready(page, 'title');
  expect(await atReady(), 'the title’s painting when the title appears').toEqual({
    complete: true,
    width: TITLE.width,
  });
  // The title's own picture is the painting the page already has.
  expect(asked).toHaveLength(1);
});

test('with less motion a painting that arrives after its screen is simply there', async ({
  page,
}) => {
  await rehearseNextArt(page);
  const release = await heldBack(page, TITLE_URL);
  // A held painting may hold back the page's load event (WebKit), so wait for the boot status.
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await ready(page, 'title');
  const painting = painted(page, ART.scene('title'));
  release();
  await expect(painting).toHaveAttribute('data-late', 'true');
  await expect
    .poll(() => painting.evaluate((image) => (image as HTMLImageElement).complete))
    .toBe(true);
  expect(await painting.evaluate((image) => getComputedStyle(image).animationName)).toBe('none');
  expect(await painting.evaluate((image) => getComputedStyle(image).opacity)).toBe('1');
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a painting that arrives after its screen is shown fades in, never pops in', async ({
    page,
  }) => {
    await rehearseNextArt(page);
    const release = await heldBack(page, TITLE_URL);
    // A held painting may hold back the page's load event (WebKit), so wait for the boot status.
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await ready(page, 'title');
    const painting = painted(page, ART.scene('title'));
    // The title is shown, its painting still on its way.
    expect(await painting.evaluate((image) => (image as HTMLImageElement).complete)).toBe(false);
    expect(await painting.getAttribute('data-late')).toBeNull();
    release();
    await expect(painting).toHaveAttribute('data-late', 'true');
    expect(await painting.evaluate((image) => getComputedStyle(image).animationName)).toBe(
      'ps-art-in',
    );
  });
});
