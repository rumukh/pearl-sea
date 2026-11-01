/**
 * Offline play (docs/app.md §11, plan §0): a grown-up installs the game for offline play; after
 * that, with the network gone, the game opens from the device, a child plays and what they play
 * is still saved.
 *
 * "The network gone" is real here, not emulated: the test serves the built site from its own
 * private server, installs, then shuts that server down. Every later request either comes from
 * the offline worker or fails, and the guard fails the test on any failed request. The browser's
 * emulated offline mode is checked too where the engine lets a service worker answer it (WebKit's
 * emulation stops navigations before the worker sees them, which a real device does not).
 */
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
// The project's own static server (scripts/serve.mjs), serving the build the web server made.
import { serveDirectory } from '../../scripts/serve.mjs';
import { expect, test } from './support/fixtures';
import { createChild, leaveScreen, solveBoards, throughStory } from './support/game';
import { enterGrownUps, ready } from './support/screens';
import { siteFolder } from './support/site';
import { CHILD, pastResults } from './support/tour';

test.use({ reducedMotion: 'reduce' });

const status = (page: Page) => page.getByTestId('offline-status');

async function controlled(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.serviceWorker?.controller !== null);
}

/** A new diver who chose an egg and is back at the grotto. */
async function newDiver(page: Page): Promise<void> {
  await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
  expect(await throughStory(page)).toBe('screen-eggs');
  await page.getByTestId('egg-krab-tvrdak').click();
  await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
  expect(await throughStory(page)).toBe('screen-hub');
}

/** Install from the grown-ups' area; returns every progress line the status showed. */
async function install(page: Page): Promise<string[]> {
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-offline').click();
  await expect(status(page)).toHaveAttribute('data-state', 'missing');
  await expect(status(page)).toHaveText('Hra zatím není nainstalovaná pro hraní bez internetu.');
  await status(page).evaluate((node) => {
    const seen: string[] = [];
    (window as unknown as { __psQaOffline: string[] }).__psQaOffline = seen;
    new MutationObserver(() => seen.push(node.textContent ?? '')).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.getByTestId('offline-install').click();
  await expect(status(page)).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(status(page)).toHaveText('Hra je nainstalovaná a funguje i bez internetu.');
  const progress = await page.evaluate(
    () => (window as unknown as { __psQaOffline: string[] }).__psQaOffline,
  );
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  return progress;
}

/** Open the family's first child from a fresh start: resolves to the screen the game shows. */
async function openDiver(page: Page): Promise<string> {
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  return throughStory(page);
}

async function coins(page: Page): Promise<number> {
  return Number((await page.getByTestId('coins').textContent())!.replace(/\D/g, ''));
}

test('installed for offline play, the game opens and saves after the server is gone', async ({
  page,
  guard,
}, testInfo) => {
  test.setTimeout(240_000);
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  const server = await serveDirectory({ directory: () => join(root, siteFolder()) });
  const url = server.url('/pearl-sea/');
  guard.addOrigin(new URL(url).origin);
  let running = true;
  try {
    await page.goto(url);
    await ready(page, 'title');
    await newDiver(page);
    await page.getByTestId('hub-goodbye').click();
    await page.getByTestId('goodbye-bye').click();
    const progress = await install(page);
    expect(
      // A one-letter word is bound to the next by a no-break space (Czech typography).
      progress.some((text) => /^Stahuji soubory: \d+ z\u00a0\d+…$/.test(text)),
      `progress was shown: ${JSON.stringify([...new Set(progress)])}`,
    ).toBe(true);
    await page.getByTestId('offline-update').click();
    await expect(status(page), 'checking finds this very version').toHaveText(
      'Máte nejnovější verzi.',
    );
    await page.getByTestId('grownups-close').click();

    await server.close();
    running = false;
    await page.goto(url);
    await ready(page, 'title');
    expect(await controlled(page), 'the offline worker serves the page').toBe(true);
    expect(await openDiver(page)).toBe('screen-hub');
    const before = await coins(page);
    await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
    expect(await throughStory(page)).toBe('screen-board');
    expect(await solveBoards(page, CHILD)).toBe('screen-results');
    // On to the lesson's next game, which shows the save status and the purse.
    expect(await pastResults(page)).toBe('screen-board');
    await expect(page.getByTestId('save-status')).toContainText('Uloženo');
    const earned = await coins(page);
    expect(earned, 'coins earned offline').toBeGreaterThan(before);

    // A second cold start, still without a server, resumes the same game with its coins.
    await page.goto(url);
    expect(await openDiver(page)).toBe('screen-board');
    expect(await coins(page), 'coins earned offline are kept').toBe(earned);
  } finally {
    if (running) await server.close();
  }
});

test('installed, the game also opens in the browser’s offline mode', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit’s emulated offline mode fails navigations before the service worker sees them (a real device does not); the test above covers WebKit with the server gone',
  );
  test.setTimeout(180_000);
  await page.goto('./');
  await ready(page, 'title');
  await newDiver(page);
  await page.getByTestId('hub-goodbye').click();
  await page.getByTestId('goodbye-bye').click();
  await install(page);
  await page.getByTestId('grownups-close').click();
  await context.setOffline(true);
  try {
    await page.reload();
    await ready(page, 'title');
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await controlled(page)).toBe(true);
    expect(await openDiver(page)).toBe('screen-hub');
    await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
    expect(await throughStory(page)).toBe('screen-board');
  } finally {
    await context.setOffline(false);
  }
});

test('a browser that cannot install says so, and the game still works online', async ({
  page,
  context,
}) => {
  // Without service workers there is nothing to install with.
  await context.addInitScript(() => {
    delete (Navigator.prototype as unknown as { serviceWorker?: unknown }).serviceWorker;
  });
  await page.goto('./');
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-offline').click();
  await expect(status(page)).toHaveAttribute('data-state', 'unavailable');
  await expect(status(page)).toHaveText(
    'Tento prohlížeč neumí hru nainstalovat. Hrát se dá jen s internetem.',
  );
  await expect(page.getByTestId('offline-install')).toHaveCount(0);
});
