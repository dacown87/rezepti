import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthStateChangeCallback = (event: string, session: { user: { id: string } } | null) => void;

// RC3 regression: on cold start, PersistQueryClientProvider calls restoreClient()
// BEFORE the first auth event fires (activeAuthUserId === undefined). The old code
// therefore restored the empty "anon" slot, so the recipe list was blank offline
// even though the user's recipes are persisted under their own per-user key.
// restoreClient must resolve the signed-in user from the stored Supabase session
// and restore THAT key; the first auth event for the same user must NOT clear it.

describe('query-client offline restore (RC3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('restoreClient restores the signed-in user’s cache key, not the anon slot', async () => {
    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
      }),
      getAuthSession: vi.fn(async () => ({ user: { id: 'user-x' } })),
    }));

    const { asyncStoragePersister, getQueryCacheKey } = await import('@/utils/query-client');
    const getItemSpy = vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);

    await asyncStoragePersister.restoreClient();

    expect(getItemSpy).toHaveBeenCalledWith(getQueryCacheKey('user-x'));
    expect(getItemSpy).not.toHaveBeenCalledWith(getQueryCacheKey(null));
  });

  it('does NOT clear the restored cache when the first auth event matches the restored user', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (cb: AuthStateChangeCallback) => {
            authStateCallbacks.push(cb);
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          },
        },
      }),
      getAuthSession: vi.fn(async () => ({ user: { id: 'user-x' } })),
    }));

    const { asyncStoragePersister, queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    // Cold start: persister resolves user-x and restores their cache key.
    await asyncStoragePersister.restoreClient();
    // Simulate the recipes that were restored from user-x's persisted cache.
    queryClient.setQueryData(['recipes'], [{ id: 1, name: 'Offline Pasta' }]);

    const stop = await watchAuthQueryCache();
    authStateCallbacks.at(-1)?.('INITIAL_SESSION', { user: { id: 'user-x' } });
    await Promise.resolve();

    // prevKey (restored user-x) === nextKey (user-x) → no clear → offline-read survives.
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 1, name: 'Offline Pasta' }]);

    stop();
  });

  it('still clears when the restored cache belongs to a DIFFERENT user than the session (privacy boundary)', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (cb: AuthStateChangeCallback) => {
            authStateCallbacks.push(cb);
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          },
        },
      }),
      getAuthSession: vi.fn(async () => ({ user: { id: 'user-a' } })),
    }));

    const { asyncStoragePersister, queryClient, watchAuthQueryCache, getQueryCacheKey } =
      await import('@/utils/query-client');

    await asyncStoragePersister.restoreClient(); // restores user-a's key
    queryClient.setQueryData(['recipes'], [{ id: 9, name: 'User-A leftover' }]);

    const stop = await watchAuthQueryCache();
    // Session actually belongs to user-b (e.g. token swapped) → restored user-a cache must be wiped.
    authStateCallbacks.at(-1)?.('INITIAL_SESSION', { user: { id: 'user-b' } });
    await Promise.resolve();

    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(getQueryCacheKey('user-a'));

    stop();
  });
});
