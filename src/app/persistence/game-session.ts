/**
 * One child's game: a runtime host whose every commit is a strict durable checkpoint in the
 * child's own save record, restored only after validation, with explicit recovery.
 *
 * Generic over the rules' `RuntimeAdapter<S, A, V, C>`, so the same layer serves any adapter
 * (the unit tests run a tiny counting game through it). Follows the Aegis reference shell
 * (poc/lab-shared/session.ts):
 *
 * - The stored envelope is validated by the SDK codec, then the snapshot is restored into a
 *   throwaway probe host with the exact content revision it pinned. Only then does the real
 *   host restore it, passing `durableRevision` because the record was read back from storage.
 * - Anything that fails becomes `RecoveryRequired`: the original bytes stay untouched.
 * - Old saves restore with their own content pack: one the definition holds, or one fetched on
 *   demand (`loadHistory`: the build's `content/history/<revision>.json`). Then
 *   `activateLatestContent()` moves them to the newest pack at a safe boundary (the grotto,
 *   never mid-round) through the adapter's own `activateContent` migration. A pinned pack that
 *   cannot be fetched, or does not match the save, leaves the save untouched for recovery.
 * - The host hands every listener its own copy of what it delivers, and `getView()` copies too
 *   (with its checks), so the session keeps **one** commit listener and passes each commit's
 *   view and events on to the shell's own listeners (`subscribe`); screens read the latest view
 *   with `view()` instead of asking the host for a new copy at every redraw.
 */
import { createSaveCheckpoint } from '@aegis/browser/checkpoint';
import { exportSave, migrateSave, SaveService } from '@aegis/browser/save';
import type { SaveMigration, SavePolicy, SaveStorage } from '@aegis/browser/save';
import { createRuntimeHost, isRuntimeSnapshot, requireValue, RuntimeFault } from '@aegis/runtime';
import type {
  ContentPack,
  RuntimeAdapter,
  RuntimeEvent,
  RuntimeHost,
  RuntimeSnapshot,
} from '@aegis/runtime';
import { deriveSaveIndicator } from './save-status';
import type { SaveIndicator } from './save-status';
import { ContentUnavailable, recoveryFor } from './recovery';

export const ENGINE_ID = 'aegis-runtime';
export const ENGINE_SNAPSHOT_VERSION = 1;
export const ENGINE_REVISION = 'runtime-1';

/** A revision a shipped pack can be named by: `content/history/<revision>.json`. */
export const SHIPPED_REVISION = /^(?!.*\.\.)[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

export interface GameDefinition<S, A, V, C> {
  /** The save namespace, `pearl-sea`. */
  readonly gameId: string;
  readonly adapter: RuntimeAdapter<S, A, V, C>;
  /** The newest content pack; new games start on it. */
  readonly content: ContentPack<C>;
  /** Older shipped packs at hand, so a save restores with the exact revision it pinned. */
  readonly history?: readonly ContentPack<C>[];
  /**
   * An older shipped pack, fetched when a save pins a revision that is not at hand; it rejects
   * when the build has no such pack. Without it, only `content` and `history` can restore.
   */
  readonly loadHistory?: (revision: string) => Promise<ContentPack<C>>;
  /** Sequential steps that upgrade a save of an older `adapter.stateVersion` before restoring it. */
  readonly migrations?: readonly SaveMigration[];
}

export interface GameProfile {
  readonly id: string;
  readonly seed: string;
}

/** A new view: after a commit (with the commit's transient events) or after a restore. */
export interface ViewChange<V> {
  readonly view: V;
  readonly reason: 'commit' | 'restore';
  /** The commit's events, never replayed: none for a restore. */
  readonly events: readonly RuntimeEvent[];
}

export interface GameSession<S, A, V, C> {
  readonly profileId: string;
  readonly host: RuntimeHost<S, A, V, C>;
  readonly saves: SaveService<RuntimeSnapshot, null>;
  readonly policy: SavePolicy<RuntimeSnapshot, null>;
  /**
   * The latest view, as the session's one commit listener received it: the same object until
   * the next commit or restore replaces it. Read it, never change it.
   */
  view(): V;
  /** Every new view, in order; one host listener feeds them all. */
  subscribe(listener: (change: ViewChange<V>) => void): () => void;
  indicator(): SaveIndicator;
  subscribeIndicator(listener: (indicator: SaveIndicator) => void): () => void;
  /** The content pack the game is on now: an older save's own pack until it is upgraded. */
  content(): ContentPack<C>;
  /** The acknowledged stored envelope, or undefined when nothing was saved yet. */
  storedText(): Promise<string | undefined>;
  /** Validate and install a save envelope (from a backup), then store it durably. */
  importEnvelope(text: string): Promise<void>;
  /** At a safe boundary, move an older save to the newest content. True if it changed. */
  activateLatestContent(): Promise<boolean>;
  close(): Promise<void>;
}

function packs<S, A, V, C>(game: GameDefinition<S, A, V, C>): ContentPack<C>[] {
  return [game.content, ...(game.history ?? [])];
}

export function gamePolicy<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  profileId: string,
): SavePolicy<RuntimeSnapshot, null> {
  const known = new Set(packs(game).map((pack) => pack.revision));
  const fetchable = game.loadHistory !== undefined;
  return {
    gameId: game.gameId,
    profileId,
    schemaVersion: game.adapter.stateVersion,
    engineId: ENGINE_ID,
    engineSnapshotVersion: ENGINE_SNAPSHOT_VERSION,
    // A revision the build may still have is checked for real once the save is validated.
    acceptsContent: (revision) =>
      known.has(revision) || (fetchable && SHIPPED_REVISION.test(revision)),
    validateState: (value) => isRuntimeSnapshot(value),
    validateResume: (value): value is null => value === null,
    isCurrentState: (value): value is RuntimeSnapshot =>
      isRuntimeSnapshot(value) && value.stateVersion === game.adapter.stateVersion,
  };
}

/** The pack a save pins: one at hand, or the build's archived copy, checked to be that pack. */
export async function packFor<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  revision: string,
): Promise<ContentPack<C>> {
  const held = packs(game).find((pack) => pack.revision === revision);
  if (held) return held;
  if (!game.loadHistory || !SHIPPED_REVISION.test(revision)) {
    throw new ContentUnavailable(revision);
  }
  let pack: ContentPack<C>;
  try {
    pack = await game.loadHistory(revision);
  } catch (cause) {
    throw new ContentUnavailable(revision, { cause });
  }
  if (pack.id !== game.content.id || pack.revision !== revision) {
    throw new ContentUnavailable(revision);
  }
  return pack;
}

/**
 * Restore a snapshot into a throwaway host with the pack it pinned: the full adapter, content
 * and reference checks. Resolves to that pack.
 */
export async function validateSnapshot<S, A, V, C>(
  game: GameDefinition<S, A, V, C>,
  snapshot: RuntimeSnapshot,
): Promise<ContentPack<C>> {
  const content = await packFor(game, snapshot.content.revision);
  const probe = createRuntimeHost({ adapter: game.adapter, content, seed: 'probe' });
  try {
    requireValue(await probe.restore(snapshot));
  } finally {
    await probe.dispose();
  }
  return content;
}

export async function openGameSession<S, A, V, C>(
  storage: SaveStorage,
  game: GameDefinition<S, A, V, C>,
  profile: GameProfile,
): Promise<GameSession<S, A, V, C>> {
  const policy = gamePolicy(game, profile.id);
  const saves = new SaveService<RuntimeSnapshot, null>(storage, policy);
  const validate = async (snapshot: RuntimeSnapshot): Promise<void> => {
    await validateSnapshot(game, snapshot);
  };
  const migrations = game.migrations ?? [];
  let saved;
  let start = game.content;
  try {
    saved = await saves.load(migrations);
    if (saved) start = await validateSnapshot(game, saved.state);
  } catch (cause) {
    throw await recoveryFor('game', storage, policy, cause, validate, migrations);
  }
  const checkpoint = createSaveCheckpoint<null>(saves, ({ snapshot }) => ({
    format: 'aegis.save',
    formatVersion: 1,
    gameId: game.gameId,
    profileId: profile.id,
    contentRevision: snapshot.content.revision,
    schemaVersion: snapshot.stateVersion,
    engine: { id: ENGINE_ID, snapshotVersion: ENGINE_SNAPSHOT_VERSION, revision: ENGINE_REVISION },
    resume: null,
  }));
  const host = createRuntimeHost({
    adapter: game.adapter,
    content: start,
    seed: profile.seed,
    checkpoint,
  });
  /** Every pack the host holds, by revision: the one it started on and those staged beside it. */
  const installed = new Map<string, ContentPack<C>>([[start.revision, start]]);
  const install = (pack: ContentPack<C>): ContentPack<C> => {
    const held = installed.get(pack.revision);
    if (held) return held;
    requireValue(host.stageContent(pack));
    installed.set(pack.revision, pack);
    return pack;
  };
  for (const pack of packs(game)) install(pack);
  if (saved) {
    const restored = await host.restore(saved.state, { durableRevision: saved.state.revision });
    if (!restored.ok) {
      await host.dispose();
      throw await recoveryFor(
        'game',
        storage,
        policy,
        new RuntimeFault(restored.error),
        validate,
        migrations,
      );
    }
  }

  let closed = false;
  const listeners = new Set<(indicator: SaveIndicator) => void>();
  let last = '';
  const indicator = (): SaveIndicator => deriveSaveIndicator(host.getStatus(), saves.status());
  const publish = (): void => {
    const current = indicator();
    const key = JSON.stringify(current);
    if (key === last) return;
    last = key;
    for (const listener of listeners) listener(current);
  };
  const unsubscribeHost = host.subscribeStatus(publish);
  const unsubscribeSaves = saves.subscribe(publish);

  // The one commit listener: its copy of each commit's view is the session's latest view.
  let latest = host.getView();
  let revision = start.revision;
  const viewListeners = new Set<(change: ViewChange<V>) => void>();
  const deliver = (change: ViewChange<V>): void => {
    // Each listener runs even if another fails; the first failure then reaches the host, which
    // reports it as a listener failure, as it would for listeners of its own.
    let failure: { readonly error: unknown } | null = null;
    for (const listener of [...viewListeners]) {
      if (!viewListeners.has(listener)) continue;
      try {
        listener(change);
      } catch (error) {
        failure ??= { error };
      }
    }
    if (failure) throw failure.error;
  };
  const unsubscribeCommits = host.subscribeCommits((commit) => {
    latest = commit.view;
    revision = commit.snapshot.content.revision;
    deliver({ view: latest, reason: 'commit', events: commit.events });
  });

  return {
    profileId: profile.id,
    host,
    saves,
    policy,
    view: () => latest,
    subscribe(listener) {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    indicator,
    subscribeIndicator(listener) {
      listeners.add(listener);
      listener(indicator());
      return () => listeners.delete(listener);
    },
    content() {
      return installed.get(revision) ?? game.content;
    },
    async storedText() {
      const status = host.getStatus();
      if (status.durableRevision === null) return undefined;
      requireValue(await host.flush());
      const record = await storage.read(policy);
      return record.current
        ? exportSave(migrateSave(record.current.payload, policy, migrations), policy)
        : undefined;
    },
    async importEnvelope(text) {
      const candidate = migrateSave(text, policy, migrations);
      const pack = install(await validateSnapshot(game, candidate.state));
      requireValue(await host.restore(candidate.state));
      latest = host.getView();
      revision = pack.revision;
      requireValue(await host.retryCheckpoint());
      deliver({ view: latest, reason: 'restore', events: [] });
    },
    async activateLatestContent() {
      if (revision === game.content.revision) return false;
      const status = host.getStatus();
      if (status.pendingAction !== null || status.checkpoint !== 'idle') return false;
      const result = await host.activateContent(install(game.content), 'boundary');
      if (result.ok) return true;
      if (result.error.code === 'unsafe-boundary' || result.error.code === 'pending-jobs') {
        return false;
      }
      throw new RuntimeFault(result.error);
    },
    async close() {
      if (closed) return;
      closed = true;
      unsubscribeHost();
      unsubscribeSaves();
      unsubscribeCommits();
      listeners.clear();
      viewListeners.clear();
      await host.dispose();
    },
  };
}
