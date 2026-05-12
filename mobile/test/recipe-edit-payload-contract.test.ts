import { describe, expect, it } from 'vitest';
import { buildRecipeEditPatchPayload, type RecipeEditDraft } from '@/utils/recipe-mapper';

describe('buildRecipeEditPatchPayload contract', () => {
  it('keeps tags, steps and ingredients as arrays for flat payloads', () => {
    const draft: RecipeEditDraft = {
      name: '  Pasta ',
      emoji: ' 🍝 ',
      duration: ' kurz ',
      servings: ' 2 ',
      calories: '450',
      tags: ' quick,  dinner , ',
      ingredients: [' 200g Nudeln ', '', ' 2 Tomaten '],
      steps: [' Wasser kochen ', ' ', ' Alles mischen '],
      ingredientGroups: null,
    };

    const { patch, flatIngredients, ingredientGroups } = buildRecipeEditPatchPayload(draft);

    expect(patch.tags).toEqual(['quick', 'dinner']);
    expect(patch.steps).toEqual(['Wasser kochen', 'Alles mischen']);
    expect(patch.ingredients).toEqual(['200g Nudeln', '2 Tomaten']);
    expect(patch.ingredientGroups).toBeNull();
    expect(flatIngredients).toEqual(['200g Nudeln', '2 Tomaten']);
    expect(ingredientGroups).toBeNull();
    expect(typeof patch.tags).not.toBe('string');
    expect(typeof patch.steps).not.toBe('string');
    expect(typeof patch.ingredients).not.toBe('string');
  });

  it('sends grouped ingredients as objects and omits flat ingredients payload', () => {
    const draft: RecipeEditDraft = {
      name: 'Lasagne',
      emoji: '🍲',
      duration: 'mittel',
      servings: '4',
      calories: '',
      tags: 'Ofen, Familie',
      ingredients: ['legacy should be ignored'],
      steps: ['Schichten', 'Backen'],
      ingredientGroups: [
        { heading: 'Sauce ', items: [' 1 Zwiebel ', ' '] },
        { heading: 'Auflauf', items: [' Lasagneplatten ', ' Käse '] },
      ],
    };

    const { patch, flatIngredients, ingredientGroups } = buildRecipeEditPatchPayload(draft);

    expect(patch.ingredientGroups).toEqual([
      { heading: 'Sauce', items: ['1 Zwiebel'] },
      { heading: 'Auflauf', items: ['Lasagneplatten', 'Käse'] },
    ]);
    expect('ingredients' in patch).toBe(false);
    expect(flatIngredients).toEqual(['1 Zwiebel', 'Lasagneplatten', 'Käse']);
    expect(ingredientGroups).toEqual([
      { heading: 'Sauce', items: ['1 Zwiebel'] },
      { heading: 'Auflauf', items: ['Lasagneplatten', 'Käse'] },
    ]);
  });

  it('falls back to flat ingredients when fewer than two usable groups remain', () => {
    const draft: RecipeEditDraft = {
      name: 'Suppe',
      emoji: '🥣',
      duration: 'kurz',
      servings: '3',
      calories: 'abc',
      tags: ' , vegan , ',
      ingredients: [' Wasser ', ' Salz '],
      steps: ['Aufkochen', ' Abschmecken '],
      ingredientGroups: [
        { heading: ' ', items: [' '] },
        { heading: 'Basis', items: [' '] },
      ],
    };

    const { patch, flatIngredients, ingredientGroups } = buildRecipeEditPatchPayload(draft);

    expect(patch.ingredientGroups).toBeNull();
    expect(patch.ingredients).toEqual(['Wasser', 'Salz']);
    expect(flatIngredients).toEqual(['Wasser', 'Salz']);
    expect(ingredientGroups).toBeNull();
    expect(patch.tags).toEqual(['vegan']);
    expect(patch.steps).toEqual(['Aufkochen', 'Abschmecken']);
    expect(patch.calories).toBeNull();
  });
});
