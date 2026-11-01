/**
 * Same-origin isolation in real browsers. Dragon Valley's storage is seeded into this origin under
 * the names Dragon Valley really uses (IndexedDB database `dragon-valley` with the SDK's `saves`
 * store, caches `aegis:dragon-valley:…`), then Perlové moře boots again. Everything Dragon Valley
 * stored must still be there unchanged, and everything this game stored must carry this game's
 * names: the `pearl-sea` database, `aegis:pearl-sea:` caches and the `/pearl-sea/` worker scope.
 *
 * test/unit/persistence/origin-isolation.test.ts proves the names themselves cannot collide.
 */
import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';

interface Storage {
  databases: string[] | null;
  dragonSave: unknown;
  caches: string[];
  dragonFiles: Record<string, string>;
  /** Whether the engine kept the test's own control entry across navigations. */
  keepsCacheEntries: boolean;
  localStorage: number;
  workerScopes: string[];
}

const DRAGON_SAVE = { revision: 7, payload: 'Bubbles the dragon, level 3' };
const DRAGON_FILES = {
  'aegis:dragon-valley:catalog': ['/dragon-valley/.aegis/dragon-valley/dragon-valley/dv-1', '{}'],
  'aegis:dragon-valley:pack:dragon-valley:dv-1:seed': [
    '/dragon-valley/index.html',
    '<p>Dragon Valley</p>',
  ],
} as const;
/** A cache only this test writes: it shows whether the engine keeps cache entries at all. */
const CONTROL = ['isolation-test-control', '/isolation-test-control', 'control'] as const;

async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
}

/** Store Dragon Valley's save and offline files exactly where Dragon Valley keeps them. */
async function seedDragonValley(page: Page): Promise<void> {
  await page.evaluate(
    async ({ save, files }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('dragon-valley', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('saves', 'readwrite');
          transaction
            .objectStore('saves')
            .put(save, JSON.stringify(['dragon-valley', 'profile-1']));
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
      for (const [name, [path, body]] of Object.entries(files)) {
        const cache = await caches.open(name);
        await cache.put(new URL(path, location.origin).href, new Response(body));
      }
    },
    {
      save: DRAGON_SAVE,
      files: { ...DRAGON_FILES, [CONTROL[0]]: [CONTROL[1], CONTROL[2]] as const },
    },
  );
}

/** Everything on the origin, as this page sees it. */
async function readStorage(page: Page): Promise<Storage> {
  return page.evaluate(
    async ({ files, control }) => {
      const dragonSave = await new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('dragon-valley', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction('saves', 'readonly')
            .objectStore('saves')
            .get(JSON.stringify(['dragon-valley', 'profile-1']));
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => reject(read.error);
        };
      });
      const entry = async (name: string, path: string) => {
        const response = await (await caches.open(name)).match(new URL(path, location.origin).href);
        return response ? await response.text() : '(missing)';
      };
      const dragonFiles: Record<string, string> = {};
      for (const [name, [path]] of Object.entries(files)) {
        dragonFiles[name] = await entry(name, path);
      }
      const databases =
        typeof indexedDB.databases === 'function'
          ? (await indexedDB.databases()).map((database) => database.name ?? '').sort()
          : null;
      const workerScopes = navigator.serviceWorker
        ? (await navigator.serviceWorker.getRegistrations()).map(
            (registration) => new URL(registration.scope).pathname,
          )
        : [];
      return {
        databases,
        dragonSave,
        caches: (await caches.keys()).sort(),
        dragonFiles,
        keepsCacheEntries: (await entry(control[0], control[1])) === control[2],
        localStorage: localStorage.length,
        workerScopes,
      };
    },
    { files: DRAGON_FILES, control: CONTROL },
  );
}

test('booting leaves Dragon Valley’s saves and offline files untouched', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await seedDragonValley(page);

  await page.reload();
  await ready(page);
  const second = await page.context().newPage();
  await second.goto('./');
  await ready(second);

  const storage = await readStorage(second);
  expect(storage.dragonSave, 'Dragon Valley’s save').toEqual(DRAGON_SAVE);
  for (const name of Object.keys(DRAGON_FILES)) {
    expect(storage.caches, 'Dragon Valley’s caches are never deleted').toContain(name);
  }
  if (storage.keepsCacheEntries) {
    expect(storage.dragonFiles, 'Dragon Valley’s offline files').toEqual(
      Object.fromEntries(Object.entries(DRAGON_FILES).map(([name, [, body]]) => [name, body])),
    );
  } else {
    // Playwright's WebKit keeps cache names but drops their entries on navigation in its
    // ephemeral contexts, even for a cache no game code touches (the control). The entries are
    // compared on the engines that keep them; the names prove nothing was deleted here.
    test.info().annotations.push({
      type: 'engine limitation',
      description: 'Cache Storage entries do not survive navigation; compared cache names only.',
    });
  }
  for (const name of storage.caches) {
    expect(
      name === CONTROL[0] ||
        name.startsWith('aegis:pearl-sea:') ||
        name.startsWith('aegis:dragon-valley:'),
      `cache ${name}`,
    ).toBe(true);
  }
  for (const name of storage.databases ?? []) {
    expect(name === 'dragon-valley' || /^pearl-sea(-|$)/.test(name), `database ${name}`).toBe(true);
  }
  for (const scope of storage.workerScopes) {
    expect(scope.startsWith('/pearl-sea/') || scope.startsWith('/dragon-valley/'), scope).toBe(
      true,
    );
  }
  expect(storage.localStorage, 'this game writes nothing to localStorage').toBe(0);
});
