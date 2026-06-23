import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/** @deprecated Use getQueryCacheKey(userId) instead. Kept for integration-test backwards compat. */
export const QUERY_CACHE_STORAGE_KEY = 'recipedeck-query-cache';

/**
 * Returns the AsyncStorage key for a given user's query cache.
 * Anonymous / signed-out state uses the "anon" slot so it never
 * collides with a real user's persisted data.
 */
export function getQueryCacheKey(userId: string | null): string {
  return `recipedeck-query-cache-${userId ?? 'anon'}`;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — show cached data without spinner
      gcTime: 24 * 60 * 60 * 1000,    // 24h — keep in memory / AsyncStorage
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * The currently active user ID as seen by the persister.
 * `undefined` = not yet known (before first auth event).
 * `null`       = signed-out.
 * string       = signed-in user ID.
 */
let activeAuthUserId: string | null | undefined;

/**
 * The cache key that restoreClient() actually loaded on cold start.
 * watchAuthQueryCache compares this against the incoming session's key to decide
 * whether the restored cache belongs to the signed-in user (keep it → offline-read
 * works) or to a different user (clear it → privacy boundary). `undefined` until
 * restoreClient has run.
 */
let restoredCacheKey: string | undefined;

/**
 * Builds a per-user AsyncStorage persister for a specific key. We re-create the
 * underlying base persister on every operation so the correct user-scoped key is
 * always used without needing a React context or prop-drilling.
 */
function makePersister(key: string) {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key,
    throttleTime: 1000,
  });
}

/**
 * Resolves the signed-in user's id from the stored Supabase session so the
 * persister can pick the correct per-user cache key on COLD START.
 *
 * Why this matters: PersistQueryClientProvider calls restoreClient() before the
 * first auth event fires, so activeAuthUserId is still `undefined`. Without
 * resolving the user here we restore the empty "anon" slot and the recipe list
 * is blank offline — even though the user's recipes are persisted under their
 * own key. getSession() reads from storage only (offline-safe); returns null
 * when Supabase is unconfigured or there is no stored session.
 */
async function resolveRestoreUserId(): Promise<string | null> {
  try {
    const { getAuthSession } = await import('./auth');
    const session = await getAuthSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const asyncStoragePersister = {
  persistClient: async (client: Parameters<ReturnType<typeof createAsyncStoragePersister>['persistClient']>[0]) => {
    return makePersister(getQueryCacheKey(activeAuthUserId ?? null)).persistClient(client);
  },
  restoreClient: async () => {
    // If auth already resolved (warm path) use it; otherwise resolve the stored
    // session so cold-start restore loads the signed-in user's cache, not "anon".
    const userId = activeAuthUserId !== undefined ? activeAuthUserId : await resolveRestoreUserId();
    const key = getQueryCacheKey(userId ?? null);
    restoredCacheKey = key;
    try {
      return await makePersister(key).restoreClient();
    } catch {
      try {
        await AsyncStorage.removeItem(key);
      } catch { /* ignore cleanup failure */ }
      return undefined;
    }
  },
  removeClient: async () => {
    return makePersister(getQueryCacheKey(activeAuthUserId ?? null)).removeClient();
  },
};

/**
 * Session-restore state:
 * `true`  = first auth event has NOT fired yet (session is being restored from storage).
 * `false` = first auth event has fired; auth state is confirmed.
 */
let _sessionRestoring = true;
const _sessionRestoringListeners = new Set<(restoring: boolean) => void>();

/** Returns true while the Supabase session is still being restored on cold start. */
export function getSessionRestoring(): boolean {
  return _sessionRestoring;
}

/**
 * Subscribe to session-restore state changes.
 * Returns an unsubscribe function.
 */
export function subscribeSessionRestoring(listener: (restoring: boolean) => void): () => void {
  _sessionRestoringListeners.add(listener);
  return () => {
    _sessionRestoringListeners.delete(listener);
  };
}

let authQueryCacheWatchPromise: Promise<() => void> | null = null;
let authQueryCacheWatchStop: (() => void) | null = null;

/**
 * Posts a message to the active Service Worker.
 *
 * Guards:
 * - No-op when SW is not supported (native, SSR, node env, test env).
 * - No-op when no SW is controlling the page yet.
 * - Never throws — failure is silently swallowed.
 *
 * Used to keep the SW's user-cache cleanup lifecycle in sync with the app's
 * auth state so logout/user-switch still purges all user-scoped caches.
 */
async function postToServiceWorker(message: { type: string; userId?: string }): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const sw =
      navigator.serviceWorker.controller ??
      (await navigator.serviceWorker.ready).active;
    sw?.postMessage(message);
  } catch {
    // SW unavailable — silent no-op
  }
}

export async function watchAuthQueryCache(): Promise<() => void> {
  // One-time cleanup of the pre-namespacing legacy key (shipped before 2026-06-09).
  // Devices running an older build have 'recipedeck-query-cache' (no user suffix)
  // in AsyncStorage — remove it unconditionally so it doesn't accumulate on-device.
  void AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);

  const { getSupabaseClient } = await import('./auth');
  const supabase = getSupabaseClient();
  if (!supabase) {
    // Supabase is not configured (e.g. missing env vars).
    // Immediately resolve the session-restore gate so the app can render
    // instead of displaying the "Session wird wiederhergestellt…" spinner forever.
    if (_sessionRestoring) {
      _sessionRestoring = false;
      for (const l of _sessionRestoringListeners) {
        l(false);
      }
    }
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user.id ?? null;
    const nextKey = getQueryCacheKey(nextUserId);

    const isFirstEvent = activeAuthUserId === undefined;
    const userChanged = !isFirstEvent && activeAuthUserId !== nextUserId;

    // On cold start the in-memory cache was loaded by restoreClient(), so compare
    // against the key it actually restored (which reflects the real signed-in user
    // resolved from the stored session). On a hot switch compare against the
    // previously-active user's key.
    const prevKey = isFirstEvent
      ? (restoredCacheKey ?? getQueryCacheKey(activeAuthUserId ?? null))
      : getQueryCacheKey(activeAuthUserId ?? null);

    if (isFirstEvent && _sessionRestoring) {
      _sessionRestoring = false;
      for (const l of _sessionRestoringListeners) {
        l(false);
      }
    }

    if (isFirstEvent) {
      // Cold-start: the persister may have already restored the cache for a
      // different user (e.g. anon or a previous user).  If the restored key
      // differs from the key for the incoming session user we must discard it.
      if (prevKey !== nextKey) {
        void queryClient.clear();
        void AsyncStorage.removeItem(prevKey);
      }
    } else if (userChanged) {
      // Hot switch: user logged out or switched to a different account.
      void queryClient.clear();
      void AsyncStorage.removeItem(prevKey);
    }

    activeAuthUserId = nextUserId;

    // --- SW cache sync ---
    if (userChanged && nextUserId) {
      // Hot user switch A→B: purge A's cache first, then set B.
      void postToServiceWorker({ type: 'CLEAR_USER' });
      void postToServiceWorker({ type: 'SET_USER', userId: nextUserId });
    } else if (nextUserId) {
      // Signed in (first event with a user, or re-sign-in of same user).
      void postToServiceWorker({ type: 'SET_USER', userId: nextUserId });
    } else {
      // Signed out (nextUserId is null).
      void postToServiceWorker({ type: 'CLEAR_USER' });
    }
  });

  return () => data.subscription.unsubscribe();
}

export async function startAuthQueryCacheWatch(): Promise<() => void> {
  if (authQueryCacheWatchStop) {
    return authQueryCacheWatchStop;
  }

  if (!authQueryCacheWatchPromise) {
    authQueryCacheWatchPromise = watchAuthQueryCache().then((stop) => {
      authQueryCacheWatchStop = () => {
        stop();
        authQueryCacheWatchStop = null;
        authQueryCacheWatchPromise = null;
      };
      return authQueryCacheWatchStop;
    });
  }

  return authQueryCacheWatchPromise;
}
