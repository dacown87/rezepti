import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const QUERY_CACHE_STORAGE_KEY = 'recipedeck-query-cache';

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

const baseAsyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1000,
});

export const asyncStoragePersister = {
  ...baseAsyncStoragePersister,
  restoreClient: async () => {
    try {
      return await baseAsyncStoragePersister.restoreClient();
    } catch {
      try {
        await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
      } catch { /* ignore cleanup failure */ }
      return undefined;
    }
  },
};

let activeAuthUserId: string | null | undefined;
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
    if (activeAuthUserId !== undefined && activeAuthUserId !== nextUserId) {
      void queryClient.clear();
      void AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
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
