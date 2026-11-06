/**
 * Offline worker entry, bundled to `sw.js` by scripts/build.mjs from the PUBLIC
 * `@aegis/browser/offline/worker` export (never from an engine `dist` path).
 *
 * The build pins the exact offline pack revision it just published, and this game's own pack IDs
 * and namespace (src/rules/contract/persistence.ts), so the worker reads only `aegis:pearl-sea:…`
 * caches. It is registered with the deployment base as its scope (`/pearl-sea/`), serves the core
 * pack's verified resource graph and refuses every other request outside the art folder; art not
 * in the core pack (the grade-4 pack, installed only once a child reaches grade 4) comes from that
 * pack, else the network, else a quiet 503 the page draws as a placeholder. It never calls
 * skipWaiting and never forces a reload: a new revision activates only under the shell's update
 * policy at a safe boundary.
 */
import { INSTALLATION_HEADER, OfflinePackStore } from '@aegis/browser/offline';
import { createOfflineFetchHandler } from '@aegis/browser/offline/worker';

declare const __PS_OFFLINE_PACK_ID__: string;
declare const __PS_OFFLINE_GRADE_FOUR_PACK_ID__: string;
declare const __PS_OFFLINE_NAMESPACE__: string;
declare const __PS_OFFLINE_REVISION__: string;
declare const __PS_OFFLINE_ERROR_MESSAGE__: string;

const worker = self as unknown as ServiceWorkerGlobalScope;

const store = new OfflinePackStore({
  namespace: __PS_OFFLINE_NAMESPACE__,
  baseUrl: worker.registration.scope,
});

const core = { id: __PS_OFFLINE_PACK_ID__, revision: __PS_OFFLINE_REVISION__ };
const gradeFour = { id: __PS_OFFLINE_GRADE_FOUR_PACK_ID__, revision: __PS_OFFLINE_REVISION__ };

const handle = createOfflineFetchHandler(store, {
  packs: [core],
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

const art = new URL('assets/art/', worker.registration.scope).href;

/**
 * Art outside the core pack (the grade-4 pack, installed only once a child reaches grade 4): from
 * that pack once it is installed, else from the network. Without either, a quiet 503: the page
 * draws the picture's placeholder (art/picture.ts), and nothing is reported as a broken install.
 */
async function optionalArt(request: Request): Promise<Response> {
  for (const ref of [core, gradeFour]) {
    const cached = await store.response(ref, request).catch(() => undefined);
    if (cached) return cached;
  }
  try {
    return await fetch(request, { redirect: 'error', credentials: 'same-origin' });
  } catch {
    return new Response(null, { status: 503 });
  }
}

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const optional =
    request.method === 'GET' &&
    request.mode !== 'navigate' &&
    request.url.startsWith(art) &&
    !request.headers.has(INSTALLATION_HEADER);
  event.respondWith(optional ? optionalArt(request) : handle(request));
});
