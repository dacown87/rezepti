import { describe, expect, it } from 'vitest'
import {
  CATEGORY_KEYWORDS,
  detectCategory,
  evaluateIngredientSearch,
  recipeMatchesCategory,
} from '../../src/ingredient-category-domain.js'

describe('ingredient/category domain contract (shared)', () => {
  it('keeps category detection behavior stable', () => {
    expect(detectCategory(['PASTA'], 'Lasagne')).toBe('Auflauf')
    expect(detectCategory(['vegan'], 'Gemüsepfanne')).toBe('Vegetarisch')
    expect(detectCategory([], 'Etwas Unbekanntes')).toBeNull()
  })

  it('prefers explicit recipe category over keyword fallback', () => {
    const recipe = { category: 'Snack', name: 'Tomatensuppe', tags: [] as string[] }
    expect(recipeMatchesCategory(recipe, 'Snack')).toBe(true)
    expect(recipeMatchesCategory(recipe, 'Suppe')).toBe(false)
  })

  it('evaluates ingredient matches with fuzzy + extracted names', () => {
    const result = evaluateIngredientSearch(
      ['200g Mozzarella', '2 El Olivenöl', 'Tomaten'],
      ['mozarella', 'tomate', 'nudeln']
    )

    expect(result).toEqual({
      matchScore: 67,
      matchedIngredients: ['mozarella', 'tomate'],
      missingIngredients: ['nudeln'],
    })
  })

  it('keeps category catalog complete for mobile/backend consumers', () => {
    expect(CATEGORY_KEYWORDS.length).toBeGreaterThanOrEqual(10)
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      expect(category.length).toBeGreaterThan(0)
      expect(keywords.length, `${category} has no keywords`).toBeGreaterThan(0)
    }
  })
})
