import type { Recipe, MealPlanEntry } from '@/db/schema';

export type { MealPlanEntry };

export function groupEntriesByDay(entries: MealPlanEntry[]): Map<number, MealPlanEntry[]> {
  const map = new Map<number, MealPlanEntry[]>();
  for (let day = 0; day < 7; day += 1) {
    map.set(day, []);
  }
  for (const entry of entries) {
    const bucket = map.get(entry.day_of_week);
    if (bucket !== undefined) {
      bucket.push(entry);
    }
  }
  return map;
}

export function filterPickerRecipes(recipes: Recipe[], query: string): Recipe[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return recipes;
  return recipes.filter((r) => r.name.toLowerCase().includes(normalized));
}

export function buildRecipeIdMap(recipes: Recipe[]): Map<number, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}

export function pickRecipesByIds(all: Recipe[], ids: number[]): Map<number, Recipe> {
  const full = buildRecipeIdMap(all);
  const result = new Map<number, Recipe>();
  for (const id of ids) {
    const r = full.get(id);
    if (r !== undefined) {
      result.set(id, r);
    }
  }
  return result;
}
