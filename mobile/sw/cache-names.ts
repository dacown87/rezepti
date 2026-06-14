/**
 * Pure, side-effect-free cache-name helpers for the RecipeDeck Service Worker.
 * No dependencies on SW globals, Workbox, or browser APIs — except strongHash
 * which uses Web Crypto (available in both SW runtime and Node 24 webcrypto).
 * Safe to import in Vitest (Node env).
 */

/**
 * Computes a SHA-256 hash of userId and returns a 64-character lowercase hex string.
 *
 * Why SHA-256 instead of FNV-1a 32-bit:
 *   FNV-1a 32-bit yields only 8 hex chars (2^32 buckets). The birthday-collision
 *   probability reaches ~1% at ~77k users — far too low for a cache-name privacy
 *   boundary where two distinct user UUIDs mapping to the same name would cause a
 *   cross-user cache leak. SHA-256 gives 64 hex chars (2^256 buckets) — negligible
 *   collision risk for any realistic user population.
 *
 * The hash is computed once (in the SET_USER handler) and stored as currentUserHash.
 * The request-time path reads the already-stored string — no async work on the hot path.
 *
 * `crypto.subtle` is available in:
 *   - Service Worker runtime (all modern browsers)
 *   - Node 24+ global `crypto.subtle` (webcrypto — no import needed)
 * Throws if userId is empty/falsy.
 */
export async function strongHash(userId: string): Promise<string> {
  if (!userId) throw new Error('strongHash: userId must not be empty');
  const data = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @deprecated Use strongHash (async, SHA-256) instead.
 * Kept only as a deterministic 8-char hex helper for tests that pre-date the
 * SHA-256 migration. NOT used in the SW runtime any more.
 *
 * FNV-1a 32-bit: birthday collision around ~77k users — insufficient for a
 * cache-name privacy boundary. Replaced by strongHash.
 */
export function hashUserId(userId: string): string {
  if (!userId) throw new Error('hashUserId: userId must not be empty');

  // FNV-1a 32-bit: prime = 16777619, offset basis = 2166136261
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash = hash >>> 0; // force unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Returns the user-scoped API cache name.
 * Format: `rd-user-${userIdHash}`
 *
 * IMPORTANT: this name is intentionally NOT build-hash-scoped. Recipe DATA is
 * not tied to the frontend build, so the cache must survive app updates —
 * otherwise every deploy wipes the offline-read cache (the activate handler GCs
 * caches from previous builds). Shell/asset caches stay build-scoped; data does not.
 */
export function userCacheName(userIdHash: string): string {
  return `rd-user-${userIdHash}`;
}

/**
 * Returns true for any cache name matching the rd-user-* pattern.
 * Used to find and delete all user caches on logout.
 */
export function isUserCacheName(name: string): boolean {
  return /^rd-user-/.test(name);
}

/**
 * Returns true for legacy build-scoped user caches (`rd-user-<hash>-v<buildHash>`)
 * left over from before the data cache became build-independent. Used by the
 * activate handler to GC those orphans once. The new format (`rd-user-<hash>`,
 * no `-v` suffix) is intentionally NOT matched, so live data caches are kept.
 */
export function isLegacyBuildScopedUserCacheName(name: string): boolean {
  if (!isUserCacheName(name)) return false;
  // Legacy format embedded a "-v<buildHash>" suffix; the current format does not.
  return /-v[^-]+$/.test(name);
}

/**
 * Returns true when the request should be cached in the user's API cache.
 * Only matches GET requests for:
 *   - /api/v1/recipes          (list, possibly with query string)
 *   - /api/v1/recipes/:id      (detail — any path segment after /recipes/)
 *   - /api/v1/recipes/:id/image
 * Does NOT match: POST/PATCH/DELETE, /api/v1/shopping, /api/v1/planner,
 * /api/v1/auth/*, /api/v1/extract/*, /api/v1/keys/*, /api/v1/dictionary, etc.
 */
export function isCacheableRecipeRequest(url: string | URL, method: string): boolean {
  if (method !== 'GET') return false;
  const pathname = typeof url === 'string' ? new URL(url, 'https://localhost').pathname : url.pathname;
  return /^\/api\/v1\/recipes(\/[^/]+(\/image)?)?\/?$/.test(pathname);
}

/**
 * Clears all user-scoped caches from the provided cache storage interface.
 * Accepts a minimal duck-typed storage object so it can be tested without
 * a real CacheStorage runtime.
 */
export async function clearUserCaches(storage: {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}): Promise<void> {
  const names = await storage.keys();
  await Promise.all(names.filter(isUserCacheName).map((name) => storage.delete(name)));
}

/**
 * Deletes legacy build-scoped user caches (`rd-user-<hash>-v<buildHash>`) left
 * over from before the data cache became build-independent. The current-format
 * `rd-user-<hash>` data caches are kept so offline-read survives app updates.
 * Shell, asset, and precache caches are never touched.
 */
export async function clearLegacyUserCaches(
  storage: {
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
  },
): Promise<void> {
  const names = await storage.keys();
  await Promise.all(
    names
      .filter(isLegacyBuildScopedUserCacheName)
      .map((name) => storage.delete(name)),
  );
}
