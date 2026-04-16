import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRecipeById, patchRecipe, deleteRecipe } from '@/utils/api';
import { RECIPES_QUERY_KEY } from './useRecipes';

export function recipeQueryKey(id: number) {
  return ['recipe', id] as const;
}

/**
 * Fetch a single recipe by ID with stale-while-revalidate.
 */
export function useRecipe(id: number) {
  return useQuery({
    queryKey: recipeQueryKey(id),
    queryFn: () => fetchRecipeById(id),
    enabled: id > 0,
  });
}

/**
 * PATCH mutation for updating recipe fields.
 * Invalidates both the single-recipe and list cache on success.
 */
export function useUpdateRecipe(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fields: Record<string, unknown>) => patchRecipe(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeQueryKey(id) });
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    },
  });
}

/**
 * DELETE mutation for removing a recipe.
 * Removes from list cache immediately (optimistic), re-validates list.
 * Not queued when offline — delete requires a round-trip to confirm.
 */
export function useDeleteRecipe(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteRecipe(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: recipeQueryKey(id) });
      qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
    },
  });
}
