/**
 * The grade-4 pack (docs/app.md §11): the art of grade-4 regions is an offline pack of its own,
 * fetched and installed only once a child reaches grade 4, never on a first visit or for a 3rd
 * grader; without it, offline, grade-4 screens draw their labelled placeholders, never a broken
 * image and never a wait.
 *
 * Until S5's grade-4 art lands, the spec builds its own site with two stand-ins tagged `grade-4`
 * in the art catalog (`extraArt`, a test-only build option): the deep sea's map and Měsíční
 * jeskyně's scene. It serves that site from its own private server, which it shuts down to take
 * the network away, as offline.spec.ts does.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { buildSite } from '../../scripts/build.mjs';
import { serveDirectory } from '../../scripts/serve.mjs';
import { ART, DEPLOYMENT_BASE, OFFLINE_GRADE_FOUR_PACK_ID } from '../../src/rules/contract';
import { expect, test } from './support/fixtures';
import {
  createChild,
  fourthGraderPlaced,
  leaveScreen,
  seedChild,
  throughStory,
} from './support/game';
import { enterGrownUps, ready } from './support/screens';

test.use({ reducedMotion: 'reduce' });

const CHILD = 'profile-1';
const DEEP_MAP = ART.map('deep');
const MOON_CAVES = ART.scene('moon-caves');

/** A stand-in painting of 1664 × 928, as S5 paints scenes and maps. */
function standIn(label: string, colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1664 928" width="1664" height="928"><rect width="1664" height="928" fill="${colour}"/><text x="80" y="160" font-size="96" fill="#fff">${label}</text></svg>`;
}

const STAND_INS = [
  { id: DEEP_MAP, file: 'maps/test-grade-four-deep.svg', colour: '#0b2545' },
  { id: MOON_CAVES, file: 'scenes/test-grade-four-moon-caves.svg', colour: '#3c1e5a' },
];

let directory = '';
let siteDirectory = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  directory = mkdtempSync(join(tmpdir(), 'ps-grade-four-'));
  const site = await buildSite({
    outDir: join(directory, 'site'),
    base: DEPLOYMENT_BASE,
    extraArt: STAND_INS.map(({ id, file, colour }) => ({
      entry: { id, kind: 'painted', file, width: 1664, height: 928, pack: 'grade-4' },
      body: standIn(id, colour),
    })),
  });
  siteDirectory = site.directory;
});

test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

/** Every request for a grade-4 stand-in, page or worker, from now on. */
function gradeFourRequests(context: BrowserContext): string[] {
  const seen: string[] = [];
  context.on('request', (request) => {
    if (request.url().includes('test-grade-four-')) seen.push(request.url());
  });
  return seen;
}

/** Install the core pack from the grown-ups' area, then go back to the title. */
async function installCore(page: Page): Promise<void> {
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-offline').click();
  const status = page.getByTestId('offline-status');
  await expect(status).toHaveAttribute('data-state', 'missing');
  await page.getByTestId('offline-install').click();
  await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');
}

/** Whether the grade-4 pack is installed: published in the SDK's catalog, not merely staged. */
async function gradeFourCached(page: Page): Promise<boolean> {
  return page.evaluate(async (id) => {
    const catalog = await caches.open('aegis:pearl-sea:catalog');
    return (await catalog.keys()).some((request) => request.url.includes(`/${id}/`));
  }, OFFLINE_GRADE_FOUR_PACK_ID);
}

/** A family with a 4th grader past the placement check, its game never opened on this page. */
async function seedFourthGrader(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await ready(page, 'title');
  await seedChild(
    page,
    { id: CHILD, name: 'Tomáš', avatar: 'diver-5', address: 'boy' },
    await fourthGraderPlaced(),
  );
  await page.reload();
  await ready(page, 'title');
}

async function openDiver(page: Page): Promise<string> {
  await page.getByTestId('title-play').click();
  await ready(page, 'divers');
  await page.getByTestId(`diver-${CHILD}`).click();
  return throughStory(page);
}

/** The map, opened on the deep sea. */
async function deepMap(page: Page): Promise<void> {
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await page.getByTestId('map-tab-deep').click();
  await expect(page.locator('[data-testid="screen-map"] [data-sea="deep"]')).toBeVisible();
}

const mapPicture = (page: Page) => page.locator('.ps-map__picture');

test('a first visit, a 3rd grader and installing for offline play never fetch grade-4 art', async ({
  page,
  context,
  guard,
}) => {
  test.setTimeout(240_000);
  const server = await serveDirectory({ directory: () => siteDirectory });
  const url = server.url(DEPLOYMENT_BASE);
  guard.addOrigin(new URL(url).origin);
  const requested = gradeFourRequests(context);
  try {
    await page.goto(url);
    await ready(page, 'title');
    await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
    expect(await throughStory(page)).toBe('screen-eggs');
    await page.getByTestId('egg-krab-tvrdak').click();
    await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
    expect(await throughStory(page)).toBe('screen-hub');
    await page.getByTestId('place-map').click();
    await ready(page, 'map');
    await page.goto(url);
    await ready(page, 'title');
    await installCore(page);
    expect(await gradeFourCached(page), 'no grade-4 pack is installed').toBe(false);
    await page.goto(url);
    await ready(page, 'title');
    expect(await openDiver(page)).toBe('screen-hub');
    expect(await gradeFourCached(page), 'nor when a 3rd grader plays').toBe(false);
    expect(requested, 'grade-4 files requested').toEqual([]);
  } finally {
    await server.close();
  }
});

test('once a child reaches grade 4, its art is installed and drawn without the network', async ({
  page,
  context,
  guard,
}) => {
  test.setTimeout(240_000);
  const server = await serveDirectory({ directory: () => siteDirectory });
  const url = server.url(DEPLOYMENT_BASE);
  guard.addOrigin(new URL(url).origin);
  let running = true;
  const requested = gradeFourRequests(context);
  try {
    await seedFourthGrader(page, url);
    await installCore(page);
    expect(requested, 'nothing of grade 4 before the 4th grader plays').toEqual([]);
    expect(await openDiver(page)).toBe('screen-hub');
    await expect
      .poll(() => gradeFourCached(page), {
        message: 'the grade-4 pack is installed',
        timeout: 60_000,
      })
      .toBe(true);

    await server.close();
    running = false;
    await page.goto(url);
    await ready(page, 'title');
    expect(await openDiver(page)).toBe('screen-hub');
    await deepMap(page);
    await expect(mapPicture(page)).not.toHaveAttribute('data-placeholder', 'true');
    await expect
      .poll(() =>
        mapPicture(page)
          .locator('img')
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    const moonCaves = page.getByTestId('region-moon-caves');
    if (await moonCaves.isEnabled()) {
      await moonCaves.click();
      await ready(page, 'region');
      const scene = page.locator('.ps-region__picture');
      await expect(scene).not.toHaveAttribute('data-placeholder', 'true');
      await expect
        .poll(() =>
          scene
            .locator('img')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
    }
  } finally {
    if (running) await server.close();
  }
});

test('offline before the grade-4 pack is installed, grade-4 screens draw their placeholders', async ({
  page,
  guard,
}) => {
  test.setTimeout(240_000);
  const server = await serveDirectory({ directory: () => siteDirectory });
  const url = server.url(DEPLOYMENT_BASE);
  guard.addOrigin(new URL(url).origin);
  let running = true;
  // With the server gone the worker answers 503 for what it does not hold: the grade-4 graph the
  // shell tries to install and the deep sea's map; engines log a failed load to the console.
  guard.allow(
    'failed-request',
    /resource-graph-grade-4\.json|test-grade-four-/,
    'the grade-4 pack cannot be fetched without the network, on purpose',
  );
  guard.allow(
    'console',
    /503|Failed to load resource|resource-graph-grade-4|test-grade-four-/i,
    'engines log the grade-4 files the worker could not fetch without the network',
  );
  try {
    await seedFourthGrader(page, url);
    await installCore(page);
    await server.close();
    running = false;

    await page.goto(url);
    await ready(page, 'title');
    expect(await openDiver(page)).toBe('screen-hub');
    await deepMap(page);
    await expect(mapPicture(page)).toHaveAttribute('data-placeholder', 'true');
    await expect(mapPicture(page).locator('img'), 'no broken image').toHaveCount(0);
    await expect(mapPicture(page).locator('.ps-art__dev')).toHaveText(`DEV ${DEEP_MAP}`);
    expect(await gradeFourCached(page)).toBe(false);
    // The map still works: its region markers are there to tap.
    await expect(page.getByTestId('region-moon-caves')).toBeVisible();
  } finally {
    if (running) await server.close();
  }
});
