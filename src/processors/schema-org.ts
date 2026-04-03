import type { SchemaOrgRecipe, RecipeData } from "../types.js";
import { RecipeDataSchema } from "../types.js";

// ─── Emoji picker ──────────────────────────────────────────────────────────────

const EMOJI_MAP: [string[], string][] = [
  [["pasta", "nudel", "spaghetti", "penne", "lasagne", "tagliatelle", "rigatoni"], "🍝"],
  [["pizza"], "🍕"],
  [["salat", "salad"], "🥗"],
  [["suppe", "soup", "brühe", "eintopf", "chowder", "bisque"], "🍲"],
  [["kuchen", "torte", "cake", "muffin", "brownie"], "🎂"],
  [["brot", "brötchen", "bread", "baguette", "croissant"], "🍞"],
  [["rind", "steak", "beef", "schnitzel", "lamm", "schwein"], "🥩"],
  [["hähnchen", "huhn", "chicken", "geflügel", "pute", "truthahn"], "🍗"],
  [["fisch", "lachs", "thunfisch", "garnele", "shrimp", "meeresfrüchte", "calamari"], "🐟"],
  [["vegan", "vegetarisch", "gemüse", "tofu"], "🥦"],
  [["reis", "risotto", "paella"], "🍚"],
  [["burger", "sandwich", "wrap", "hotdog"], "🍔"],
  [["dessert", "nachtisch", "mousse", "panna cotta", "tiramisu"], "🍮"],
  [["eis", "gelato", "sorbet"], "🍨"],
  [["schokolade", "chocolate", "kakao"], "🍫"],
  [["frühstück", "breakfast", "müsli", "granola"], "🥣"],
  [["pfannkuchen", "pancake", "crêpe", "waffel"], "🥞"],
  [["smoothie", "saft"], "🥤"],
  [["cocktail", "drink", "bowle"], "🍹"],
  [["kaffee", "coffee", "espresso", "cappuccino"], "☕"],
  [["ei", "eier", "omelette", "rührei", "spiegelei"], "🍳"],
  [["käse", "cheese", "fondue", "raclette"], "🧀"],
  [["kartoffel", "pommes", "gnocchi"], "🥔"],
  [["curry", "indisch", "dhal", "masala"], "🍛"],
  [["sushi", "japanisch", "maki", "onigiri"], "🍱"],
  [["taco", "burrito", "mexikanisch", "enchilada", "quesadilla"], "🌮"],
  [["thermomix", "varoma", "dampfgaren"], "🫕"],
  [["marmelade", "konfitüre", "aufstrich"], "🍯"],
  [["sushi", "bowl", "poke"], "🥙"],
];

export function pickEmoji(name: string, tags: string[]): string {
  const haystack = [name, ...tags].join(" ").toLowerCase();
  for (const [keywords, emoji] of EMOJI_MAP) {
    if (keywords.some(kw => haystack.includes(kw))) return emoji;
  }
  return "🍽️";
}

// ─── Finalize without LLM ──────────────────────────────────────────────────────

/**
 * Completes a partial recipe (from schema.org) into a full RecipeData
 * without calling the LLM. Fills required fields with safe defaults.
 * Use when name, ingredients, steps, and duration are already present.
 */
export function finalizeRecipe(partial: Partial<RecipeData>): RecipeData {
  const tags = partial.tags ?? [];
  const emoji = partial.emoji ?? pickEmoji(partial.name ?? "", tags);
  return RecipeDataSchema.parse({ ...partial, tags, emoji });
}

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
  if (Array.isArray(schema.image)) {
    const first = schema.image[0];
    if (!first) return undefined;
    if (typeof first === "string") return first;
    return (first as { url?: string }).url;
  }
  if (typeof schema.image === "object") return (schema.image as { url?: string }).url;
  return undefined;
}

function parseCalories(schema: SchemaOrgRecipe): number | undefined {
  const cal = schema.nutrition?.calories;
  if (!cal) return undefined;
  const num = parseInt(cal, 10);
  return isNaN(num) ? undefined : num;
}

/** Strip HTML tags and normalize whitespace from step text. */
function cleanStepText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")          // strip all HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\uE000-\uF8FF]/g, "")   // strip Private Use Area chars (Cookidoo icons like U+E003)
    // Cookidoo Linkslauf: PUA icon between slashes collapses to // after strip above
    // e.g. "95°C//Stufe 1" → "95°C/Linkslauf/Stufe 1"
    .replace(/\/\/Stufe/g, "/Linkslauf/Stufe")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSteps(schema: SchemaOrgRecipe): string[] {
  if (!schema.recipeInstructions) return [];
  const steps: string[] = [];
  for (const step of schema.recipeInstructions) {
    if (typeof step === "string") {
      steps.push(cleanStepText(step));
    } else if ("itemListElement" in step && Array.isArray(step.itemListElement)) {
      // HowToSection — flatten nested steps
      for (const subStep of step.itemListElement) {
        if (subStep.text) steps.push(cleanStepText(subStep.text));
      }
    } else if ("text" in step && step.text) {
      steps.push(cleanStepText(step.text));
    }
  }
  return steps.filter(Boolean);
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

  const equipment = (schema.tool ?? [])
    .map(t => (typeof t === "string" ? t : (t.name ?? "")))
    .filter(Boolean);

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
    equipment: equipment.length > 0 ? equipment : undefined,
  };
}
