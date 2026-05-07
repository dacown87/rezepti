import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiToRecipe } from '@/utils/recipe-mapper';

let RECIPES_QUERY_KEY: readonly ['recipes'];
let recipeQueryKey: (id: number) => readonly ['recipe', number];
let useRecipe: (id: number) => unknown;
let useDeleteRecipe: (id: number) => unknown;
let useUpdateRecipe: (id: number) => unknown;
let fetchRecipeById: (id: number) => Promise<unknown>;
let patchRecipe: (id: number, fields: Record<string, unknown>) => Promise<unknown>;
let deleteRecipe: (id: number) => Promise<unknown>;

const reactQueryMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      invalidateQueries: reactQueryMocks.invalidateQueries,
      removeQueries: reactQueryMocks.removeQueries,
    })),
    useQuery: reactQueryMocks.useQueryMock,
    useMutation: reactQueryMocks.useMutationMock,
  };
});

vi.mock('@/utils/api', () => ({
  fetchRecipes: vi.fn(),
  fetchRecipeById: vi.fn(),
  patchRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

describe('workflow reliability: list/search/detail cache + mutations', () => {
  beforeAll(async () => {
    ({ RECIPES_QUERY_KEY } = await import('@/hooks/useRecipes'));
    ({ recipeQueryKey, useRecipe, useDeleteRecipe, useUpdateRecipe } = await import('@/hooks/useRecipe'));
    ({ fetchRecipeById, patchRecipe, deleteRecipe } = await import('@/utils/api'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps stable recipe identities from list/search into detail query keys', () => {
    const apiList = [
      { id: 11, name: 'Pasta', ingredients: '["Nudeln"]', steps: '["Kochen"]' },
      { id: 12, name: 'Salat', ingredients: '["Salat"]', steps: '["Mischen"]' },
    ];
    const cachedList = apiList.map(apiToRecipe);
    const searchHit = cachedList.find((r) => r.name.toLowerCase().includes('past'));

    expect(searchHit?.id).toBe(11);
    expect(recipeQueryKey(searchHit!.id)).toEqual(['recipe', 11]);
    expect(RECIPES_QUERY_KEY).toEqual(['recipes']);
  });

  it('update mutation invalidates detail and list caches after success', async () => {
    let mutationFn: ((fields: Record<string, unknown>) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: { mutationFn: (fields: Record<string, unknown>) => Promise<unknown>; onSuccess?: () => void }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    vi.mocked(patchRecipe).mockResolvedValueOnce(undefined);

    useUpdateRecipe(11);
    await mutationFn?.({ rating: 5 });
    onSuccess?.();

    expect(patchRecipe).toHaveBeenCalledWith(11, { rating: 5 });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(11) });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
  });

  it('delete mutation removes detail cache and invalidates list cache after success', async () => {
    let mutationFn: (() => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: { mutationFn: () => Promise<unknown>; onSuccess?: () => void }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    vi.mocked(deleteRecipe).mockResolvedValueOnce(undefined);

    useDeleteRecipe(11);
    await mutationFn?.();
    onSuccess?.();

    expect(deleteRecipe).toHaveBeenCalledWith(11);
    expect(reactQueryMocks.removeQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(11) });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
  });

  it('update mutation does not invalidate caches on mutation error path', async () => {
    let mutationFn: ((fields: Record<string, unknown>) => Promise<unknown>) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: { mutationFn: (fields: Record<string, unknown>) => Promise<unknown> }) => {
      mutationFn = config.mutationFn;
      return { mutate: vi.fn() };
    });
    vi.mocked(patchRecipe).mockRejectedValueOnce(new Error('update failed'));

    useUpdateRecipe(11);
    await expect(mutationFn?.({ rating: 1 })).rejects.toThrow('update failed');

    expect(reactQueryMocks.invalidateQueries).not.toHaveBeenCalled();
    expect(reactQueryMocks.removeQueries).not.toHaveBeenCalled();
  });

  it('delete mutation does not remove/invalidate caches on mutation error path', async () => {
    let mutationFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: { mutationFn: () => Promise<unknown> }) => {
      mutationFn = config.mutationFn;
      return { mutate: vi.fn() };
    });
    vi.mocked(deleteRecipe).mockRejectedValueOnce(new Error('delete failed'));

    useDeleteRecipe(11);
    await expect(mutationFn?.()).rejects.toThrow('delete failed');

    expect(reactQueryMocks.invalidateQueries).not.toHaveBeenCalled();
    expect(reactQueryMocks.removeQueries).not.toHaveBeenCalled();
  });

  it('recipe detail query propagates fetch errors for offline/server failure paths', async () => {
    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = config.queryFn;
      return { data: undefined, error: undefined };
    });
    const offlineError = new Error('Network request failed');
    vi.mocked(fetchRecipeById).mockRejectedValueOnce(offlineError);

    useRecipe(42);

    await expect(capturedQueryFn?.()).rejects.toThrow('Network request failed');
    expect(fetchRecipeById).toHaveBeenCalledWith(42);
  });

  it('recipe detail query is disabled for invalid ids to avoid unnecessary fetch attempts', () => {
    let capturedEnabled: boolean | undefined;
    let capturedQueryKey: readonly ['recipe', number] | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: { enabled: boolean; queryKey: readonly ['recipe', number] }) => {
      capturedEnabled = config.enabled;
      capturedQueryKey = config.queryKey;
      return { data: undefined, error: undefined };
    });

    useRecipe(0);

    expect(capturedQueryKey).toEqual(['recipe', 0]);
    expect(capturedEnabled).toBe(false);
  });
});
