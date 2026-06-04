import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthStateChangeCallback = (event: string, session: { user: { id: string } } | null) => void;

describe('query-client auth cache isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears in-memory and persisted query cache when the auth user changes', async () => {
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

    const { QUERY_CACHE_STORAGE_KEY, queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    queryClient.setQueryData(['recipes'], [{ id: 1, name: 'Cached for user A' }]);
    const stopWatching = watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    callback?.('SIGNED_IN', { user: { id: 'user-a' } });
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 1, name: 'Cached for user A' }]);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    callback?.('SIGNED_IN', { user: { id: 'user-b' } });
    await Promise.resolve();

    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUERY_CACHE_STORAGE_KEY);

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
