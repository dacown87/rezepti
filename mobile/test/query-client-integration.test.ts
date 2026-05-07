import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  asyncStoragePersister,
  QUERY_CACHE_STORAGE_KEY,
  queryClient as appQueryClient,
} from '@/utils/query-client';

const RECIPES_QUERY_KEY = ['recipes'] as const;
const recipeQueryKey = (id: number) => ['recipe', id] as const;

describe('react-query integration: cache invalidation + recovery', () => {
  it('matches production query-client recovery defaults used by screens', () => {
    const defaults = appQueryClient.getDefaultOptions();
    const retryDelay = defaults.queries?.retryDelay;

    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
    expect(defaults.queries?.gcTime).toBe(24 * 60 * 60 * 1000);
    expect(defaults.queries?.retry).toBe(2);
    expect(typeof retryDelay).toBe('function');
    if (typeof retryDelay !== 'function') {
      throw new Error('retryDelay should be a function');
    }
    expect(retryDelay(1, new Error('transient'))).toBe(2000);
    expect(retryDelay(4, new Error('still failing'))).toBe(10_000);
    expect(defaults.mutations?.retry).toBe(1);
  });

  it('retries transient list fetch failures and succeeds on recovery attempt', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 2,
          retryDelay: () => 0,
        },
      },
    });
    let attempts = 0;

    const recovered = await queryClient.fetchQuery({
      queryKey: RECIPES_QUERY_KEY,
      queryFn: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('temporary outage');
        }
        return [{ id: 22, name: 'Recovered after retries' }];
      },
    });

    expect(recovered).toEqual([{ id: 22, name: 'Recovered after retries' }]);
    expect(attempts).toBe(3);
  });

  it('recovers after offline-first failure when query is re-fetched', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let attempts = 0;

    const queryFn = async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Network request failed');
      }
      return [{ id: 11, name: 'Recovered recipe' }];
    };

    await expect(
      queryClient.fetchQuery({
        queryKey: RECIPES_QUERY_KEY,
        queryFn,
      })
    ).rejects.toThrow('Network request failed');

    await expect(
      queryClient.fetchQuery({
        queryKey: RECIPES_QUERY_KEY,
        queryFn,
      })
    ).resolves.toEqual([{ id: 11, name: 'Recovered recipe' }]);

    expect(attempts).toBe(2);
  });

  it('keeps last successful list data in cache when a later refetch fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await queryClient.fetchQuery({
      queryKey: RECIPES_QUERY_KEY,
      queryFn: async () => [{ id: 11, name: 'Cached list data' }],
    });

    await expect(
      queryClient.fetchQuery({
        queryKey: RECIPES_QUERY_KEY,
        staleTime: 0,
        queryFn: async () => {
          throw new Error('offline during refetch');
        },
      })
    ).rejects.toThrow('offline during refetch');

    expect(queryClient.getQueryData(RECIPES_QUERY_KEY)).toEqual([{ id: 11, name: 'Cached list data' }]);
  });

  it('invalidates list and detail keys and triggers refetch with updated data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const detailKey = recipeQueryKey(11);
    let listVersion = 0;
    let detailVersion = 0;

    const listQueryFn = async () => {
      listVersion += 1;
      return [{ id: 11, name: `Pasta v${listVersion}` }];
    };
    const detailQueryFn = async () => {
      detailVersion += 1;
      return { id: 11, name: `Pasta detail v${detailVersion}` };
    };

    await queryClient.fetchQuery({ queryKey: RECIPES_QUERY_KEY, queryFn: listQueryFn });
    await queryClient.fetchQuery({ queryKey: detailKey, queryFn: detailQueryFn });

    expect(queryClient.getQueryData(RECIPES_QUERY_KEY)).toEqual([{ id: 11, name: 'Pasta v1' }]);
    expect(queryClient.getQueryData(detailKey)).toEqual({ id: 11, name: 'Pasta detail v1' });

    await queryClient.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: detailKey });
    await queryClient.refetchQueries({ queryKey: RECIPES_QUERY_KEY });
    await queryClient.refetchQueries({ queryKey: detailKey });

    expect(queryClient.getQueryData(RECIPES_QUERY_KEY)).toEqual([{ id: 11, name: 'Pasta v2' }]);
    expect(queryClient.getQueryData(detailKey)).toEqual({ id: 11, name: 'Pasta detail v2' });
  });

  it('discards corrupted persisted cache instead of propagating restore errors', async () => {
    const getItemSpy = vi.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{not-valid-json');
    const removeItemSpy = vi.spyOn(AsyncStorage, 'removeItem').mockResolvedValueOnce();

    await expect(asyncStoragePersister.restoreClient()).resolves.toBeUndefined();
    expect(getItemSpy).toHaveBeenCalledWith(QUERY_CACHE_STORAGE_KEY);
    expect(removeItemSpy).toHaveBeenCalledWith(QUERY_CACHE_STORAGE_KEY);
  });
});
