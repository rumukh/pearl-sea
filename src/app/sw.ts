/**
 * Offline worker entry, bundled to `sw.js` by scripts/build.mjs from the PUBLIC
 * `@aegis/browser/offline/worker` export (never from an engine `dist` path).
 *
 * The build pins the exact offline pack revision it just published, and this game's own pack ID
 * and namespace (src/rules/contract/persistence.ts), so the worker reads only `aegis:pearl-sea:…`
 * caches. It is registered with the deployment base as its scope (`/pearl-sea/`), serves only the
 * verified resource graph, refuses every request outside that folder, never calls skipWaiting and
 * never forces a reload: a new revision activates only under the shell's update policy at a safe
 * boundary.
 */
import { OfflinePackStore } from '@aegis/browser/offline';
import { attachOfflineWorker } from '@aegis/browser/offline/worker';

declare const __PS_OFFLINE_PACK_ID__: string;
declare const __PS_OFFLINE_NAMESPACE__: string;
declare const __PS_OFFLINE_REVISION__: string;
declare const __PS_OFFLINE_ERROR_MESSAGE__: string;

const worker = self as unknown as ServiceWorkerGlobalScope;

const store = new OfflinePackStore({
  namespace: __PS_OFFLINE_NAMESPACE__,
  baseUrl: worker.registration.scope,
});

attachOfflineWorker(worker, store, {
  packs: [{ id: __PS_OFFLINE_PACK_ID__, revision: __PS_OFFLINE_REVISION__ }],
  shell: 'index.html',
  onError() {
    // Report only the fact of a failure to open pages; no request data or state leaves the worker.
    void worker.clients
      .matchAll()
      .then((clients) => {
        for (const client of clients) client.postMessage({ type: __PS_OFFLINE_ERROR_MESSAGE__ });
      })
      .catch(() => undefined);
  },
});
