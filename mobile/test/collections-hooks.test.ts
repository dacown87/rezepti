/**
 * Unit tests for useCollections and related mutation hooks.
 * Follows the pattern in mobile/test/recipe-workflow-cache-mutations.test.ts.
 *
 * Key invariant: each mutation invalidates exactly the right query keys.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Types declared upfront so dynamic imports can assign into them ─────────────
let COLLECTIONS_QUERY_KEY: readonly ['recipe-collections'];
let RECIPES_QUERY_KEY: readonly ['recipes'];
let recipeQueryKey: (id: number) => readonly ['recipe', number];
let useCollections: () => unknown;
let useShareRecipe: () => unknown;
let useToggleFavorite: () => unknown;
let useCreateCollection: () => unknown;
let useRenameCollection: () => unknown;
let useDeleteCollection: () => unknown;
let useAddRecipeToCollection: () => unknown;
let useRemoveRecipeFromCollection: () => unknown;
let useCreateRecipeShareInvite: () => unknown;
let useAcceptRecipeShareInvite: () => unknown;

// API mocks
let shareRecipeMock: ReturnType<typeof vi.fn>;
let setRecipeFavoriteMock: ReturnType<typeof vi.fn>;
let fetchCollectionsMock: ReturnType<typeof vi.fn>;
let createCollectionMock: ReturnType<typeof vi.fn>;
let renameCollectionMock: ReturnType<typeof vi.fn>;
let deleteCollectionMock: ReturnType<typeof vi.fn>;
let addRecipeToCollectionMock: ReturnType<typeof vi.fn>;
let removeRecipeFromCollectionMock: ReturnType<typeof vi.fn>;
let reorderCollectionItemsMock: ReturnType<typeof vi.fn>;
let bulkRemoveFromCollectionMock: ReturnType<typeof vi.fn>;
let bulkCopyCollectionItemsMock: ReturnType<typeof vi.fn>;
let createRecipeShareInviteMock: ReturnType<typeof vi.fn>;
let fetchRecipeShareInviteMock: ReturnType<typeof vi.fn>;
let acceptRecipeShareInviteMock: ReturnType<typeof vi.fn>;

const rqMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: rqMocks.invalidateQueries,
    removeQueries: rqMocks.removeQueries,
  })),
  useQuery: rqMocks.useQueryMock,
  useMutation: rqMocks.useMutationMock,
}));

vi.mock('@/offline/network-status', () => ({
  isOnline: vi.fn(() => true),
}));

vi.mock('@/utils/api', () => {
  shareRecipeMock = vi.fn();
  setRecipeFavoriteMock = vi.fn();
  fetchCollectionsMock = vi.fn();
  createCollectionMock = vi.fn();
  renameCollectionMock = vi.fn();
  deleteCollectionMock = vi.fn();
  addRecipeToCollectionMock = vi.fn();
  removeRecipeFromCollectionMock = vi.fn();
  reorderCollectionItemsMock = vi.fn();
  bulkRemoveFromCollectionMock = vi.fn();
  bulkCopyCollectionItemsMock = vi.fn();
  createRecipeShareInviteMock = vi.fn();
  fetchRecipeShareInviteMock = vi.fn();
  acceptRecipeShareInviteMock = vi.fn();

  return {
    shareRecipe: shareRecipeMock,
    setRecipeFavorite: setRecipeFavoriteMock,
    fetchCollections: fetchCollectionsMock,
    createCollection: createCollectionMock,
    renameCollection: renameCollectionMock,
    deleteCollection: deleteCollectionMock,
    addRecipeToCollection: addRecipeToCollectionMock,
    removeRecipeFromCollection: removeRecipeFromCollectionMock,
    reorderCollectionItems: reorderCollectionItemsMock,
    bulkRemoveFromCollection: bulkRemoveFromCollectionMock,
    bulkCopyCollectionItems: bulkCopyCollectionItemsMock,
    createRecipeShareInvite: createRecipeShareInviteMock,
    fetchRecipeShareInvite: fetchRecipeShareInviteMock,
    acceptRecipeShareInvite: acceptRecipeShareInviteMock,
    // Existing functions that other hooks import
    fetchRecipes: vi.fn(),
    fetchRecipeById: vi.fn(),
    patchRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  };
});

describe('useCollections hooks — query keys and invalidation', () => {
  beforeAll(async () => {
    ({
      COLLECTIONS_QUERY_KEY,
      useCollections,
      useShareRecipe,
      useToggleFavorite,
      useCreateCollection,
      useRenameCollection,
      useDeleteCollection,
      useAddRecipeToCollection,
      useRemoveRecipeFromCollection,
      useCreateRecipeShareInvite,
      useAcceptRecipeShareInvite,
    } = await import('@/hooks/useCollections'));
    ({ RECIPES_QUERY_KEY } = await import('@/hooks/useRecipes'));
    ({ recipeQueryKey } = await import('@/hooks/useRecipe'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── useCollections query ────────────────────────────────────────────────────

  it('useCollections uses COLLECTIONS_QUERY_KEY and fetchCollections', () => {
    let capturedKey: unknown;
    let capturedFn: unknown;
    rqMocks.useQueryMock.mockImplementation((config: { queryKey: unknown; queryFn: unknown }) => {
      capturedKey = config.queryKey;
      capturedFn = config.queryFn;
      return { data: [] };
    });

    useCollections();

    expect(capturedKey).toEqual(['recipe-collections']);
    expect(capturedKey).toBe(COLLECTIONS_QUERY_KEY);
    expect(capturedFn).toBe(fetchCollectionsMock);
  });

  // ── useShareRecipe mutation ─────────────────────────────────────────────────

  it('useShareRecipe invalidates RECIPES_QUERY_KEY on success', async () => {
    let mutationFn: ((vars: { id: number; target: 'household' | 'user'; householdId?: string }) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    shareRecipeMock.mockResolvedValueOnce({ id: 99, name: 'Copy', ingredients: '[]', steps: '[]' });

    useShareRecipe();
    await mutationFn?.({ id: 5, target: 'household', householdId: 'hh-2' });
    onSuccess?.();

    expect(shareRecipeMock).toHaveBeenCalledWith(5, 'household', 'hh-2');
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    // Should NOT touch collections key
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
  });

  // ── useToggleFavorite mutation ───────────────────────────────────────────────

  it('useToggleFavorite invalidates RECIPES_QUERY_KEY and recipeQueryKey(id) on success', async () => {
    let mutationFn: ((vars: { id: number; on: boolean }) => Promise<unknown>) | undefined;
    let onSuccess: ((data: unknown, vars: { id: number; on: boolean }) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    setRecipeFavoriteMock.mockResolvedValueOnce(true);

    useToggleFavorite();
    await mutationFn?.({ id: 11, on: true });
    onSuccess?.(true, { id: 11, on: true });

    expect(setRecipeFavoriteMock).toHaveBeenCalledWith(11, true);
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(11) });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('useToggleFavorite invalidates the correct detail key (not a different id)', async () => {
    let mutationFn: ((vars: { id: number; on: boolean }) => Promise<unknown>) | undefined;
    let onSuccess: ((data: unknown, vars: { id: number; on: boolean }) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    setRecipeFavoriteMock.mockResolvedValueOnce(false);

    useToggleFavorite();
    await mutationFn?.({ id: 77, on: false });
    onSuccess?.(false, { id: 77, on: false });

    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe', 77] });
    // Regression guard: not called with the wrong id
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['recipe', 11] });
  });

  // ── useCreateCollection mutation ─────────────────────────────────────────────

  it('useCreateCollection invalidates COLLECTIONS_QUERY_KEY on success', async () => {
    let mutationFn: ((input: { name: string }) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    createCollectionMock.mockResolvedValueOnce({ id: 'c1', kind: 'custom', name: 'Neu', owner_type: 'user', household_id: null, item_count: 0, is_system: false });

    useCreateCollection();
    await mutationFn?.({ name: 'Neu' });
    onSuccess?.();

    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  // ── useRenameCollection mutation ─────────────────────────────────────────────

  it('useRenameCollection invalidates COLLECTIONS_QUERY_KEY on success', async () => {
    let mutationFn: ((vars: { id: string; name: string }) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    renameCollectionMock.mockResolvedValueOnce(undefined);

    useRenameCollection();
    await mutationFn?.({ id: 'c1', name: 'Umbenannt' });
    onSuccess?.();

    expect(renameCollectionMock).toHaveBeenCalledWith('c1', 'Umbenannt');
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  // ── useDeleteCollection mutation ─────────────────────────────────────────────

  it('useDeleteCollection invalidates COLLECTIONS_QUERY_KEY on success', async () => {
    let mutationFn: ((id: string) => Promise<unknown>) | undefined;
    let onSuccess: (() => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    deleteCollectionMock.mockResolvedValueOnce(undefined);

    useDeleteCollection();
    await mutationFn?.('c1');
    onSuccess?.();

    expect(deleteCollectionMock).toHaveBeenCalledWith('c1');
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  // ── useAddRecipeToCollection mutation ────────────────────────────────────────

  it('useAddRecipeToCollection invalidates COLLECTIONS_QUERY_KEY + collection-items but NOT recipe keys', async () => {
    let mutationFn: ((vars: { collectionId: string; recipeId: number; targetHouseholdId?: string }) => Promise<unknown>) | undefined;
    let onSuccess: ((data: unknown, vars: { collectionId: string; recipeId: number; targetHouseholdId?: string }) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    addRecipeToCollectionMock.mockResolvedValueOnce({ added: true });

    useAddRecipeToCollection();
    await mutationFn?.({ collectionId: 'c1', recipeId: 7, targetHouseholdId: 'hh-2' });
    onSuccess?.({ added: true, recipeId: 7, copied: false }, { collectionId: 'c1', recipeId: 7, targetHouseholdId: 'hh-2' });

    expect(addRecipeToCollectionMock).toHaveBeenCalledWith('c1', 7, 'hh-2');
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    // The target collection's contents list must refresh to include the added recipe.
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-collections', 'c1', 'items'] });
    // Recipe keys must NOT be invalidated — adding to a collection does not change the recipe
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: recipeQueryKey(7) });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('useAddRecipeToCollection invalidates recipe keys when the server created a household copy', async () => {
    let mutationFn: ((vars: { collectionId: string; recipeId: number; targetHouseholdId?: string }) => Promise<unknown>) | undefined;
    let onSuccess: ((data: { recipeId: number; copied: boolean }, vars: { collectionId: string; recipeId: number; targetHouseholdId?: string }) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    addRecipeToCollectionMock.mockResolvedValueOnce({ added: true, recipeId: 77, copied: true });

    useAddRecipeToCollection();
    await mutationFn?.({ collectionId: 'c1', recipeId: 7 });
    onSuccess?.({ recipeId: 77, copied: true }, { collectionId: 'c1', recipeId: 7 });

    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-collections', 'c1', 'items'] });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: recipeQueryKey(77) });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(4);
  });

  it('useCreateRecipeShareInvite delegates without cache invalidation', async () => {
    let mutationFn: ((vars: { id: number; email: string }) => Promise<unknown>) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: { mutationFn: typeof mutationFn }) => {
      mutationFn = config.mutationFn;
      return { mutate: vi.fn() };
    });
    createRecipeShareInviteMock.mockResolvedValueOnce({ token: 'token-1' });

    useCreateRecipeShareInvite();
    await mutationFn?.({ id: 7, email: 'friend@example.com' });

    expect(createRecipeShareInviteMock).toHaveBeenCalledWith(7, 'friend@example.com');
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('useAcceptRecipeShareInvite invalidates recipes and invite preview', async () => {
    let mutationFn: ((token: string) => Promise<unknown>) | undefined;
    let onSuccess: ((data: unknown, token: string) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    acceptRecipeShareInviteMock.mockResolvedValueOnce({ recipe: { id: 7 } });

    useAcceptRecipeShareInvite();
    await mutationFn?.('token-1');
    onSuccess?.({ recipe: { id: 7 } }, 'token-1');

    expect(acceptRecipeShareInviteMock).toHaveBeenCalledWith('token-1');
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-share-invite', 'token-1'] });
  });

  // ── useRemoveRecipeFromCollection mutation ────────────────────────────────────

  it('useRemoveRecipeFromCollection invalidates COLLECTIONS_QUERY_KEY + collection-items but NOT recipe keys', async () => {
    let mutationFn: ((vars: { collectionId: string; recipeId: number }) => Promise<unknown>) | undefined;
    let onSuccess: ((data: unknown, vars: { collectionId: string; recipeId: number }) => void) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
      onSuccess?: typeof onSuccess;
    }) => {
      mutationFn = config.mutationFn;
      onSuccess = config.onSuccess;
      return { mutate: vi.fn() };
    });
    removeRecipeFromCollectionMock.mockResolvedValueOnce(undefined);

    useRemoveRecipeFromCollection();
    await mutationFn?.({ collectionId: 'c1', recipeId: 7 });
    onSuccess?.(undefined, { collectionId: 'c1', recipeId: 7 });

    expect(removeRecipeFromCollectionMock).toHaveBeenCalledWith('c1', 7);
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: COLLECTIONS_QUERY_KEY });
    // The collection's contents list must drop the removed recipe.
    expect(rqMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['recipe-collections', 'c1', 'items'] });
    expect(rqMocks.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: RECIPES_QUERY_KEY });
    expect(rqMocks.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  // ── useCollectionItems query ─────────────────────────────────────────────────

  it('useCollectionItems uses the per-collection items key and is enabled only with an id', async () => {
    const { useCollectionItems, collectionItemsQueryKey } = await import('@/hooks/useCollections');
    let capturedKey: unknown;
    let capturedEnabled: unknown;
    rqMocks.useQueryMock.mockImplementation((config: { queryKey: unknown; enabled?: unknown }) => {
      capturedKey = config.queryKey;
      capturedEnabled = config.enabled;
      return { data: [] };
    });

    useCollectionItems('c1');
    expect(capturedKey).toEqual(collectionItemsQueryKey('c1'));
    expect(capturedKey).toEqual(['recipe-collections', 'c1', 'items']);
    expect(capturedEnabled).toBe(true);

    useCollectionItems(undefined);
    expect(capturedEnabled).toBe(false);
  });

  // ── No-invalidation on error paths ───────────────────────────────────────────

  it('useToggleFavorite does not invalidate on error path', async () => {
    let mutationFn: ((vars: { id: number; on: boolean }) => Promise<unknown>) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
    }) => {
      mutationFn = config.mutationFn;
      return { mutate: vi.fn() };
    });
    setRecipeFavoriteMock.mockRejectedValueOnce(new Error('network error'));

    useToggleFavorite();
    await expect(mutationFn?.({ id: 11, on: true })).rejects.toThrow('network error');

    expect(rqMocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('useCreateCollection does not invalidate on error path', async () => {
    let mutationFn: ((input: { name: string }) => Promise<unknown>) | undefined;
    rqMocks.useMutationMock.mockImplementation((config: {
      mutationFn: typeof mutationFn;
    }) => {
      mutationFn = config.mutationFn;
      return { mutate: vi.fn() };
    });
    createCollectionMock.mockRejectedValueOnce(new Error('server error'));

    useCreateCollection();
    await expect(mutationFn?.({ name: 'X' })).rejects.toThrow('server error');

    expect(rqMocks.invalidateQueries).not.toHaveBeenCalled();
  });
});
