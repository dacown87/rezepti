import type { Recipe } from '@/db/schema';
import type { ApiRecipe } from '@/utils/api';

export type RecipeIngredientGroup = {
  heading: string;
  items: string[];
};

export type RecipeEditDraft = {
  name: string;
  emoji: string;
  duration: string;
  servings: string;
  calories: string;
  tags: string;
  ingredients: string[];
  steps: string[];
  ingredientGroups: RecipeIngredientGroup[] | null;
};

export type RecipeEditPatchPayload = {
  name: string;
  emoji: string;
  duration: string;
  servings: string;
  calories: number | null;
  tags: string[];
  steps: string[];
  ingredientGroups: RecipeIngredientGroup[] | null;
  ingredients?: string[];
};

export function buildRecipeEditPatchPayload(draft: RecipeEditDraft): {
  patch: RecipeEditPatchPayload;
  flatIngredients: string[];
  ingredientGroups: RecipeIngredientGroup[] | null;
} {
  const normalizeList = (values: string[]) =>
    values
      .map(value => value.trim())
      .filter(Boolean);

  const normalizedGroups = draft.ingredientGroups
    ? draft.ingredientGroups
        .map(group => ({
          heading: group.heading.trim(),
          items: normalizeList(group.items),
        }))
        .filter(group => group.heading.length > 0 || group.items.length > 0)
    : null;

  const hasGroups = normalizedGroups != null && normalizedGroups.length >= 2;
  const flatIngredients = hasGroups
    ? normalizedGroups.flatMap(group => group.items)
    : normalizeList(draft.ingredients);

  const calories = draft.calories.trim();
  const parsedCalories = calories ? Number.parseInt(calories, 10) : NaN;

  const patch: RecipeEditPatchPayload = {
    name: draft.name.trim(),
    emoji: draft.emoji.trim(),
    duration: draft.duration.trim(),
    servings: draft.servings.trim(),
    calories: Number.isNaN(parsedCalories) ? null : parsedCalories,
    tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    steps: normalizeList(draft.steps),
    ingredientGroups: hasGroups ? normalizedGroups : null,
  };

  if (!hasGroups) patch.ingredients = flatIngredients;

  return {
    patch,
    flatIngredients,
    ingredientGroups: hasGroups ? normalizedGroups : null,
  };
}

export function apiToRecipe(r: ApiRecipe): Recipe {
  const normalizedTags =
    typeof r.tags === 'string' ? r.tags :
    Array.isArray(r.tags) ? JSON.stringify(r.tags) :
    null;

  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? null,
    source_url: r.source_url ?? null,
    image_url: r.image_url ?? null,
    ingredients: typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients ?? []),
    steps: typeof r.steps === 'string' ? r.steps : JSON.stringify(r.steps ?? []),
    tags: normalizedTags,
    category: r.category ?? null,
    servings: r.servings ?? null,
    duration: r.duration ?? null,
    calories: r.calories ?? null,
    rating: r.rating ?? null,
    notes: r.notes ?? null,
    transcript: null,
    equipment: null,
    nutrition_info: null,
    ingredient_groups: null,
    tried: 0,
    pdf_created: 0,
    created_at: null,
    // Sharing / favorites read-model (Phase 3) — carried through additively so the
    // list scope hint + favorites filter work. Older cached payloads omit these.
    scope: r.scope,
    isFavorite: r.isFavorite ?? false,
  };
}
