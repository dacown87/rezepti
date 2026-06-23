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
 *  - Recipe API GET routes  → StaleWhileRevalidate, request-scoped per-user cache bucket
 *  - Everything else (images, etc.) → NOT handled (falls through to network)
 *
 * skipWaiting is intentionally NOT called unconditionally. The waiting SW stays
 * waiting until the UI sends a SKIP_WAITING message (wired in Phase 3).
 *
 * MULTI-ACCOUNT SAFETY:
 *   A single SW instance is still shared across all tabs for the same origin,
 *   but recipe-cache routing no longer depends on global SW user state. The
 *   active cache bucket is selected from each request's X-RD-User-Hash header.
 *   Requests without that header fail closed to network-only.
 */

import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

import { isNavigationRequest, isHashAsset } from './routing.js';
import {
  isCacheableRecipeRequest,
  clearLegacyUserCaches,
  clearUserCaches,
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
type SyncEventLike = Event & { tag?: string; waitUntil(p: Promise<unknown>): void };

const SHELL_CACHE = `rd-shell-v${__CACHE_HASH__}`;
const ASSETS_CACHE = `rd-assets-v${__CACHE_HASH__}`;

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
    // No-op for recipe-cache routing. The app still emits SET_USER during auth
    // transitions, but request-scoped routing derives the cache bucket from the
    // request header instead of global SW state.
  }

  if (event.data?.type === 'CLEAR_USER') {
    event.waitUntil(clearUserCaches(caches));
  }
});

// ---------------------------------------------------------------------------
// Background Sync — the SW cannot make authenticated requests (the auth token
// lives in the page's Supabase session), so on a sync it wakes all open clients
// and asks them to flush the queue. If no client is open the browser retries.
// ---------------------------------------------------------------------------
self.addEventListener('sync', ((event: Event) => {
  const syncEvent = event as SyncEventLike;
  if (syncEvent.tag !== 'flush-mutations') return;
  syncEvent.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'FLUSH_QUEUE' });
    }),
  );
}) as EventListener);

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
