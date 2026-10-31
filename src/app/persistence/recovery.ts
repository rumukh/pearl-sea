/**
 * Explicit recovery for a stored record that cannot be opened (corrupt, from a future version,
 * failing validation, or storage that refuses to work).
 *
 * Nothing here runs by itself: an unreadable save is never turned into a new game. The
 * recovery screen offers what the stored history allows - export the original bytes, restore
 * the previous copy (validated like a fresh load), load a backup file, or a confirmed reset of
 * exactly this record - and every replacement is a compare-and-swap that keeps the old record
 * as the "previous" copy. Ported from the Aegis reference shell (poc/lab-shared/recovery.ts).
 */
import { BrowserServiceError, exportSave, migrateSave } from '@aegis/browser/save';
import type { SaveHistory, SaveMigration, SavePolicy, SaveStorage } from '@aegis/browser/save';
import { RuntimeFault } from '@aegis/runtime';

/** `day` (the diary's day record) never asks for recovery: it is replaced instead. */
export type RecordKind = 'family' | 'game' | 'preferences' | 'day';

export interface RecoveryActions {
  /** False when the storage itself could not be read; only "try again" remains. */
  readonly available: boolean;
  /** The current stored bytes, exactly as found. */
  readonly original?: string;
  /** The previous stored copy, if the store kept one. */
  readonly previous?: string;
  /** Validate `text` as this record (envelope and game rules), then install it. */
  replace(text: string): Promise<void>;
  /** Erase exactly this record. The caller must have confirmed with the grown-up. */
  reset(): Promise<void>;
}

export class RecoveryRequired extends Error {
  constructor(
    readonly kind: RecordKind,
    readonly profileId: string,
    readonly code: string,
    readonly actions: RecoveryActions,
    options?: ErrorOptions,
  ) {
    super(`The ${kind} record for ${profileId} needs explicit recovery (${code}).`, options);
    this.name = 'RecoveryRequired';
  }
}

/**
 * A save pins a content pack this build cannot give it: never shipped, not reachable right now
 * (offline before the game was installed), or a file that is not that pack.
 */
export class ContentUnavailable extends Error {
  readonly code = 'content-unavailable';
  constructor(
    readonly revision: string,
    options?: ErrorOptions,
  ) {
    super(`Content revision ${revision} is not available.`, options);
    this.name = 'ContentUnavailable';
  }
}

/** A short, non-private code for an error, safe to show to a grown-up. */
export function errorCode(cause: unknown): string {
  if (cause instanceof BrowserServiceError) return cause.code;
  if (cause instanceof RuntimeFault) return cause.error.code;
  if (cause instanceof RecoveryRequired) return cause.code;
  if (cause instanceof ContentUnavailable) return cause.code;
  if (cause instanceof DOMException) return cause.name;
  return 'unexpected';
}

export async function recoveryFor<State, Resume>(
  kind: RecordKind,
  storage: SaveStorage,
  policy: SavePolicy<State, Resume>,
  cause: unknown,
  validate: (state: State) => Promise<void>,
  migrations: readonly SaveMigration[] = [],
): Promise<RecoveryRequired> {
  let history: SaveHistory;
  try {
    history = await storage.read(policy);
  } catch (storageCause) {
    return new RecoveryRequired(
      kind,
      policy.profileId,
      errorCode(storageCause),
      {
        available: false,
        replace: () => Promise.reject(storageCause),
        reset: () => Promise.reject(storageCause),
      },
      { cause: storageCause },
    );
  }
  const revision = history.revision ?? history.current?.revision ?? 0;
  return new RecoveryRequired(
    kind,
    policy.profileId,
    errorCode(cause),
    {
      available: true,
      ...(history.current ? { original: history.current.payload } : {}),
      ...(history.previous ? { previous: history.previous.payload } : {}),
      async replace(text) {
        const candidate = migrateSave(text, policy, migrations);
        await validate(candidate.state);
        const next = revision + 1;
        await storage.compareAndSwap(policy, revision, {
          revision: next,
          payload: exportSave({ ...candidate, revision: next }, policy),
        });
      },
      async reset() {
        await storage.reset(policy, revision, {
          gameId: policy.gameId,
          profileId: policy.profileId,
        });
      },
    },
    { cause },
  );
}

/**
 * Erase one record without loading it (removing a child), leaving only the store's revision
 * tombstone. A record with nothing stored is left alone.
 */
export async function eraseRecord<State, Resume>(
  storage: SaveStorage,
  policy: SavePolicy<State, Resume>,
): Promise<void> {
  const history = await storage.read(policy);
  if (!history.current) return;
  await storage.reset(policy, history.current.revision, {
    gameId: policy.gameId,
    profileId: policy.profileId,
  });
}
