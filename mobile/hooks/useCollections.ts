import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  shareRecipe,
  setRecipeFavorite,
  type Collection,
} from '@/utils/api';
import { RECIPES_QUERY_KEY } from './useRecipes';
import { recipeQueryKey } from './useRecipe';

export const COLLECTIONS_QUERY_KEY = ['recipe-collections'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch all recipe collections visible to the authenticated user.
 */
export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: fetchCollections,
  });
}

// ── Sharing mutation ──────────────────────────────────────────────────────────

/**
 * Share (copy) a recipe to a household or user-private space.
 *
 * Invalidation: RECIPES_QUERY_KEY
 *   A new recipe is created server-side; the list must be refetched so the
 *   copy appears in the caller's recipe list.
 */
export function useShareRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, target }: { id: number; target: 'household' | 'user' }) =>
      shareRecipe(id, target),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    },
  });
}

// ── Favorite toggle mutation ───────────────────────────────────────────────────

/**
 * Toggle a recipe's favorite state.
 *
 * Invalidation: RECIPES_QUERY_KEY + recipeQueryKey(id)
 *   Both the list (where isFavorite may be shown) and the detail cache
 *   carry the isFavorite field — both must be invalidated so neither
 *   shows a stale state after the toggle.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => setRecipeFavorite(id, on),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: recipeQueryKey(id) });
    },
  });
}

// ── Collection CRUD mutations ─────────────────────────────────────────────────

/**
 * Create a new custom collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY
 *   The new collection must appear in the list.
 */
export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      ownerType?: 'user' | 'household';
      householdId?: string;
    }) => createCollection(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

/**
 * Rename a custom collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY
 *   The updated name must be reflected in the collection list.
 */
export function useRenameCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameCollection(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

/**
 * Delete a custom collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY
 *   The deleted collection must disappear from the list.
 */
export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

/**
 * Add a recipe to a collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY
 *   item_count on the collection changes. Recipe keys are NOT invalidated
 *   because adding a recipe to a collection does not change the recipe itself.
 */
export function useAddRecipeToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      recipeId,
    }: {
      collectionId: string;
      recipeId: number;
    }) => addRecipeToCollection(collectionId, recipeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

/**
 * Remove a recipe from a collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY
 *   item_count on the collection changes. Recipe keys are NOT invalidated
 *   because removing a recipe from a collection does not change the recipe.
 */
export function useRemoveRecipeFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      recipeId,
    }: {
      collectionId: string;
      recipeId: number;
    }) => removeRecipeFromCollection(collectionId, recipeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

export type { Collection };
