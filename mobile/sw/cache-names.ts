/**
 * Pure, side-effect-free cache-name helpers for the RecipeDeck Service Worker.
 * No dependencies on SW globals, Workbox, or browser APIs.
 * Safe to import in Vitest (Node env).
 */

/**
 * Deterministic short hash of userId using FNV-1a (32-bit).
 * Used for cache-name namespacing only — NOT a security secret.
 * Throws if userId is empty/falsy.
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
 * Format: `rd-user-${userIdHash}-v${buildHash}`
 */
export function userCacheName(userIdHash: string, buildHash: string): string {
  return `rd-user-${userIdHash}-v${buildHash}`;
}

/**
 * Returns true for any cache name matching the rd-user-* pattern.
 * Used to find and delete all user caches on logout.
 */
export function isUserCacheName(name: string): boolean {
  return /^rd-user-/.test(name);
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
