import { describe, expect, it } from 'vitest';

import {
  buildIngredientResultRows,
  buildRecipeCategoryCounts,
  buildRecipeListItemData,
  filterRecipeListItemsByCategory,
  filterRecipeListItemsBySearch,
  parseIngredientTerms,
} from '@/utils/recipe-list-screen-data';
import { createRecipePerformanceFixture } from './fixtures/recipe-performance-fixture';

describe('recipe list screen derived data', () => {
  it('builds deterministic large fixtures for repeatable list/search checks', () => {
    const fixtureA = createRecipePerformanceFixture({ count: 300, seed: 19, startId: 100 });
    const fixtureB = createRecipePerformanceFixture({ count: 300, seed: 19, startId: 100 });

    expect(fixtureA).toHaveLength(300);
    expect(fixtureA).toEqual(fixtureB);
    expect(fixtureA[0]?.id).toBe(100);
    expect(fixtureA.at(-1)?.id).toBe(399);
  });

  it('keeps search, category and ingredient derivations stable on a 600 recipe fixture', () => {
    const recipes = createRecipePerformanceFixture({ count: 600, seed: 73 });
    const items = buildRecipeListItemData(recipes);

    expect(items).toHaveLength(600);
    expect(items.every((item) => item.tags.length >= 2)).toBe(true);
    expect(items.every((item) => item.ingredients.length >= 3)).toBe(true);

    const tomatoItems = filterRecipeListItemsBySearch(items, 'tomate');
    expect(tomatoItems.length).toBeGreaterThan(0);
    expect(tomatoItems.length).toBeLessThan(items.length);
    expect(tomatoItems.every((item) => item.searchableText.includes('tomate'))).toBe(true);

    const asiatischItems = filterRecipeListItemsByCategory(items, 'Asiatisch');
    expect(asiatischItems.length).toBeGreaterThan(0);
    expect(
      asiatischItems.every(
        (item) => item.recipe.category === 'Asiatisch' || item.tags.includes('asiatisch'),
      ),
    ).toBe(true);

    const categories = buildRecipeCategoryCounts(items);
    expect(categories[0]).toEqual({ name: 'Alle Rezepte', count: 600 });
    expect(categories.some((entry) => entry.name === 'Asiatisch')).toBe(true);

    const ingredientTerms = parseIngredientTerms('tomate, nudel');
    const ingredientRows = buildIngredientResultRows(recipes, ingredientTerms);
    expect(ingredientRows).toHaveLength(600);
    expect(ingredientRows.some((entry) => entry.matchedCount === 2)).toBe(true);
    expect(ingredientRows.every((entry) => entry.matchedCount >= 0 && entry.matchedCount <= ingredientTerms.length)).toBe(true);
  });

  it('prefers matched counts from the ingredient search payload when present', () => {
    const recipes = createRecipePerformanceFixture({ count: 2, seed: 11 });

    const rows = buildIngredientResultRows(recipes, ['tomate', 'nudeln'], [2, 1]);

    expect(rows).toEqual([
      { recipe: recipes[0], matchedCount: 2 },
      { recipe: recipes[1], matchedCount: 1 },
    ]);
  });
});
