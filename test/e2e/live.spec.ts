/**
 * The deployed game at https://rumukh.github.io/pearl-sea/ (or `PS_E2E_LIVE_URL`), checked from
 * outside before a playtest or a release (docs/qa/release.md): it boots into the Czech title with
 * nothing foreign and nothing failing, GitHub Pages sends its text compressed, the first tap
 * starts the music, and once installed for offline play it opens and plays with the network gone.
 *
 * It needs the internet, so it runs only when asked: `PS_E2E_LIVE=1 npm run test:e2e --
 * live.spec.ts`. Every other run skips it, saying why.
 */
import { expect, test } from './support/fixtures';
import { createChild, leaveScreen, throughStory } from './support/game';
import { enterGrownUps, ready } from './support/screens';
import { fetchedSound, soundAfterFirstTap, soundFiles } from './support/sound';

const LIVE = process.env['PS_E2E_LIVE_URL'] ?? 'https://rumukh.github.io/pearl-sea/';
const ASKED = process.env['PS_E2E_LIVE'] === '1';
/** The music the title and the editor ask for once the first tap has unlocked the sound. */
const GROTTO_LOOP = '/assets/audio/music/grotto.ogg';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ guard }) => {
  test.skip(
    !ASKED,
    'The deployed site is checked only on request (PS_E2E_LIVE=1): it needs the internet.',
  );
  guard.addOrigin(new URL(LIVE).origin);
});

test('the deployed game boots into the Czech title, its text sent compressed', async ({ page }) => {
  const encodings: Record<string, string> = {};
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (/\.(js|css|json)$/.test(url.pathname)) {
      encodings[url.pathname] = response.headers()['content-encoding'] ?? 'none';
    }
  });
  await page.goto(LIVE);
  await ready(page, 'title');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perlové moře');
  await page.waitForLoadState('networkidle');
  const files = Object.keys(encodings);
  expect(files.length, 'the script, the style and the content were fetched').toBeGreaterThan(2);
  for (const file of files) {
    expect(encodings[file], `${file} is sent compressed`).not.toBe('none');
  }
});

test('the deployed game’s first tap starts its music', async ({ page, browserName }) => {
  const sounds = soundFiles(page);
  await page.goto(LIVE);
  await ready(page, 'title');
  await page.getByTestId('title-play').click();
  if ((await soundAfterFirstTap(page, browserName)) === 'ready') {
    await fetchedSound(sounds, GROTTO_LOOP);
  }
});

test('installed for offline play, the deployed game opens and plays without the network', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit’s emulated offline mode fails navigations before the service worker sees them; offline.spec.ts covers WebKit with its server gone',
  );
  test.setTimeout(240_000);
  await page.goto(LIVE);
  await ready(page, 'title');
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-offline').click();
  const status = page.getByTestId('offline-status');
  await page.getByTestId('offline-install').click();
  await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 120_000 });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');

  await context.setOffline(true);
  try {
    await page.reload();
    await ready(page, 'title');
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller !== null),
      'the offline worker serves the page',
    ).toBe(true);
    await createChild(page, { name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 });
    expect(await throughStory(page)).toBe('screen-eggs');
    await page.locator('[data-testid^="egg-"]').first().click();
    await leaveScreen(page, 'screen-eggs', () => page.getByTestId('eggs-next').click());
    expect(await throughStory(page)).toBe('screen-hub');
    await leaveScreen(page, 'screen-hub', () => page.getByTestId('adventure').click());
    expect(await throughStory(page)).toBe('screen-board');
    await expect(
      page.getByTestId('boot-status'),
      'the music plays offline too, from the installed pack',
    ).toHaveAttribute('data-audio', browserName === 'chromium' ? 'ready' : /^(ready|blocked)$/);
  } finally {
    await context.setOffline(false);
  }
});
