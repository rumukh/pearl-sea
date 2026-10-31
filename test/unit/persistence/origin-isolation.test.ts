/**
 * Same-origin isolation from Dragon Valley.
 *
 * Perlové moře (https://rumukh.github.io/pearl-sea/) and Dragon Valley
 * (https://rumukh.github.io/dragon-valley/) are one origin. IndexedDB, Cache Storage, Web Locks
 * and service-worker registrations are shared by the whole origin and told apart only by name or
 * scope, so neither game may be able to read, evict or overwrite the other's saves or offline
 * files. These tests prove it three ways:
 *
 * 1. every storage name of this game is in the `pearl-sea` namespace and cannot equal, extend or
 *    be extended by one of Dragon Valley's names (pinned below from dragon-valley@13c1482);
 * 2. the real SDK offline store, sharing one CacheStorage with Dragon Valley's installed pack,
 *    installs, lists, fails and removes this game's packs without touching a byte of Dragon
 *    Valley's, and this game's worker refuses Dragon Valley's paths;
 * 3. src/ reaches browser storage only through the SDK, with this game's names.
 *
 * test/e2e/isolation.spec.ts checks the same in real browsers.
 */
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { OfflinePackStore } from '@aegis/browser/offline';
import type { OfflinePack } from '@aegis/browser/offline';
import { createOfflineFetchHandler } from '@aegis/browser/offline/worker';
import { beforeEach, describe, expect, it } from 'vitest';
import * as persistence from '../../../src/rules/contract/persistence';
import {
  ADAPTER_ID,
  BACKUP_FORMAT,
  DAY_GAME_ID,
  DEPLOYMENT_BASE,
  FAMILY_GAME_ID,
  GAME_ID,
  OFFLINE_ERROR_MESSAGE,
  OFFLINE_NAMESPACE,
  OFFLINE_PACK_ID,
  PREFERENCES_GAME_ID,
  PROFILE_IDS,
  SAVE_DATABASE,
  STORAGE_NAMESPACE,
  profileSeed,
} from '../../../src/rules/contract';
import * as site from '../../../scripts/lib/site.mjs';

const root = join(import.meta.dirname, '..', '..', '..');
const ORIGIN = 'https://rumukh.github.io';

/** Dragon Valley's storage names at dragon-valley@13c1482 (src/rules/contract/persistence.ts, …). */
const DRAGON_VALLEY = {
  base: '/dragon-valley/',
  adapterId: 'dragon-valley',
  saveDatabase: 'dragon-valley',
  gameIds: [
    'dragon-valley',
    'dragon-valley-family',
    'dragon-valley-preferences',
    'dragon-valley-day',
  ],
  offlinePackId: 'dragon-valley',
  offlineNamespace: 'dragon-valley',
  offlineErrorMessage: 'dv-offline-error',
  backupFormat: 'dragon-valley-backup',
} as const;

/** The SDK default database name, which a game that forgets to pass its own would share. */
const SDK_DEFAULT_DATABASE = 'aegis-saves';

/** The prefix @aegis/browser derives from an offline namespace for caches and Web Locks. */
const sdkPrefix = (namespace: string) => `aegis:${namespace}:`;

const OURS: Record<string, string> = {
  STORAGE_NAMESPACE,
  ADAPTER_ID,
  SAVE_DATABASE,
  GAME_ID,
  FAMILY_GAME_ID,
  PREFERENCES_GAME_ID,
  DAY_GAME_ID,
  OFFLINE_PACK_ID,
  OFFLINE_NAMESPACE,
  OFFLINE_ERROR_MESSAGE,
  BACKUP_FORMAT,
};
const THEIRS: string[] = [
  DRAGON_VALLEY.adapterId,
  DRAGON_VALLEY.saveDatabase,
  ...DRAGON_VALLEY.gameIds,
  DRAGON_VALLEY.offlinePackId,
  DRAGON_VALLEY.offlineNamespace,
  DRAGON_VALLEY.offlineErrorMessage,
  DRAGON_VALLEY.backupFormat,
];

describe('every storage name belongs to this game', () => {
  it('is pearl-sea or starts with pearl-sea-', () => {
    expect(STORAGE_NAMESPACE).toBe('pearl-sea');
    for (const [name, value] of Object.entries(OURS)) {
      expect(
        value === STORAGE_NAMESPACE || value.startsWith(`${STORAGE_NAMESPACE}-`),
        `${name} = ${value}`,
      ).toBe(true);
    }
    for (const profile of PROFILE_IDS) {
      expect(profileSeed(profile)).toBe(`pearl-sea:${profile}`);
    }
  });

  it('checks every string constant of the persistence contract', () => {
    // A new storage name added to src/rules/contract/persistence.ts must join the checks below.
    const exported = Object.entries(persistence)
      .filter(([, value]) => typeof value === 'string')
      .map(([name]) => name)
      .filter((name) => name !== 'DEPLOYMENT_BASE' && name !== 'FAMILY_PROFILE_ID');
    expect(exported.sort()).toEqual(Object.keys(OURS).sort());
  });

  it('never equals, extends or is extended by one of Dragon Valley’s names', () => {
    for (const [name, ours] of Object.entries(OURS)) {
      for (const theirs of THEIRS) {
        expect(ours, `${name} vs ${theirs}`).not.toBe(theirs);
        expect(ours.startsWith(theirs), `${name} extends ${theirs}`).toBe(false);
        expect(theirs.startsWith(ours), `${theirs} extends ${name}`).toBe(false);
      }
    }
  });

  it('opens its own IndexedDB database, never the SDK default every game would share', () => {
    expect(SAVE_DATABASE).not.toBe(SDK_DEFAULT_DATABASE);
    expect(SAVE_DATABASE).not.toBe(DRAGON_VALLEY.saveDatabase);
  });

  it('gives the SDK an offline namespace whose cache and lock prefix cannot overlap Dragon Valley’s', () => {
    // Identifiers may contain ":"; without one, `aegis:<namespace>:` names exactly one namespace.
    expect(OFFLINE_NAMESPACE).toMatch(/^[a-z0-9-]+$/);
    const ours = sdkPrefix(OFFLINE_NAMESPACE);
    const theirs = sdkPrefix(DRAGON_VALLEY.offlineNamespace);
    expect(ours.startsWith(theirs)).toBe(false);
    expect(theirs.startsWith(ours)).toBe(false);
  });

  it('scopes the offline worker to its own folder, never the whole origin', () => {
    expect(DEPLOYMENT_BASE).toBe('/pearl-sea/');
    expect(DEPLOYMENT_BASE.startsWith(DRAGON_VALLEY.base)).toBe(false);
    expect(DRAGON_VALLEY.base.startsWith(DEPLOYMENT_BASE)).toBe(false);
    const pages = readFileSync(join(root, '.github', 'workflows', 'pages.yml'), 'utf8');
    const bases = [...pages.matchAll(/--base (\S+)/g)].map((match) => match[1]);
    expect(bases.length, 'pages.yml builds and checks with an explicit base').toBeGreaterThan(1);
    expect(new Set(bases)).toEqual(new Set([DEPLOYMENT_BASE]));
  });

  it('builds the worker with the same pack ID, namespace and message as the contract', () => {
    expect(site.OFFLINE_PACK_ID).toBe(OFFLINE_PACK_ID);
    expect(site.OFFLINE_NAMESPACE).toBe(OFFLINE_NAMESPACE);
    expect(site.OFFLINE_ERROR_MESSAGE).toBe(OFFLINE_ERROR_MESSAGE);
  });
});

/** An in-memory Cache, enough of the API for @aegis/browser's OfflinePackStore. */
class MemoryCache {
  readonly entries = new Map<string, { body: Uint8Array; headers: [string, string][] }>();

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(urlOf(request), {
      body: new Uint8Array(await response.arrayBuffer()),
      headers: [...response.headers],
    });
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const entry = this.entries.get(urlOf(request));
    return entry ? new Response(entry.body.slice(), { headers: entry.headers }) : undefined;
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(urlOf(request));
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

/** One CacheStorage for the whole origin, as in a browser. */
class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  /** Every cache whose name starts with `prefix`, with its entries, for byte comparisons. */
  snapshot(prefix: string): string {
    return JSON.stringify(
      [...this.caches]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, cache]) => [
          name,
          [...cache.entries].map(([url, entry]) => [url, Buffer.from(entry.body).toString('hex')]),
        ]),
    );
  }
}

function urlOf(request: RequestInfo | URL): string {
  return typeof request === 'string'
    ? request
    : request instanceof URL
      ? request.href
      : request.url;
}

const sha256 = async (bytes: Uint8Array): Promise<string> =>
  Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');

/** A same-origin server holding both games' files. */
const files = new Map<string, Uint8Array>();
const serve = async (request: RequestInfo | URL): Promise<Response> => {
  const body = files.get(new URL(urlOf(request)).pathname);
  return body ? new Response(body.slice()) : new Response(null, { status: 404 });
};

async function pack(base: string, id: string, revision: string, names: string[]) {
  const resources: OfflinePack['resources'][number][] = [];
  for (const name of names) {
    const body = new TextEncoder().encode(`${id} ${revision} ${name}`);
    files.set(base + name, body);
    resources.push({
      id: `file-${name.replace(/\W/g, '-')}`,
      src: base + name,
      bytes: body.length,
      sha256: await sha256(body),
      kind: name.endsWith('.html') ? 'shell' : 'data',
    });
  }
  return { id, revision, resources } satisfies OfflinePack;
}

describe('offline packs share one CacheStorage with Dragon Valley', () => {
  let caches: MemoryCacheStorage;
  let locks: string[];

  const store = (namespace: string, base: string) =>
    new OfflinePackStore({
      namespace,
      baseUrl: ORIGIN + base,
      caches: caches as unknown as CacheStorage,
      fetch: serve as typeof fetch,
      crypto: webcrypto as unknown as Crypto,
      locks: {
        request: (async (name: string, _options: unknown, work: (lock: unknown) => unknown) => {
          locks.push(name);
          return work({ name });
        }) as unknown as LockManager['request'],
      },
    });

  let dragonValley: OfflinePackStore;
  let pearlSea: OfflinePackStore;
  let dragonValleyBefore: string;

  beforeEach(async () => {
    caches = new MemoryCacheStorage();
    locks = [];
    files.clear();
    dragonValley = store(DRAGON_VALLEY.offlineNamespace, DRAGON_VALLEY.base);
    pearlSea = store(OFFLINE_NAMESPACE, DEPLOYMENT_BASE);
    await dragonValley.install(
      await pack(DRAGON_VALLEY.base, DRAGON_VALLEY.offlinePackId, 'dv-1', ['index.html', 'app.js']),
    );
    dragonValleyBefore = caches.snapshot(sdkPrefix(DRAGON_VALLEY.offlineNamespace));
    locks = [];
  });

  it('installs and lists this game’s pack beside Dragon Valley’s, each seeing only its own', async () => {
    await pearlSea.install(
      await pack(DEPLOYMENT_BASE, OFFLINE_PACK_ID, 'ps-1', ['index.html', 'app.js']),
    );
    const names = await caches.keys();
    const ours = names.filter((name) => name.startsWith(sdkPrefix(OFFLINE_NAMESPACE)));
    const theirs = names.filter((name) => name.startsWith(sdkPrefix('dragon-valley')));
    expect(ours.length + theirs.length, 'no cache outside the two namespaces').toBe(names.length);
    expect(ours).toContain('aegis:pearl-sea:catalog');
    expect(ours.some((name) => name.startsWith('aegis:pearl-sea:pack:pearl-sea:ps-1:'))).toBe(true);
    expect(await pearlSea.list()).toEqual([{ id: OFFLINE_PACK_ID, revision: 'ps-1' }]);
    expect(await dragonValley.list()).toEqual([{ id: 'dragon-valley', revision: 'dv-1' }]);
    expect(caches.snapshot(sdkPrefix('dragon-valley'))).toBe(dragonValleyBefore);
    expect(locks.length).toBeGreaterThan(0);
    for (const lock of locks)
      expect(lock.startsWith(sdkPrefix(OFFLINE_NAMESPACE)), lock).toBe(true);
  });

  it('cleans up only its own staging cache when an install fails', async () => {
    const broken = await pack(DEPLOYMENT_BASE, OFFLINE_PACK_ID, 'ps-2', ['index.html']);
    files.set(DEPLOYMENT_BASE + 'index.html', new TextEncoder().encode('tampered bytes'));
    await expect(pearlSea.install(broken)).rejects.toThrow();
    expect((await caches.keys()).filter((name) => name.includes(':pack:pearl-sea:'))).toEqual([]);
    expect(caches.snapshot(sdkPrefix('dragon-valley'))).toBe(dragonValleyBefore);
    expect(await dragonValley.list()).toEqual([{ id: 'dragon-valley', revision: 'dv-1' }]);
  });

  it('removes its own revisions without touching Dragon Valley’s offline files', async () => {
    const ref = { id: OFFLINE_PACK_ID, revision: 'ps-3' };
    await pearlSea.install(await pack(DEPLOYMENT_BASE, OFFLINE_PACK_ID, 'ps-3', ['index.html']));
    await pearlSea.remove(ref, ref);
    expect(await pearlSea.list()).toEqual([]);
    expect((await caches.keys()).filter((name) => name.includes(':pack:pearl-sea:'))).toEqual([]);
    expect(caches.snapshot(sdkPrefix('dragon-valley'))).toBe(dragonValleyBefore);
  });

  it('builds a worker that serves its own files and refuses Dragon Valley’s paths', async () => {
    const ref = { id: OFFLINE_PACK_ID, revision: 'ps-4' };
    await pearlSea.install(await pack(DEPLOYMENT_BASE, OFFLINE_PACK_ID, 'ps-4', ['index.html']));
    const errors: unknown[] = [];
    const handle = createOfflineFetchHandler(pearlSea, {
      packs: [ref],
      shell: 'index.html',
      onError: (error) => errors.push(error),
    });
    const own = await handle(new Request(`${ORIGIN}${DEPLOYMENT_BASE}index.html`));
    expect(own.status).toBe(200);
    expect(await own.text()).toBe('pearl-sea ps-4 index.html');
    for (const path of ['index.html', 'app.js']) {
      const foreign = await handle(new Request(`${ORIGIN}${DRAGON_VALLEY.base}${path}`));
      expect(foreign.status, path).toBe(403);
    }
    expect(errors).toEqual([]);
  });
});

/**
 * Every TypeScript source under src/, as forward-slash paths relative to the repository, with
 * comments removed (documentation may name the APIs it forbids).
 */
function sources(): { path: string; text: string }[] {
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
    );
  return walk(join(root, 'src'))
    .filter((path) => path.endsWith('.ts'))
    .map((path) => ({
      path: relative(root, path).split(sep).join('/'),
      text: readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/.*$/gm, '$1'),
    }));
}

describe('src/ reaches browser storage only through the SDK, with this game’s names', () => {
  const FORBIDDEN: [RegExp, string][] = [
    [/\blocalStorage\b/, 'localStorage'],
    [/\bsessionStorage\b/, 'sessionStorage'],
    [/\bdocument\s*\.\s*cookie\b/, 'document.cookie'],
    [/\bindexedDB\b/, 'raw IndexedDB (use IndexedDbSaveStorage with SAVE_DATABASE)'],
    [/\bcaches\s*\.\s*(open|delete|keys|match|has)\b/, 'raw Cache Storage (use OfflinePackStore)'],
    [
      /\bnavigator\s*\.\s*serviceWorker\b/,
      'raw service worker registration (use registerOfflineWorker)',
    ],
    [/\bnavigator\s*\.\s*locks\b/, 'raw Web Locks'],
    [/\bBroadcastChannel\b/, 'BroadcastChannel'],
  ];

  it('scans the shell and the worker', () => {
    const paths = sources().map((source) => source.path);
    expect(paths).toContain('src/app/main.ts');
    expect(paths).toContain('src/app/sw.ts');
  });

  it('never uses origin-wide storage APIs directly', () => {
    const found = sources().flatMap(({ path, text }) =>
      FORBIDDEN.filter(([pattern]) => pattern.test(text)).map(([, what]) => `${path}: ${what}`),
    );
    expect(found).toEqual([]);
  });

  it('constructs the SDK stores only with this game’s database, namespace and worker', () => {
    const problems: string[] = [];
    let offlineStores = 0;
    for (const { path, text } of sources()) {
      for (const match of text.matchAll(/new\s+IndexedDbSaveStorage\s*\(([^)]*)\)/g)) {
        if (!/^\s*SAVE_DATABASE\b/.test(match[1] ?? '')) problems.push(`${path}: ${match[0]}`);
      }
      for (const match of text.matchAll(/new\s+OfflinePackStore\s*\(\s*\{([^}]*)\}/g)) {
        offlineStores++;
        if (!/namespace:\s*(OFFLINE_NAMESPACE|__PS_OFFLINE_NAMESPACE__)\b/.test(match[1] ?? '')) {
          problems.push(`${path}: ${match[0]}`);
        }
      }
      for (const match of text.matchAll(/registerOfflineWorker\s*\(([^)]*)\)/g)) {
        if (!/^\s*'sw\.js'/.test(match[1] ?? '')) problems.push(`${path}: ${match[0]}`);
      }
    }
    expect(
      offlineStores,
      'the worker constructs its store (the patterns match real code)',
    ).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
