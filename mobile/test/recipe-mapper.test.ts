import { describe, expect, it } from 'vitest';
import { apiToRecipe } from '@/utils/recipe-mapper';

describe('apiToRecipe', () => {
  it('keeps string fields and normalizes nullables', () => {
    const mapped = apiToRecipe({
      id: 12,
      name: 'Pasta',
      ingredients: '["200g Nudeln"]',
      steps: '["Kochen"]',
      tags: '["quick"]',
      category: 'Nudelgericht',
    });

    expect(mapped.id).toBe(12);
    expect(mapped.name).toBe('Pasta');
    expect(mapped.ingredients).toBe('["200g Nudeln"]');
    expect(mapped.steps).toBe('["Kochen"]');
    expect(mapped.tags).toBe('["quick"]');
    expect(mapped.transcript).toBeNull();
  });

  it('serializes array payloads and keeps json-compatible output', () => {
    const mapped = apiToRecipe({
      id: 99,
      name: 'Toast',
      ingredients: ['2 Scheiben Brot', 'Butter'] as unknown as string,
      steps: ['Toasten', 'Bestreichen'] as unknown as string,
      tags: ['snack'],
    });

    expect(() => JSON.parse(mapped.ingredients)).not.toThrow();
    expect(() => JSON.parse(mapped.steps)).not.toThrow();
    expect(() => JSON.parse(mapped.tags ?? '[]')).not.toThrow();
    expect(mapped.ingredients).toBe('["2 Scheiben Brot","Butter"]');
    expect(mapped.steps).toBe('["Toasten","Bestreichen"]');
    expect(mapped.tags).toBe('["snack"]');
  });

  it('enforces app-side defaults for nullable and app-managed fields', () => {
    const mapped = apiToRecipe({
      id: 7,
      name: 'Suppe',
      ingredients: '[]',
      steps: '[]',
      created_at: '2026-05-01T12:00:00.000Z',
      tried: 1,
      pdf_created: 1,
      equipment: 'Topf',
      nutrition_info: '{"kcal":120}',
    });

    expect(mapped.emoji).toBeNull();
    expect(mapped.source_url).toBeNull();
    expect(mapped.image_url).toBeNull();
    expect(mapped.transcript).toBeNull();
    expect(mapped.equipment).toBeNull();
    expect(mapped.nutrition_info).toBeNull();
    expect(mapped.ingredient_groups).toBeNull();
    expect(mapped.tried).toBe(0);
    expect(mapped.pdf_created).toBe(0);
    expect(mapped.created_at).toBeNull();
  });

  it('handles non-string ingredients/steps as serializable payloads', () => {
    const mapped = apiToRecipe({
      id: 3,
      name: 'Fallback',
      ingredients: 42 as unknown as string,
      steps: { text: 'mix' } as unknown as string,
    });

    expect(mapped.ingredients).toBe('42');
    expect(mapped.steps).toBe('{"text":"mix"}');
  });

  it('normalizes invalid tags payloads to null', () => {
    const mapped = apiToRecipe({
      id: 4,
      name: 'Tag Guard',
      ingredients: '[]',
      steps: '[]',
      tags: { broken: true } as unknown as string,
    });

    expect(mapped.tags).toBeNull();
  });

  it('carries scope and isFavorite through additively (gotcha #2)', () => {
    const mapped = apiToRecipe({
      id: 21,
      name: 'Geteiltes Rezept',
      ingredients: '[]',
      steps: '[]',
      scope: 'household',
      isFavorite: true,
    });

    expect(mapped.scope).toBe('household');
    expect(mapped.isFavorite).toBe(true);
  });

  it('defaults isFavorite to false and leaves scope undefined when omitted (older cached payloads)', () => {
    const mapped = apiToRecipe({
      id: 22,
      name: 'Altes Rezept',
      ingredients: '[]',
      steps: '[]',
    });

    expect(mapped.scope).toBeUndefined();
    expect(mapped.isFavorite).toBe(false);
  });

  it('maps private scope through', () => {
    const mapped = apiToRecipe({
      id: 23,
      name: 'Privates Rezept',
      ingredients: '[]',
      steps: '[]',
      scope: 'private',
      isFavorite: false,
    });

    expect(mapped.scope).toBe('private');
    expect(mapped.isFavorite).toBe(false);
  });
});
