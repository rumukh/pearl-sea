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
 * Only this game's names are used (src/rules/contract/persistence.ts): the `pearl-sea` pack in
 * `aegis:pearl-sea:…` caches, so Dragon Valley's offline files on the same origin stay untouched.
 */
import { createInstallationRequest, OfflinePackStore } from '@aegis/browser/offline';
import type { OfflinePack, PackStatus } from '@aegis/browser/offline';
import { registerOfflineWorker } from '@aegis/browser/offline/worker';
import { OFFLINE_NAMESPACE, OFFLINE_PACK_ID } from '../../rules/contract';
import { errorCode } from '../persistence/recovery';

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

  const fetchGraph = async (): Promise<OfflinePack> => {
    const response = await fetch(createInstallationRequest('resource-graph.json', options.baseUrl));
    if (!response.ok) throw new Error(`resource-graph.json: HTTP ${response.status}`);
    const pack = (await response.json()) as OfflinePack;
    if (pack.id !== OFFLINE_PACK_ID) throw new Error('Unexpected offline pack identity.');
    return pack;
  };

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
        await installGraph(pack, onProgress);
        return { kind: 'update-ready', revision: pack.revision };
      } catch (cause) {
        return { kind: 'failed', code: errorCode(cause) };
      }
    },
  };
}
