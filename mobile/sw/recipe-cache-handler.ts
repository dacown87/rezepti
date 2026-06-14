/**
 * Standalone, testable recipe cache handler for the RecipeDeck Service Worker.
 *
 * Extracted from sw.ts so it can be unit-tested in Node (Vitest) without
 * importing the full SW bundle (which requires `self` / ServiceWorker globals
 * and Workbox precaching to be available).
 */

import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { userCacheName } from './cache-names.js';

/** Minimal interface for a Workbox-style strategy (used for testability). */
export interface WorkboxStrategyLike {
  handle(options: { request: Request; event: ExtendableEvent }): Promise<Response>;
}

export interface RecipeCacheHandlerDeps {
  /**
   * Resolves the active user's hash. May be async so the SW can fall back to a
   * persisted hash on a cold start (RC2) when the in-memory value is still null.
   */
  getUserHash: () => string | null | Promise<string | null>;
  fetchFn: typeof fetch;
  /**
   * Optional factory that overrides the default StaleWhileRevalidate strategy.
   * Injected in tests to avoid needing a real browser cache / IndexedDB.
   * If omitted, a production StaleWhileRevalidate+ExpirationPlugin is used.
   */
  makeStrategy?: (cacheName: string) => WorkboxStrategyLike;
}

function defaultMakeStrategy(cacheName: string): WorkboxStrategyLike {
  return new StaleWhileRevalidate({
    cacheName,
    plugins: [new ExpirationPlugin({ maxEntries: 200 })],
  });
}

/**
 * Handles a cacheable recipe GET request.
 *
 * - If no user is set (null hash) → network-only pass-through; no cache is touched.
 * - Otherwise → StaleWhileRevalidate into the per-user cache bucket, forwarding
 *   the REAL ExtendableEvent so Workbox's StrategyHandler can call event.waitUntil()
 *   without throwing.
 *
 * The strategy is constructed per-request so it is always bound to the hash
 * that is current at request time (avoids a stale-hash race window).
 *
 * IMPORTANT: Must be called with the REAL ExtendableEvent from the route
 * callback. Passing `undefined` causes:
 *   TypeError: Cannot read properties of undefined (reading 'waitUntil')
 * inside Workbox's StrategyHandler — every cacheable recipe GET fails silently.
 */
export async function recipeCacheHandler(
  { request, event }: { request: Request; event: ExtendableEvent },
  deps: RecipeCacheHandlerDeps,
): Promise<Response> {
  const hash = await deps.getUserHash();

  // CRITICAL SAFETY: if no user is set (SW restarted, signed out, or during
  // the switch window after CLEAR_USER) go network-only — never read from or
  // write to any user cache.
  if (hash === null) {
    return deps.fetchFn(request);
  }

  const cacheName = userCacheName(hash);
  const strategy = (deps.makeStrategy ?? defaultMakeStrategy)(cacheName);

  // Forward the REAL event so Workbox's StrategyHandler can call
  // event.waitUntil() for background revalidation — passing `undefined`
  // would throw: "TypeError: Cannot read properties of undefined (reading 'waitUntil')"
  return strategy.handle({ request, event });
}
