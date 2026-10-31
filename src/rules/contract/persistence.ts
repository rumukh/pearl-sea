/**
 * Identifiers shared by the rules and the browser persistence layer, and the registry of every
 * name this game gives to browser storage.
 *
 * Same-origin isolation: Perlové moře and Dragon Valley are both served from
 * https://rumukh.github.io, which is one origin. IndexedDB databases, Cache Storage, Web Locks and
 * service-worker registrations are shared by everything on an origin and told apart only by name
 * or scope. So every name below belongs to this game alone: `pearl-sea` or `pearl-sea-…` for the
 * names chosen here, `aegis:pearl-sea:…` for the cache and lock names the SDK derives from
 * OFFLINE_NAMESPACE, and the `/pearl-sea/` scope for the offline worker.
 * test/unit/persistence/origin-isolation.test.ts proves that none of them can equal, extend or be
 * confused with one of Dragon Valley's, and test/e2e/isolation.spec.ts checks the same in browsers.
 * Browser storage is reached only through the SDK, never through localStorage, sessionStorage,
 * cookies or raw IndexedDB and Cache Storage calls (the isolation test scans src/ for them).
 *
 * Storage layout: one IndexedDB database; a family record listing up to four child profiles; per
 * profile, one game save (a runtime snapshot through the strict checkpoint bridge), one
 * preferences record and one day record. Names, avatars and presentation preferences are not game
 * state and never enter a game hash.
 */

/** Every storage name of this game is this namespace or starts with it and a hyphen. */
export const STORAGE_NAMESPACE = 'pearl-sea';

/** The GitHub Pages deployment base path, and with it the offline worker's scope. */
export const DEPLOYMENT_BASE = '/pearl-sea/';

/** The runtime adapter ID, recorded in every snapshot. */
export const ADAPTER_ID = 'pearl-sea';

/** IndexedDB database name passed to `IndexedDbSaveStorage` (never the SDK default `aegis-saves`). */
export const SAVE_DATABASE = 'pearl-sea';

/** `SaveService` game IDs: the game save, the family record, preferences and the day record. */
export const GAME_ID = 'pearl-sea';
export const FAMILY_GAME_ID = 'pearl-sea-family';
export const PREFERENCES_GAME_ID = 'pearl-sea-preferences';
export const DAY_GAME_ID = 'pearl-sea-day';

/**
 * The offline pack ID and the `OfflinePackStore` namespace. The SDK names its caches
 * `aegis:pearl-sea:catalog` and `aegis:pearl-sea:pack:pearl-sea:<revision>:<uuid>` and its Web
 * Locks `aegis:pearl-sea:revision:<key>`; it deletes caches only by their exact names.
 */
export const OFFLINE_PACK_ID = 'pearl-sea';
export const OFFLINE_NAMESPACE = 'pearl-sea';

/** The message type the offline worker posts to its pages when it cannot serve one. */
export const OFFLINE_ERROR_MESSAGE = 'pearl-sea-offline-error';

/** The format marker of a backup file; downloaded files are named `pearl-sea-….json`. */
export const BACKUP_FORMAT = 'pearl-sea-backup';

/** Up to four children share a family device. Profile IDs are fixed slots. */
export const MAX_PROFILES = 4;
export const PROFILE_IDS = ['profile-1', 'profile-2', 'profile-3', 'profile-4'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

/** The `SaveService` profile ID of the single family record (profiles, names, avatars). */
export const FAMILY_PROFILE_ID = 'family';

/** Longest child name shown on a profile card. */
export const MAX_PROFILE_NAME_LENGTH = 16;

/**
 * The runtime seed of a profile's game. Fixed per profile slot so a reset profile replays the
 * same deterministic sequence for the same actions (useful for support and tests); the
 * sequence still differs between children because their actions differ.
 */
export function profileSeed(profile: ProfileId): string {
  return `${STORAGE_NAMESPACE}:${profile}`;
}
