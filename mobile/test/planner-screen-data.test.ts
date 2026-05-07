import { describe, expect, it } from 'vitest';

import {
  buildRecipeIdMap,
  filterPickerRecipes,
  groupEntriesByDay,
  pickRecipesByIds,
  type MealPlanEntry,
} from '@/utils/planner-screen-data';
import { createRecipePerformanceFixture } from './fixtures/recipe-performance-fixture';

function makePlanEntry(overrides: Partial<MealPlanEntry> & { id: number; recipe_id: number; day_of_week: number }): MealPlanEntry {
  return {
    week_start: 1710000000,
    created_at: null,
    ...overrides,
  };
}

describe('groupEntriesByDay', () => {
  it('returns a Map with all keys 0..6 even when there are no entries', () => {
    const result = groupEntriesByDay([]);
    expect(result.size).toBe(7);
    for (let day = 0; day < 7; day += 1) {
      expect(result.get(day)).toEqual([]);
    }
  });

  it('places each entry in the correct day bucket', () => {
    const entries: MealPlanEntry[] = [
      makePlanEntry({ id: 1, recipe_id: 10, day_of_week: 0 }),
      makePlanEntry({ id: 2, recipe_id: 11, day_of_week: 3 }),
      makePlanEntry({ id: 3, recipe_id: 12, day_of_week: 3 }),
      makePlanEntry({ id: 4, recipe_id: 13, day_of_week: 6 }),
    ];
    const result = groupEntriesByDay(entries);

    expect(result.get(0)).toHaveLength(1);
    expect(result.get(0)![0].recipe_id).toBe(10);

    expect(result.get(3)).toHaveLength(2);
    expect(result.get(3)!.map((e) => e.recipe_id)).toEqual([11, 12]);

    expect(result.get(6)).toHaveLength(1);
    expect(result.get(6)![0].recipe_id).toBe(13);

    // Days with no entries still exist and are empty
    expect(result.get(1)).toEqual([]);
    expect(result.get(2)).toEqual([]);
    expect(result.get(4)).toEqual([]);
    expect(result.get(5)).toEqual([]);
  });

  it('returns always exactly 7 keys regardless of day values in input', () => {
    const entries: MealPlanEntry[] = Array.from({ length: 14 }, (_, i) =>
      makePlanEntry({ id: i + 1, recipe_id: i + 100, day_of_week: i % 7 }),
    );
    const result = groupEntriesByDay(entries);
    expect(result.size).toBe(7);
    for (let day = 0; day < 7; day += 1) {
      expect(result.get(day)).toHaveLength(2);
    }
  });
});

describe('filterPickerRecipes', () => {
  const recipes = createRecipePerformanceFixture({ count: 50, seed: 7 });

  it('returns the full list for empty query', () => {
    expect(filterPickerRecipes(recipes, '')).toBe(recipes);
  });

  it('returns the full list for whitespace-only query', () => {
    expect(filterPickerRecipes(recipes, '   ')).toBe(recipes);
  });

  it('filters by case-insensitive substring on name', () => {
    const upper = filterPickerRecipes(recipes, 'TOMATE');
    const lower = filterPickerRecipes(recipes, 'tomate');
    expect(upper).toEqual(lower);
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.length).toBeLessThan(recipes.length);
    expect(upper.every((r) => r.name.toLowerCase().includes('tomate'))).toBe(true);
  });

  it('returns empty array when no recipe matches', () => {
    expect(filterPickerRecipes(recipes, 'xyzunlikely999')).toEqual([]);
  });
});

describe('buildRecipeIdMap', () => {
  it('builds a Map keyed by recipe id', () => {
    const recipes = createRecipePerformanceFixture({ count: 10, seed: 1 });
    const map = buildRecipeIdMap(recipes);
    expect(map.size).toBe(10);
    for (const r of recipes) {
      expect(map.get(r.id)).toBe(r);
    }
  });
});

describe('pickRecipesByIds', () => {
  const recipes = createRecipePerformanceFixture({ count: 20, seed: 5 });

  it('returns only recipes whose ids appear in the list', () => {
    const ids = [recipes[0]!.id, recipes[4]!.id, recipes[9]!.id];
    const result = pickRecipesByIds(recipes, ids);
    expect(result.size).toBe(3);
    for (const id of ids) {
      expect(result.has(id)).toBe(true);
    }
  });

  it('silently skips missing ids', () => {
    const result = pickRecipesByIds(recipes, [99999, 88888]);
    expect(result.size).toBe(0);
  });

  it('returns empty map for empty ids list', () => {
    expect(pickRecipesByIds(recipes, []).size).toBe(0);
  });
});

describe('performance smoke tests', () => {
  it('completes groupEntriesByDay + filterPickerRecipes + pickRecipesByIds under 50ms on large fixture', () => {
    const recipes = createRecipePerformanceFixture({ count: 1000, seed: 42 });
    const entries: MealPlanEntry[] = Array.from({ length: 50 }, (_, i) =>
      makePlanEntry({
        id: i + 1,
        recipe_id: recipes[i % recipes.length]!.id,
        day_of_week: i % 7,
      }),
    );
    const ids = entries.map((e) => e.recipe_id);

    const start = performance.now();
    groupEntriesByDay(entries);
    filterPickerRecipes(recipes, 'chicken');
    pickRecipesByIds(recipes, ids);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
