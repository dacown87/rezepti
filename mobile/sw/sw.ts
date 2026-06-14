/// <reference lib="webworker" />
/**
 * RecipeDeck Service Worker (Phase 2 — Shell + Hash-Assets only)
 *
 * Bundled by scripts/pwa/build-sw.ts (esbuild, IIFE) into public/sw.js.
 * Workbox is bundled INTO this file — it never ships in the Expo app bundle.
 *
 * Strategy:
 *  - Navigation requests → NetworkFirst (3 s timeout, offline fallback: /index.html)
 *  - Immutable hash assets  → CacheFirst
 *  - Recipe API GET routes  → StaleWhileRevalidate, per-user cache bucket
 *  - Everything else (images, etc.) → NOT handled (falls through to network)
 *
 * skipWaiting is intentionally NOT called unconditionally. The waiting SW stays
 * waiting until the UI sends a SKIP_WAITING message (wired in Phase 3).
 *
 * SINGLE-TAB / MULTI-ACCOUNT NOTE:
 *   A single SW instance is shared across all tabs for the same origin.
 *   `currentUserHash` holds the SHA-256 hash of the LAST user who sent SET_USER.
 *   In a single-tenant app (one user per device) this is the correct behavior.
 *   If two different accounts are ever open in parallel tabs the last SET_USER
 *   wins — requests from the other tab may be served from or written to the
 *   wrong user's cache bucket during the switch window. This is acceptable for
 *   the current single-tenant deployment; revisit if multi-account support is added.
 */

import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

import { isNavigationRequest, isHashAsset } from './routing.js';
import {
  isCacheableRecipeRequest,
  strongHash,
  isUserCacheName,
  clearLegacyUserCaches,
  persistUserHash,
  readPersistedUserHash,
} from './cache-names.js';
import { recipeCacheHandler } from './recipe-cache-handler.js';
import { buildNotification, resolveClickUrl } from './push-handler.js';

export type { RecipeCacheHandlerDeps } from './recipe-cache-handler.js';
export { recipeCacheHandler } from './recipe-cache-handler.js';

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Precache manifest — injected at build time via esbuild define:
//   self.__WB_MANIFEST → JSON array of { url, revision } entries
// The cast keeps TypeScript happy; esbuild replaces the symbol at bundle time.
// ---------------------------------------------------------------------------
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
precacheAndRoute(__WB_MANIFEST);

// ---------------------------------------------------------------------------
// Cache name tokens — injected by build-sw.ts via esbuild define:
//   __CACHE_HASH__ → short hex string derived from the manifest
// ---------------------------------------------------------------------------
declare const __CACHE_HASH__: string;

const SHELL_CACHE = `rd-shell-v${__CACHE_HASH__}`;
const ASSETS_CACHE = `rd-assets-v${__CACHE_HASH__}`;

/** SHA-256 hash of the currently active user's ID. null = no user / signed-out. */
let currentUserHash: string | null = null;

// ---------------------------------------------------------------------------
// Navigation route — NetworkFirst with /index.html offline fallback
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) => isNavigationRequest(request),
  new NetworkFirst({
    networkTimeoutSeconds: 3,
    cacheName: SHELL_CACHE,
    plugins: [
      {
        // Return precached /index.html when both network and cache miss.
        // Must use matchPrecache — /index.html is stored in Workbox's own
        // precache cache, not in SHELL_CACHE.
        handlerDidError: async () => (await matchPrecache('/index.html')) ?? Response.error(),
      },
    ],
  }),
);

// ---------------------------------------------------------------------------
// Immutable hash-asset route — CacheFirst (filenames already contain hash)
// ---------------------------------------------------------------------------
registerRoute(
  ({ url }) => isHashAsset(url),
  new CacheFirst({
    cacheName: ASSETS_CACHE,
  }),
);

// ---------------------------------------------------------------------------
// Recipe API runtime cache — StaleWhileRevalidate, per-user cache bucket
//
// FIX 1: capture `event` from the route callback and forward it to the handler
// so Workbox's StrategyHandler can call event.waitUntil() without throwing.
// The handler is extracted to recipe-cache-handler.ts for testability.
// ---------------------------------------------------------------------------
registerRoute(
  ({ url, request }) => isCacheableRecipeRequest(url, request.method),
  ({ request, event }) =>
    recipeCacheHandler(
      { request, event },
      {
        // RC2: fall back to the persisted hash when the in-memory value is still
        // null (SW restarted, SET_USER not yet processed) so offline recipe reads
        // — including detail deep-links — resolve the correct cache on cold start.
        getUserHash: async () => currentUserHash ?? (await readPersistedUserHash(caches)),
        fetchFn: fetch,
      },
    ),
);

// ---------------------------------------------------------------------------
// Activate — GC legacy build-scoped user caches (one-time migration)
//
// The recipe DATA cache used to be build-scoped (`rd-user-<hash>-v<build>`) and
// was wiped on every deploy, blanking offline-read after each update. It is now
// build-independent (`rd-user-<hash>`). Here we delete only the LEGACY
// `-v<build>`-suffixed orphans; current-format data caches are kept so offline
// reads survive app updates. Shell/asset/precache caches are never touched.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(clearLegacyUserCaches(caches));
});

// ---------------------------------------------------------------------------
// skipWaiting — only on explicit message from the UI (Phase 3 wires the prompt)
// ---------------------------------------------------------------------------
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (event.data?.type === 'SET_USER') {
    const userId = event.data.userId as string | undefined;
    if (userId) {
      // Compute a strong SHA-256 hash asynchronously, store it in memory, and
      // persist it (RC2) so a restarted SW can resolve the user's cache offline
      // before the next SET_USER. Requests that arrive before the hash is ready
      // (currentUserHash still null) are safely served network-only.
      event.waitUntil(
        strongHash(userId)
          .then((hash) => {
            currentUserHash = hash;
            return persistUserHash(caches, hash);
          })
          .catch(() => {
            currentUserHash = null;
          }),
      );
    } else {
      currentUserHash = null;
    }
  }

  if (event.data?.type === 'CLEAR_USER') {
    currentUserHash = null;
    // Delete all user-scoped caches asynchronously (do not block the message handler).
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter(isUserCacheName)
            .map((name) => caches.delete(name)),
        ),
      ),
    );
  }
});

// ---------------------------------------------------------------------------
// Background Sync — the SW cannot make authenticated requests (the auth token
// lives in the page's Supabase session), so on a sync it wakes all open clients
// and asks them to flush the queue. If no client is open the browser retries.
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event: Event & { tag?: string; waitUntil(p: Promise<unknown>): void }) => {
  if (event.tag !== 'flush-mutations') return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'FLUSH_QUEUE' });
    }),
  );
});

// ---------------------------------------------------------------------------
// Push — show a notification when the server delivers a push message.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event: PushEvent) => {
  const raw = event.data?.text() ?? '';
  const n = buildNotification(raw);
  event.waitUntil(self.registration.showNotification(n.title, n.options));
});

// ---------------------------------------------------------------------------
// Notification click — focus an existing window or open a new one at the
// recipe URL embedded in the notification data.
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = resolveClickUrl(event.notification.data as { url?: string } | undefined);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return (existing as WindowClient).focus().then((c) => c?.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
