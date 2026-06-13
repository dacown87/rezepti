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
 *  - Everything else (API, images, etc.) → NOT handled (falls through to network)
 *
 * skipWaiting is intentionally NOT called unconditionally. The waiting SW stays
 * waiting until the UI sends a SKIP_WAITING message (wired in Phase 3).
 */

import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

import { isNavigationRequest, isHashAsset } from './routing.js';
import { isCacheableRecipeRequest, hashUserId, userCacheName, isUserCacheName } from './cache-names.js';

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

/** Hash of the currently active user's ID. null = no user / signed-out. */
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
// ---------------------------------------------------------------------------
registerRoute(
  ({ url, request }) => isCacheableRecipeRequest(url, request.method),
  async ({ request }) => {
    // CRITICAL SAFETY: if no user is set (SW restarted, or signed out),
    // go network-only — never read from or write to any user cache.
    if (currentUserHash === null) {
      return fetch(request);
    }
    const cacheName = userCacheName(currentUserHash, __CACHE_HASH__);
    return new StaleWhileRevalidate({
      cacheName,
      plugins: [new ExpirationPlugin({ maxEntries: 200 })],
    }).handle({ request, event: undefined as unknown as ExtendableEvent });
  },
);

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
      try {
        currentUserHash = hashUserId(userId);
      } catch {
        currentUserHash = null;
      }
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
