/**
 * Auth stub — placeholder for future Supabase Auth integration.
 *
 * When Multi-User Login is implemented (Phase 10), this module will:
 * - Validate JWT tokens from Supabase Auth
 * - Extract user_id from the token
 * - Provide auth middleware for Hono routes
 *
 * Until then, all functions return null/undefined so existing
 * single-user behaviour is preserved.
 */

/**
 * Returns the current user's UUID, or null if unauthenticated.
 * All DB queries should filter by `user_id = getCurrentUserId() OR user_id IS NULL`
 * once auth is active.
 */
export function getCurrentUserId(): string | null {
  return null;
}

/**
 * Returns true if the current request is authenticated.
 * Always false until Supabase Auth is wired up.
 */
export function isAuthenticated(): boolean {
  return false;
}
