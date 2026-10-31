/**
 * The grown-ups' side of the shell in a real browser (Phase A of the app): the gate, the area in
 * Czech or English (kept in the family record), a child's settings and backup, offline
 * installation into this game's own caches, and the recovery screen for a family record that
 * cannot be read. Every screen passes axe's WCAG 2.1 A and AA rules.
 *
 * Stored records are written the way the shell writes them: the payloads come from the app's own
 * record code (src/app/persistence/records.ts) over the SDK's memory storage, then go into the
 * page's IndexedDB under the SDK's layout (database `pearl-sea`, store `saves`).
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { MemorySaveStorage } from '@aegis/browser/save';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FAMILY_RECORD } from '../../src/app/persistence/family';
import type { FamilyState } from '../../src/app/persistence/family';
import { recordPolicy, RecordStore } from '../../src/app/persistence/records';
import { SAVE_DATABASE } from '../../src/rules/contract';
import { observe } from './support/observe';

// Toasts and screens arrive with short fades; axe would measure a half-faded toast. The smoke
// suite keeps the default motion.
test.use({ reducedMotion: 'reduce' });

/**
 * Readiness waits longer than `expect`'s 10 s: Firefox's first IndexedDB open in a new context
 * takes seconds on a busy machine.
 */
async function ready(page: Page, screen: string): Promise<void> {
  const status = page.getByTestId('boot-status');
  await expect(status, 'the shell reports ready').toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
  await expect(status).toHaveAttribute('data-screen', screen);
}

async function noViolations(page: Page, what: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} | ` +
        violation.nodes
          .map((node) => `${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
          .join(' | '),
    ),
    `axe violations: ${what}`,
  ).toEqual([]);
}

/** Through the gate: hold the lock from the keyboard, then answer the question. */
async function enterGrownUps(page: Page): Promise<void> {
  await page.getByTestId('title-grownups').click();
  const hold = page.getByTestId('gate-hold');
  await expect(hold).toBeFocused();
  await page.keyboard.down(' ');
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible();
  await page.keyboard.up(' ');
  const a = Number(await question.getAttribute('data-a'));
  const b = Number(await question.getAttribute('data-b'));
  await page.keyboard.type(String(a * b));
  await page.keyboard.press('Enter');
  await ready(page, 'grownups');
}

/** The stored payload the shell itself would write for a family record. */
async function familyPayload(state: FamilyState): Promise<string> {
  const storage = new MemorySaveStorage();
  const store = new RecordStore(storage, FAMILY_RECORD);
  await store.load();
  await store.save(state);
  return (await storage.read(recordPolicy(FAMILY_RECORD))).current!.payload;
}

/** Put a family record into this game's database, as the SDK keeps it. */
async function storeFamily(page: Page, payload: string): Promise<void> {
  await page.evaluate(
    async ({ database, key, payload }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('saves', 'readwrite');
          transaction.objectStore('saves').put({ current: { revision: 1, payload } }, key);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    {
      database: SAVE_DATABASE,
      key: JSON.stringify([FAMILY_RECORD.gameId, FAMILY_RECORD.profileId]),
      payload,
    },
  );
}

test('the gate lets a grown-up in only after holding the lock and answering', async ({
  page,
  baseURL,
}) => {
  const seen = observe(page, new URL(baseURL!).origin);
  await page.goto('./');
  await ready(page, 'title');

  await page.getByTestId('title-grownups').click();
  await expect(page.getByTestId('grownups-gate')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('grownups-gate')).toHaveCount(0);
  await ready(page, 'title');

  await page.getByTestId('title-grownups').click();
  await expect(page.getByTestId('grownups-gate')).toHaveAttribute('lang', 'cs');
  await noViolations(page, 'the gate');
  await page.keyboard.down(' ');
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible();
  await page.keyboard.up(' ');
  await expect(question).toHaveText(/^Kolik je \d\d × \d\d\?$/);
  const first = await question.textContent();
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('gate-note')).toHaveText('To nesedí. Tady je jiný příklad.');
  await expect(question).not.toHaveText(first!);
  const a = Number(await question.getAttribute('data-a'));
  const b = Number(await question.getAttribute('data-b'));
  await page.keyboard.type(String(a * b));
  await page.keyboard.press('Enter');

  await ready(page, 'grownups');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pro dospělé');
  await expect(page.getByTestId('settings-none')).toBeVisible();
  await noViolations(page, 'the grown-ups’ area');
  await page.getByTestId('grownups-close').click();
  await ready(page, 'title');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
});

test('the grown-ups’ area speaks English when chosen, and keeps it, while the game stays Czech', async ({
  page,
}) => {
  await page.goto('./');
  await ready(page, 'title');
  await enterGrownUps(page);
  await page.getByTestId('grownups-language-en').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('For grown-ups');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('grownups-language-en')).toHaveAttribute('aria-pressed', 'true');
  await noViolations(page, 'the English grown-ups’ area');

  await page.reload();
  await ready(page, 'title');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.getByTestId('title-screen')).toContainText('češtinou');
  await page.getByTestId('title-grownups').click();
  await expect(page.getByTestId('grownups-gate')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('grownups-gate')).toContainText('For grown-ups only');
  await page.keyboard.press('Escape');
  await enterGrownUps(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('For grown-ups');
  await page.getByTestId('grownups-tab-about').click();
  await expect(page.getByTestId('about-version')).toHaveText(/^Version [0-9a-f]{8}$/);
});

test('a child’s settings are kept for that child, and a backup carries them', async ({ page }) => {
  await page.goto('./');
  await ready(page, 'title');
  await storeFamily(
    page,
    await familyPayload({
      profiles: [{ id: 'profile-1', name: 'Ema', avatar: 'diver-2', address: 'girl', grade: 3 }],
      grownUpsLanguage: 'cs',
    }),
  );
  await page.reload();
  await ready(page, 'title');
  await enterGrownUps(page);
  const settings = page.getByTestId('grownups-child-settings');
  await expect(settings).toContainText('Ema');
  await page.getByTestId('setting-text-200').click();
  await expect(page.getByTestId('setting-text-200')).toHaveAttribute('aria-pressed', 'true');
  // From the keyboard: the panel is rebuilt after the save, and the keyboard stays on the switch.
  const readAloud = page.getByTestId('setting-read-aloud');
  await readAloud.focus();
  await readAloud.evaluate((element) => element.setAttribute('data-before-save', ''));
  await page.keyboard.press('Space');
  const rebuilt = page.locator('[data-testid="setting-read-aloud"]:not([data-before-save])');
  await expect(rebuilt).not.toBeChecked();
  await expect(rebuilt).toBeFocused();
  await noViolations(page, 'a child’s settings');

  await page.reload();
  await ready(page, 'title');
  await enterGrownUps(page);
  await expect(page.getByTestId('setting-text-200')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('setting-read-aloud')).not.toBeChecked();

  await page.getByTestId('grownups-tab-data').click();
  const downloading = page.waitForEvent('download');
  await page.getByTestId('backup-export-profile-1').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^pearl-sea-ema-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(backup).toMatchObject({
    format: 'pearl-sea-backup',
    version: 1,
    diver: { name: 'Ema', avatar: 'diver-2', address: 'girl' },
    game: null,
    preferences: { profileId: 'profile-1', state: { readAloud: false } },
  });
  expect(backup.preferences.state.presentation.textScale).toBe(2);
});

test('the game installs for offline play into its own caches and scope', async ({ page }) => {
  await page.goto('./');
  await ready(page, 'title');
  await enterGrownUps(page);
  await page.getByTestId('grownups-tab-offline').click();
  const status = page.getByTestId('offline-status');
  await expect(status).toHaveAttribute('data-state', 'missing');
  await page.getByTestId('offline-install').click();
  await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(status).toHaveText('Hra je nainstalovaná a funguje i bez internetu.');
  const installed = await page.evaluate(async () => ({
    caches: await caches.keys(),
    scopes: (await navigator.serviceWorker.getRegistrations()).map(
      (registration) => new URL(registration.scope).pathname,
    ),
  }));
  expect(installed.scopes).toEqual(['/pearl-sea/']);
  expect(installed.caches.length).toBeGreaterThan(0);
  for (const name of installed.caches) expect(name.startsWith('aegis:pearl-sea:'), name).toBe(true);
});

test('a family record that cannot be read asks a grown-up and replaces nothing by itself', async ({
  page,
}) => {
  await page.goto('./');
  await ready(page, 'title');
  await storeFamily(page, '{"broken": true');
  await page.reload();
  await ready(page, 'recovery');
  const recovery = page.getByTestId('screen-recovery');
  await expect(recovery).toHaveAttribute('data-kind', 'family');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Uložená data nejdou otevřít');
  await expect(page.getByTestId('recovery-code')).toHaveText('Kód chyby: invalid-data');
  await noViolations(page, 'the recovery screen');

  await page.getByTestId('recovery-language-en').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The saved data cannot be opened',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByTestId('recovery-retry').click();
  await expect(page.getByTestId('recovery-status')).toHaveText(
    'That did not work. Nothing was changed.',
  );
  await ready(page, 'recovery');

  await page.getByTestId('recovery-reset').click();
  await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('lang', 'en');
  await page.getByTestId('confirm-ok').click();
  await ready(page, 'title');
  await page.reload();
  await ready(page, 'title');
});
