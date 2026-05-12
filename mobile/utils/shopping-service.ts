import { getServerUrl } from '@/utils/server-url';

export const DEFAULT_ADD_INGREDIENTS_CONCURRENCY = 4;

export type AddIngredientsOptions = {
  concurrency?: number;
};

function normalizeConcurrency(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_ADD_INGREDIENTS_CONCURRENCY;
  return Math.max(1, Math.floor(value));
}

async function postShoppingIngredient(url: string, ingredient: string, recipeId?: number): Promise<void> {
  const res = await fetch(`${url}/api/v1/shopping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canonicalName: ingredient, recipeId: recipeId ?? null }),
  });
  if (!res.ok) {
    throw new Error(`Shopping add failed (${res.status})`);
  }
}

export async function addIngredients(
  ingredients: string[],
  recipeId?: number,
  options?: AddIngredientsOptions
): Promise<void> {
  if (ingredients.length === 0) return;

  const url = await getServerUrl();
  const concurrency = Math.min(normalizeConcurrency(options?.concurrency), ingredients.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < ingredients.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await postShoppingIngredient(url, ingredients[currentIndex], recipeId);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
