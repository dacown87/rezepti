import { describe, expect, it } from 'vitest';
import {
  evaluateIngredientSearch,
  recipeMatchesCategory,
} from '@/utils/ingredient-category-domain';

describe('ingredient/category domain contract (mobile)', () => {
  it('matches category via keyword fallback when category is missing', () => {
    const matches = recipeMatchesCategory(
      { category: null, name: 'Kartoffelgratin', tags: ['abendessen'] },
      'Auflauf'
    );
    expect(matches).toBe(true);
  });

  it('returns stable match score for ingredient badge rendering', () => {
    const result = evaluateIngredientSearch(
      ['150g Nudeln', '200g Tomaten', 'Basilikum'],
      ['nudeln', 'tomate', 'käse']
    );
    expect(result.matchScore).toBe(67);
    expect(result.matchedIngredients).toEqual(['nudeln', 'tomate']);
    expect(result.missingIngredients).toEqual(['käse']);
  });
});
