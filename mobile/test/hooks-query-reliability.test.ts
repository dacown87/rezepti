import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let RECIPES_QUERY_KEY: readonly ['recipes'];
let useRecipes: () => unknown;
let useInvalidateRecipes: () => () => unknown;
let recipeQueryKey: (id: number) => readonly ['recipe', number];
let useRecipe: (id: number) => unknown;
let useUpdateRecipe: (id: number) => unknown;
let useDeleteRecipe: (id: number) => unknown;
let fetchRecipes: () => Promise<unknown>;
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

describe('phase-2 reliability: hooks query behavior and cache semantics', () => {
  beforeAll(async () => {
    ({ RECIPES_QUERY_KEY, useRecipes, useInvalidateRecipes } = await import('@/hooks/useRecipes'));
    ({ recipeQueryKey, useRecipe, useUpdateRecipe, useDeleteRecipe } = await import('@/hooks/useRecipe'));
    ({ fetchRecipes, fetchRecipeById, patchRecipe, deleteRecipe } = await import('@/utils/api'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('useRecipes wires stable query key and fetch function', () => {
    let capturedQueryKey: readonly ['recipes'] | undefined;
    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryKey: readonly ['recipes']; queryFn: () => Promise<unknown> }) => {
      capturedQueryKey = config.queryKey;
      capturedQueryFn = config.queryFn;
      return { data: [] };
    });

    useRecipes();

    expect(capturedQueryKey).toEqual(['recipes']);
    expect(capturedQueryKey).toBe(RECIPES_QUERY_KEY);
    expect(capturedQueryFn).toBe(fetchRecipes);
  });

  it('useRecipes query function propagates fetch errors and supports retry-path re-invocation', async () => {
    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = config.queryFn;
      return { data: undefined };
    });
    vi.mocked(fetchRecipes)
      .mockRejectedValueOnce(new Error('offline on first attempt'))
      .mockResolvedValueOnce([{ id: 1, name: 'Recovered' }]);

    useRecipes();

    await expect(capturedQueryFn?.()).rejects.toThrow('offline on first attempt');
    await expect(capturedQueryFn?.()).resolves.toEqual([{ id: 1, name: 'Recovered' }]);
    expect(fetchRecipes).toHaveBeenCalledTimes(2);
  });

  it('useInvalidateRecipes invalidates only the recipes list cache key', () => {
    const invalidate = useInvalidateRecipes();

    invalidate();

    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('useRecipe uses recipeQueryKey(id), forwards id to fetchRecipeById and is enabled for valid ids', async () => {
    let capturedQueryKey: readonly ['recipe', number] | undefined;
    let capturedEnabled: boolean | undefined;
    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: {
      queryKey: readonly ['recipe', number];
      enabled: boolean;
      queryFn: () => Promise<unknown>;
    }) => {
      capturedQueryKey = config.queryKey;
      capturedEnabled = config.enabled;
      capturedQueryFn = config.queryFn;
      return { data: undefined };
    });
    vi.mocked(fetchRecipeById).mockResolvedValueOnce({ id: 9, name: 'Suppe' });

    useRecipe(9);

    expect(capturedQueryKey).toEqual(['recipe', 9]);
    expect(capturedQueryKey).toEqual(recipeQueryKey(9));
    expect(capturedEnabled).toBe(true);
    await expect(capturedQueryFn?.()).resolves.toEqual({ id: 9, name: 'Suppe' });
    expect(fetchRecipeById).toHaveBeenCalledWith(9);
  });

  it('useRecipe disables invalid ids (0 and negative) to prevent invalid fetches', () => {
    const seen: Array<{ key: readonly ['recipe', number]; enabled: boolean }> = [];
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryKey: readonly ['recipe', number]; enabled: boolean }) => {
      seen.push({ key: config.queryKey, enabled: config.enabled });
      return { data: undefined };
    });

    useRecipe(0);
    useRecipe(-3);

    expect(seen).toEqual([
      { key: ['recipe', 0], enabled: false },
      { key: ['recipe', -3], enabled: false },
    ]);
  });

  it('useRecipe propagates detail fetch errors for UI error boundaries/fallbacks', async () => {
    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      capturedQueryFn = config.queryFn;
      return { data: undefined, error: undefined };
    });
    vi.mocked(fetchRecipeById).mockRejectedValueOnce(new Error('detail endpoint unavailable'));

    useRecipe(77);

    await expect(capturedQueryFn?.()).rejects.toThrow('detail endpoint unavailable');
  });

  it('useUpdateRecipe invalidates detail + list caches after successful mutation', async () => {
    let mutationFn: ((fields: Record<string, unknown>) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: {
      mutationFn: (fields: Record<string, unknown>) => Promise<unknown>;
      onSuccess?: () => void;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    vi.mocked(patchRecipe).mockResolvedValueOnce(undefined);

    useUpdateRecipe(31);
    await mutationFn?.({ source: 'mobile' });
    onSuccess?.();

    expect(patchRecipe).toHaveBeenCalledWith(31, { source: 'mobile' });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(31) });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(reactQueryMocks.removeQueries).not.toHaveBeenCalled();
  });

  it('useDeleteRecipe removes detail cache + invalidates list cache after successful mutation', async () => {
    let mutationFn: (() => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    reactQueryMocks.useMutationMock.mockImplementation((config: { mutationFn: () => Promise<unknown>; onSuccess?: () => void }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    vi.mocked(deleteRecipe).mockResolvedValueOnce(undefined);

    useDeleteRecipe(31);
    await mutationFn?.();
    onSuccess?.();

    expect(deleteRecipe).toHaveBeenCalledWith(31);
    expect(reactQueryMocks.removeQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(31) });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
  });
});
