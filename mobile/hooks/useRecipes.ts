import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRecipes } from '@/utils/api';

export const RECIPES_QUERY_KEY = ['recipes'] as const;

/**
 * Fetch all recipes with stale-while-revalidate.
 * Returns cached data immediately (if available), then revalidates in background.
 */
export function useRecipes() {
  return useQuery({
    queryKey: RECIPES_QUERY_KEY,
    queryFn: fetchRecipes,
  });
}

/**
 * Invalidate the recipes list cache — call after creating/deleting a recipe
 * to trigger a background refetch on the next render.
 */
export function useInvalidateRecipes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: RECIPES_QUERY_KEY });
}
