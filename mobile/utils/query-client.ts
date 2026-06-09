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
 * A thin persister wrapper whose storage key tracks the active user.
 * We re-create the underlying base persister on every operation so
 * the correct user-scoped key is always used without needing a React
 * context or prop-drilling.
 */
function makePersisterForCurrentUser() {
  const key = getQueryCacheKey(activeAuthUserId ?? null);
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key,
    throttleTime: 1000,
  });
}

export const asyncStoragePersister = {
  persistClient: async (client: Parameters<ReturnType<typeof createAsyncStoragePersister>['persistClient']>[0]) => {
    return makePersisterForCurrentUser().persistClient(client);
  },
  restoreClient: async () => {
    const persister = makePersisterForCurrentUser();
    const key = getQueryCacheKey(activeAuthUserId ?? null);
    try {
      return await persister.restoreClient();
    } catch {
      try {
        await AsyncStorage.removeItem(key);
      } catch { /* ignore cleanup failure */ }
      return undefined;
    }
  },
  removeClient: async () => {
    return makePersisterForCurrentUser().removeClient();
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

export async function watchAuthQueryCache(): Promise<() => void> {
  const { getSupabaseClient } = await import('./auth');
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user.id ?? null;
    const prevKey = getQueryCacheKey(activeAuthUserId ?? null);
    const nextKey = getQueryCacheKey(nextUserId);

    const isFirstEvent = activeAuthUserId === undefined;
    const userChanged = !isFirstEvent && activeAuthUserId !== nextUserId;

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
