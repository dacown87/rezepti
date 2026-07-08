import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCollections,
  fetchCollectionItems,
  createCollection,
  renameCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  reorderCollectionItems,
  bulkRemoveFromCollection,
  bulkCopyCollectionItems,
  shareRecipe,
  createRecipeShareInvite,
  fetchRecipeShareInvite,
  acceptRecipeShareInvite,
  setRecipeFavorite,
  type Collection,
} from '@/utils/api';
import { RECIPES_QUERY_KEY } from './useRecipes';
import { recipeQueryKey } from './useRecipe';
import { queuedMutate } from '@/offline/queued-mutate';
import { isOnline } from '@/offline/network-status';
import { offlineQueue, sendQueuedMutation } from '@/offline/queue-singleton';

export const COLLECTIONS_QUERY_KEY = ['recipe-collections'] as const;
export const recipeShareInviteQueryKey = (token: string) =>
  ['recipe-share-invite', token] as const;

/** Query key for a single collection's contents (recipes inside the collection). */
export const collectionItemsQueryKey = (collectionId: string) =>
  ['recipe-collections', collectionId, 'items'] as const;

function newClientOpId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

/**
 * Fetch the recipes contained in a single collection. Disabled until an id is
 * available (router params can be momentarily undefined on first render).
 */
export function useCollectionItems(collectionId: string | undefined) {
  return useQuery({
    queryKey: collectionItemsQueryKey(collectionId ?? ''),
    queryFn: () => fetchCollectionItems(collectionId as string),
    enabled: !!collectionId,
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
    mutationFn: ({ id, target, householdId }: { id: number; target: 'household' | 'user'; householdId?: string }) =>
      shareRecipe(id, target, householdId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    },
  });
}

export function useRecipeShareInvite(token: string | undefined) {
  return useQuery({
    queryKey: recipeShareInviteQueryKey(token ?? ''),
    queryFn: () => fetchRecipeShareInvite(token as string),
    enabled: !!token,
  });
}

export function useCreateRecipeShareInvite() {
  return useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      createRecipeShareInvite(id, email),
  });
}

export function useAcceptRecipeShareInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptRecipeShareInvite(token),
    onSuccess: (_data, token) => {
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: recipeShareInviteQueryKey(token) });
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
 * Invalidation: COLLECTIONS_QUERY_KEY + collectionItemsQueryKey(collectionId)
 *   item_count on the collection summary changes, and the target collection's
 *   contents list must include the newly added recipe. Recipe keys are NOT
 *   invalidated because adding a recipe to a collection does not change the
 *   recipe itself.
 */
export function useAddRecipeToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      recipeId,
      targetHouseholdId,
    }: {
      collectionId: string;
      recipeId: number;
      targetHouseholdId?: string;
    }) => {
      if (isOnline()) return addRecipeToCollection(collectionId, recipeId, targetHouseholdId);
      return queuedMutate(
        offlineQueue,
        {
          endpoint: `/api/v1/recipe-collections/${collectionId}/items`,
          method: 'POST',
          body: { recipeId, ...(targetHouseholdId ? { targetHouseholdId } : {}) },
        },
        { online: false, send: sendQueuedMutation, newId: newClientOpId },
      ).then(() => ({ added: true, recipeId, copied: false }));
    },
    onSuccess: (data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: collectionItemsQueryKey(collectionId) });
      if (data.copied) {
        qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
        qc.invalidateQueries({ queryKey: recipeQueryKey(data.recipeId) });
      }
    },
  });
}

/**
 * Remove a recipe from a collection.
 *
 * Invalidation: COLLECTIONS_QUERY_KEY + collectionItemsQueryKey(collectionId)
 *   - COLLECTIONS_QUERY_KEY: item_count on the collection summary changes.
 *   - collectionItemsQueryKey: the contents list of THAT collection must drop
 *     the removed recipe.
 *   Recipe keys are NOT invalidated because removing a recipe from a collection
 *   does not change the recipe itself.
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
    }) => {
      if (isOnline()) return removeRecipeFromCollection(collectionId, recipeId);
      return queuedMutate(
        offlineQueue,
        {
          endpoint: `/api/v1/recipe-collections/${collectionId}/items/${recipeId}`,
          method: 'DELETE',
          body: { recipeId },
        },
        { online: false, send: sendQueuedMutation, newId: newClientOpId },
      ).then(() => undefined);
    },
    onSuccess: (_data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: collectionItemsQueryKey(collectionId) });
    },
  });
}

export function useReorderCollectionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, recipeIds }: { collectionId: string; recipeIds: number[] }) =>
      isOnline()
        ? reorderCollectionItems(collectionId, recipeIds)
        : queuedMutate(
          offlineQueue,
          {
            endpoint: `/api/v1/recipe-collections/${collectionId}/items/reorder`,
            method: 'PATCH',
            body: { recipeIds },
          },
          { online: false, send: sendQueuedMutation, newId: newClientOpId },
        ).then(() => ({ succeeded: recipeIds.map((recipeId) => ({ recipeId })), failed: [] })),
    onSuccess: (_data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: collectionItemsQueryKey(collectionId) });
    },
  });
}

export function useBulkRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, recipeIds }: { collectionId: string; recipeIds: number[] }) =>
      isOnline()
        ? bulkRemoveFromCollection(collectionId, recipeIds)
        : queuedMutate(
          offlineQueue,
          {
            endpoint: `/api/v1/recipe-collections/${collectionId}/items/bulk-remove`,
            method: 'POST',
            body: { recipeIds },
          },
          { online: false, send: sendQueuedMutation, newId: newClientOpId },
        ).then(() => ({ succeeded: recipeIds.map((recipeId) => ({ recipeId })), failed: [] })),
    onSuccess: (_data, { collectionId }) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: collectionItemsQueryKey(collectionId) });
    },
  });
}

export function useBulkCopyCollectionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      targetCollectionId,
      recipeIds,
    }: {
      collectionId: string;
      targetCollectionId: string;
      recipeIds: number[];
    }) => bulkCopyCollectionItems(collectionId, targetCollectionId, recipeIds),
    onSuccess: (_data, { targetCollectionId }) => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: collectionItemsQueryKey(targetCollectionId) });
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    },
  });
}

export type { Collection };
