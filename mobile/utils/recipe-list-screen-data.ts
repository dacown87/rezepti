import type { Recipe } from '@/db/schema';
import {
  CATEGORY_KEYWORDS,
  detectCategory,
  evaluateIngredientSearch,
  recipeMatchesCategory,
} from '@/utils/ingredient-category-domain';

export interface RecipeListItemData {
  recipe: Recipe;
  tags: string[];
  ingredients: string[];
  searchableText: string;
}

export interface RecipeCategoryCount {
  name: string;
  count: number;
}

export interface IngredientResultRow {
  recipe: Recipe;
  matchedCount: number;
}

export function parseStringArrayJSON(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function buildRecipeListItemData(recipes: Recipe[]): RecipeListItemData[] {
  return recipes.map((recipe) => {
    const tags = parseStringArrayJSON(recipe.tags);
    const ingredients = parseStringArrayJSON(recipe.ingredients);
    const searchableText = `${recipe.name} ${tags.join(' ')}`.toLowerCase();
    return { recipe, tags, ingredients, searchableText };
  });
}

export function buildRecipeCategoryCounts(items: RecipeListItemData[]): RecipeCategoryCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const category = item.recipe.category ?? detectCategory(item.tags, item.recipe.name);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const categories = CATEGORY_KEYWORDS
    .map(({ category }) => ({ name: category, count: counts.get(category) ?? 0 }))
    .filter((entry) => entry.count > 0);

  return [{ name: 'Alle Rezepte', count: items.length }, ...categories];
}

export function filterRecipeListItemsBySearch(
  items: RecipeListItemData[],
  query: string
): RecipeListItemData[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => item.searchableText.includes(normalized));
}

export function filterRecipeListItemsByCategory(
  items: RecipeListItemData[],
  selectedCategory: string | null
): RecipeListItemData[] {
  if (!selectedCategory) return items;
  return items.filter((item) =>
    recipeMatchesCategory(
      {
        category: item.recipe.category,
        name: item.recipe.name,
        tags: item.tags,
      },
      selectedCategory
    )
  );
}

export function parseIngredientTerms(input: string): string[] {
  return input
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

export function buildIngredientResultRows(
  recipes: Recipe[],
  terms: string[]
): IngredientResultRow[] {
  if (terms.length === 0) {
    return recipes.map((recipe) => ({ recipe, matchedCount: 0 }));
  }

  return recipes.map((recipe) => ({
    recipe,
    matchedCount: evaluateIngredientSearch(parseStringArrayJSON(recipe.ingredients), terms).matchedIngredients.length,
  }));
}
