import type { Recipe } from '@/db/schema';
import { CATEGORY_KEYWORDS } from '@/utils/ingredient-category-domain';

export interface RecipePerformanceFixtureOptions {
  count: number;
  seed?: number;
  startId?: number;
}

const SEARCH_TOKENS = ['tomate', 'nudel', 'curry', 'salat', 'tofu'] as const;
const EMOJIS = ['🍝', '🥗', '🍲', '🍛', '🥘', '🥪'] as const;

const BASE_INGREDIENTS_BY_TOKEN: Record<(typeof SEARCH_TOKENS)[number], string[]> = {
  tomate: ['250g Tomaten', '1 EL Olivenöl', 'Basilikum'],
  nudel: ['200g Nudeln', '1 TL Salz', 'Wasser'],
  curry: ['1 EL Currypulver', '200ml Kokosmilch', 'Zwiebel'],
  salat: ['150g Blattsalat', '1 Gurke', '2 EL Essig'],
  tofu: ['200g Tofu', 'Sojasauce', 'Knoblauch'],
};

function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length];
}

export function createRecipePerformanceFixture({
  count,
  seed = 73,
  startId = 1,
}: RecipePerformanceFixtureOptions): Recipe[] {
  const random = createLcg(seed);
  const rows: Recipe[] = [];

  for (let i = 0; i < count; i += 1) {
    const id = startId + i;
    const token = pick(SEARCH_TOKENS, i);
    const categoryRule = pick(CATEGORY_KEYWORDS, i);
    const categoryKeyword = pick(categoryRule.keywords, i + 1);
    const emoji = pick(EMOJIS, i);
    const baseIngredients = BASE_INGREDIENTS_BY_TOKEN[token];
    const servings = `${2 + (i % 5)}`;
    const duration = `${15 + (i % 50)} min`;
    const rating = 3 + (i % 3);
    const category = i % 4 === 0 ? null : categoryRule.category;

    rows.push({
      id,
      name: `${token} ${categoryKeyword} Rezept ${id}`,
      emoji,
      source_url: null,
      image_url: null,
      servings,
      duration,
      calories: 250 + Math.floor(random() * 450),
      tags: JSON.stringify([token, categoryRule.category.toLowerCase(), `batch-${Math.floor(i / 50)}`]),
      category,
      ingredients: JSON.stringify([
        ...baseIngredients,
        `${100 + (i % 300)}g ${categoryKeyword}`,
      ]),
      steps: JSON.stringify(['Vorbereiten', 'Mischen', 'Servieren']),
      transcript: null,
      equipment: null,
      nutrition_info: null,
      ingredient_groups: null,
      tried: 0,
      rating,
      notes: null,
      pdf_created: i % 5 === 0 ? 1 : 0,
      created_at: 1710000000 + i,
    });
  }

  return rows;
}
