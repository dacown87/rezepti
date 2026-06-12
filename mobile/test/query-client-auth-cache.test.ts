import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthStateChangeCallback = (event: string, session: { user: { id: string } } | null) => void;

describe('query-client auth cache isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears in-memory and persisted query cache when the auth user changes (hot switch)', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { getQueryCacheKey, queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // First event: INITIAL_SESSION for user-a — clears the anon cache slot on cold start,
    // then user-a's own data arrives (via fetch or cache restore).
    callback?.('SIGNED_IN', { user: { id: 'user-a' } });
    queryClient.setQueryData(['recipes'], [{ id: 1, name: 'Cached for user A' }]);
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 1, name: 'Cached for user A' }]);

    // Hot switch: user-a → user-b — user-a's cache must be cleared.
    callback?.('SIGNED_IN', { user: { id: 'user-b' } });
    await Promise.resolve();

    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(getQueryCacheKey('user-a'));

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('clears in-memory and persisted query cache on cold start when restored cache belongs to a different user', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { getQueryCacheKey, queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    // Simulate data that was restored from a *different* user's persisted cache
    // (or from the anonymous slot) before auth fires.
    queryClient.setQueryData(['recipes'], [{ id: 99, name: 'Stale cache from user A' }]);

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // Cold start: INITIAL_SESSION fires for user-b.
    // activeAuthUserId was `undefined`, so prevKey = getQueryCacheKey(null) = "…-anon"
    // which differs from getQueryCacheKey('user-b') = "…-user-b".
    callback?.('INITIAL_SESSION', { user: { id: 'user-b' } });
    await Promise.resolve();

    // Cache must be cleared because the restored (anon) key ≠ user-b's key.
    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(getQueryCacheKey(null));

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does NOT clear cache on cold start when the restored cache already belongs to the current user', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { queryClient, watchAuthQueryCache, getQueryCacheKey, QUERY_CACHE_STORAGE_KEY } = await import('@/utils/query-client');

    // Simulate cache restored from the anonymous slot (no prior signed-in user).
    // If INITIAL_SESSION fires for null (still anonymous) the keys match and no
    // clear should happen.
    queryClient.setQueryData(['recipes'], [{ id: 7, name: 'Anon cached recipe' }]);

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // Cold start: INITIAL_SESSION fires with no user (still anonymous).
    // prevKey = getQueryCacheKey(null), nextKey = getQueryCacheKey(null) — same key.
    callback?.('INITIAL_SESSION', null);
    await Promise.resolve();

    // Keys match → no clear.
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 7, name: 'Anon cached recipe' }]);
    // Legacy-key one-time cleanup always fires; the user-scoped anon cache must not be cleared.
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUERY_CACHE_STORAGE_KEY);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(getQueryCacheKey(null));

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('getQueryCacheKey returns user-scoped keys', async () => {
    const { getQueryCacheKey } = await import('@/utils/query-client');

    expect(getQueryCacheKey('abc-123')).toBe('recipedeck-query-cache-abc-123');
    expect(getQueryCacheKey(null)).toBe('recipedeck-query-cache-anon');
    expect(getQueryCacheKey('user-a')).not.toBe(getQueryCacheKey('user-b'));
    expect(getQueryCacheKey('user-a')).not.toBe(getQueryCacheKey(null));
  });
});
