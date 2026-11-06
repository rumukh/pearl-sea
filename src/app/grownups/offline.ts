/**
 * Offline installation for the grown-ups' area, following the Aegis reference shell
 * (poc/lab-shared/shell.ts) and the build's resource graph (scripts/build.mjs, src/app/sw.ts).
 *
 * Install: download `resource-graph.json` through the SDK's explicit installation route
 * (`createInstallationRequest`, which bypasses the worker's pinned responses), install every
 * listed file into a staged cache that is published only when all digests match
 * (`OfflinePackStore.install`), then register the worker (`registerOfflineWorker`) with this
 * game's own scope. Readiness is reported only after both succeed.
 *
 * Updates: checking downloads the current graph the same way. A newer revision is installed
 * next to the running one; the waiting worker takes over the next time the game is opened.
 * There is no forced reload and nothing changes mid-round.
 *
 * Grade 4: the grade-4 art is a pack of its own (`resource-graph-grade-4.json`), installed in the
 * background only once a child at grade 4 plays (`ensureGradeFour`, screens/play.ts) and only where
 * the core pack is installed; an update keeps it when the family had it.
 *
 * Only this game's names are used (src/rules/contract/persistence.ts): the `pearl-sea` pack in
 * `aegis:pearl-sea:…` caches, so Dragon Valley's offline files on the same origin stay untouched.
 */
import { createInstallationRequest, OfflinePackStore } from '@aegis/browser/offline';
import type { OfflinePack, PackStatus } from '@aegis/browser/offline';
import { registerOfflineWorker } from '@aegis/browser/offline/worker';
import {
  OFFLINE_GRADE_FOUR_PACK_ID,
  OFFLINE_NAMESPACE,
  OFFLINE_PACK_ID,
} from '../../rules/contract';
import { errorCode } from '../persistence/recovery';

/** The grade-4 art's graph (scripts/build.mjs), installed only once a child reaches grade 4. */
export const GRADE_FOUR_GRAPH = 'resource-graph-grade-4.json';

export type OfflineState =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'installing'; readonly completed: number; readonly total: number }
  | { readonly kind: 'ready' }
  | { readonly kind: 'update-ready'; readonly revision: string }
  | { readonly kind: 'up-to-date' }
  | { readonly kind: 'failed'; readonly code: string };

export interface OfflineInstaller {
  supported(): boolean;
  inspect(): Promise<OfflineState>;
  install(onProgress: (state: OfflineState) => void): Promise<OfflineState>;
  checkForUpdate(onProgress: (state: OfflineState) => void): Promise<OfflineState>;
  /** Whether this revision's grade-4 pack is installed for offline play. */
  gradeFourInstalled(): Promise<boolean>;
  /**
   * Once a child reaches grade 4: install this revision's grade-4 pack beside the core pack, in
   * the background. Only where the core pack is installed (offline play is on); never twice at
   * once. `skipped` when there is nothing to do (no offline play, no grade-4 art, a newer site).
   */
  ensureGradeFour(): Promise<'ready' | 'skipped' | 'failed'>;
}

export function offlineSupported(): boolean {
  return (
    typeof caches !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'locks' in navigator &&
    typeof crypto !== 'undefined' &&
    crypto.subtle !== undefined &&
    isSecureContext
  );
}

export function createOfflineInstaller(options: {
  readonly baseUrl: string;
  readonly revision: string;
}): OfflineInstaller {
  let listener: ((state: OfflineState) => void) | undefined;
  let store: OfflinePackStore | undefined;
  const getStore = (): OfflinePackStore => {
    store ??= new OfflinePackStore({
      namespace: OFFLINE_NAMESPACE,
      baseUrl: options.baseUrl,
      onStatus(status: PackStatus) {
        if (status.status === 'installing') {
          listener?.({ kind: 'installing', completed: status.completed, total: status.total });
        }
      },
    });
    return store;
  };

  const fetchGraph = async (
    file = 'resource-graph.json',
    id: string = OFFLINE_PACK_ID,
  ): Promise<OfflinePack> => {
    const response = await fetch(createInstallationRequest(file, options.baseUrl));
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const pack = (await response.json()) as OfflinePack;
    if (pack.id !== id) throw new Error('Unexpected offline pack identity.');
    return pack;
  };

  const installed = async (id: string, revision: string): Promise<boolean> => {
    try {
      return (await getStore().inspect({ id, revision })) !== undefined;
    } catch {
      return false;
    }
  };

  /** Install the grade-4 pack of `revision`, if the site has grade-4 art for it. */
  const installGradeFour = async (revision: string): Promise<'ready' | 'skipped'> => {
    const pack = await fetchGraph(GRADE_FOUR_GRAPH, OFFLINE_GRADE_FOUR_PACK_ID);
    if (pack.revision !== revision || pack.resources.length === 0) return 'skipped';
    await getStore().install(pack);
    return 'ready';
  };

  let gradeFour: Promise<'ready' | 'skipped' | 'failed'> | null = null;

  const installGraph = async (
    pack: OfflinePack,
    onProgress: (state: OfflineState) => void,
  ): Promise<void> => {
    listener = onProgress;
    try {
      onProgress({ kind: 'installing', completed: 0, total: pack.resources.length });
      await getStore().install(pack);
      await registerOfflineWorker('sw.js', options.baseUrl);
    } finally {
      listener = undefined;
    }
  };

  return {
    supported: offlineSupported,
    async inspect() {
      if (!offlineSupported()) return { kind: 'unavailable' };
      try {
        const pack = await getStore().inspect({ id: OFFLINE_PACK_ID, revision: options.revision });
        return pack ? { kind: 'ready' } : { kind: 'missing' };
      } catch {
        return { kind: 'missing' };
      }
    },
    async install(onProgress) {
      if (!offlineSupported()) return { kind: 'unavailable' };
      try {
        const pack = await fetchGraph();
        await installGraph(pack, onProgress);
        return pack.revision === options.revision
          ? { kind: 'ready' }
          : { kind: 'update-ready', revision: pack.revision };
      } catch (cause) {
        return { kind: 'failed', code: errorCode(cause) };
      }
    },
    async checkForUpdate(onProgress) {
      if (!offlineSupported()) return { kind: 'unavailable' };
      try {
        const pack = await fetchGraph();
        if (pack.revision === options.revision) return { kind: 'up-to-date' };
        const hadGradeFour = await installed(OFFLINE_GRADE_FOUR_PACK_ID, options.revision);
        await installGraph(pack, onProgress);
        // A family with a 4th grader keeps the grade-4 art offline across the update.
        if (hadGradeFour) await installGradeFour(pack.revision);
        return { kind: 'update-ready', revision: pack.revision };
      } catch (cause) {
        return { kind: 'failed', code: errorCode(cause) };
      }
    },
    async gradeFourInstalled() {
      if (!offlineSupported()) return false;
      return installed(OFFLINE_GRADE_FOUR_PACK_ID, options.revision);
    },
    ensureGradeFour() {
      gradeFour ??= (async (): Promise<'ready' | 'skipped' | 'failed'> => {
        if (!offlineSupported()) return 'skipped';
        if (!(await installed(OFFLINE_PACK_ID, options.revision))) return 'skipped';
        if (await installed(OFFLINE_GRADE_FOUR_PACK_ID, options.revision)) return 'ready';
        try {
          return await installGradeFour(options.revision);
        } catch {
          return 'failed';
        }
      })().finally(() => {
        gradeFour = null;
      });
      return gradeFour;
    },
  };
}
