import type { SchemaOrgRecipe, RecipeData } from "../types.js";

/**
 * Parse ISO 8601 duration (PT30M, PT1H30M, etc.) to minutes.
 */
function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  return hours * 60 + minutes;
}

function getDurationCategory(
  schema: SchemaOrgRecipe
): "kurz" | "mittel" | "lang" {
  const totalMin =
    parseDuration(schema.totalTime) ??
    (parseDuration(schema.prepTime) ?? 0) +
      (parseDuration(schema.cookTime) ?? 0);

  if (!totalMin || totalMin <= 0) return "mittel";
  if (totalMin < 20) return "kurz";
  if (totalMin <= 60) return "mittel";
  return "lang";
}

function getImage(schema: SchemaOrgRecipe): string | undefined {
  if (!schema.image) return undefined;
  if (typeof schema.image === "string") return schema.image;
  if (Array.isArray(schema.image)) return schema.image[0];
  return undefined;
}

function parseCalories(schema: SchemaOrgRecipe): number | undefined {
  const cal = schema.nutrition?.calories;
  if (!cal) return undefined;
  const num = parseInt(cal, 10);
  return isNaN(num) ? undefined : num;
}

function extractSteps(schema: SchemaOrgRecipe): string[] {
  if (!schema.recipeInstructions) return [];
  return schema.recipeInstructions.map((step) => {
    if (typeof step === "string") return step;
    return step.text ?? "";
  }).filter(Boolean);
}

/**
 * Convert a schema.org Recipe to our internal format.
 * This is the "fast path" - no LLM needed, but content is NOT translated.
 * Returns null if essential fields are missing.
 */
export function schemaToRecipeData(
  schema: SchemaOrgRecipe
): Partial<RecipeData> | null {
  if (!schema.name) return null;

  const ingredients = schema.recipeIngredient ?? [];
  const steps = extractSteps(schema);

  if (ingredients.length === 0 && steps.length === 0) return null;

  return {
    name: schema.name,
    duration: getDurationCategory(schema),
    tags: [
      ...(schema.recipeCategory ?? []),
      ...(schema.recipeCuisine ?? []),
    ],
    imageUrl: getImage(schema),
    calories: parseCalories(schema),
    servings: schema.recipeYield ?? undefined,
    ingredients,
    steps,
  };
}
