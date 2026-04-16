import { describe, it, expect } from 'vitest'
import { pickEmoji, schemaToRecipeData, finalizeRecipe } from '../../src/processors/schema-org.js'
import type { SchemaOrgRecipe } from '../../src/types.js'

// ─── pickEmoji ───────────────────────────────────────────────────────────────

describe('pickEmoji', () => {
  it('returns pasta emoji for "Spaghetti Bolognese"', () => {
    expect(pickEmoji('Spaghetti Bolognese', [])).toBe('🍝')
  })

  it('returns pizza emoji', () => {
    expect(pickEmoji('Pizza Margherita', [])).toBe('🍕')
  })

  it('returns chicken emoji', () => {
    expect(pickEmoji('Hähnchen mit Knoblauch', [])).toBe('🍗')
  })

  it('matches keyword from tags array', () => {
    expect(pickEmoji('Gericht', ['salad', 'vegan'])).toBe('🥗')
  })

  it('returns default emoji for unknown food', () => {
    expect(pickEmoji('Unbekanntes Gericht', [])).toBe('🍽️')
  })

  it('is case-insensitive', () => {
    expect(pickEmoji('PIZZA HAWAII', [])).toBe('🍕')
  })

  it('matches thermomix keyword', () => {
    expect(pickEmoji('Varoma Dampfgaren', [])).toBe('🫕')
  })
})

// ─── schemaToRecipeData ──────────────────────────────────────────────────────

describe('schemaToRecipeData', () => {
  const baseSchema: SchemaOrgRecipe = {
    name: 'Testrezept',
    recipeIngredient: ['200g Mehl', '2 Eier'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Mehl sieben.' },
      { '@type': 'HowToStep', text: 'Eier unterrühren.' },
    ],
  }

  it('converts a basic schema.org recipe', () => {
    const result = schemaToRecipeData(baseSchema)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Testrezept')
    expect(result!.ingredients).toEqual(['200g Mehl', '2 Eier'])
    expect(result!.steps).toHaveLength(2)
    expect(result!.steps![0]).toBe('Mehl sieben.')
  })

  it('returns null when name is missing', () => {
    const schema = { ...baseSchema, name: '' as unknown as string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = schemaToRecipeData({ ...schema, name: undefined as any })
    expect(result).toBeNull()
  })

  it('returns null when both ingredients and steps are empty', () => {
    const schema: SchemaOrgRecipe = {
      name: 'Leer',
      recipeIngredient: [],
      recipeInstructions: [],
    }
    expect(schemaToRecipeData(schema)).toBeNull()
  })

  it('flattens HowToSection itemListElement steps', () => {
    const schema: SchemaOrgRecipe = {
      name: 'Sektion-Rezept',
      recipeIngredient: ['Salz'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Vorbereitung',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Ofen vorheizen.' },
            { '@type': 'HowToStep', text: 'Zutaten bereitstellen.' },
          ],
        },
      ],
    }
    const result = schemaToRecipeData(schema)
    expect(result!.steps).toEqual(['Ofen vorheizen.', 'Zutaten bereitstellen.'])
  })

  it('handles string instructions', () => {
    const schema: SchemaOrgRecipe = {
      name: 'Altes Rezept',
      recipeIngredient: ['Butter'],
      recipeInstructions: ['Butter schmelzen.' as unknown as { '@type': string; text: string }],
    }
    const result = schemaToRecipeData(schema)
    expect(result!.steps![0]).toBe('Butter schmelzen.')
  })

  it('parses short duration as "kurz"', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      totalTime: 'PT15M',
    }
    expect(schemaToRecipeData(schema)!.duration).toBe('kurz')
  })

  it('parses medium duration as "mittel"', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      totalTime: 'PT45M',
    }
    expect(schemaToRecipeData(schema)!.duration).toBe('mittel')
  })

  it('parses long duration as "lang"', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      totalTime: 'PT1H30M',
    }
    expect(schemaToRecipeData(schema)!.duration).toBe('lang')
  })

  it('extracts calories from nutrition', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      nutrition: { calories: '350 kcal' },
    }
    expect(schemaToRecipeData(schema)!.calories).toBe(350)
  })

  it('handles recipeCategory as string', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      recipeCategory: 'Dessert',
    }
    expect(schemaToRecipeData(schema)!.tags).toContain('Dessert')
  })

  it('handles recipeCategory as array', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      recipeCategory: ['Dessert', 'Backen'],
    }
    const tags = schemaToRecipeData(schema)!.tags!
    expect(tags).toContain('Dessert')
    expect(tags).toContain('Backen')
  })

  it('combines recipeCategory and recipeCuisine into tags', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      recipeCategory: 'Hauptgericht',
      recipeCuisine: 'Italienisch',
    }
    const tags = schemaToRecipeData(schema)!.tags!
    expect(tags).toContain('Hauptgericht')
    expect(tags).toContain('Italienisch')
  })

  it('extracts image as string', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      image: 'https://example.com/bild.jpg',
    }
    expect(schemaToRecipeData(schema)!.imageUrl).toBe('https://example.com/bild.jpg')
  })

  it('extracts image from array', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      image: ['https://example.com/bild.jpg', 'https://example.com/bild2.jpg'],
    }
    expect(schemaToRecipeData(schema)!.imageUrl).toBe('https://example.com/bild.jpg')
  })

  it('extracts equipment from tool field', () => {
    const schema: SchemaOrgRecipe = {
      ...baseSchema,
      tool: ['Mixer', { name: 'Backform' }],
    }
    expect(schemaToRecipeData(schema)!.equipment).toEqual(['Mixer', 'Backform'])
  })

  it('strips HTML from step text', () => {
    const schema: SchemaOrgRecipe = {
      name: 'HTML-Rezept',
      recipeIngredient: ['Salz'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Ofen auf <b>180°C</b> vorheizen.' },
      ],
    }
    // HTML tags replaced with space, then whitespace normalized
    const step = schemaToRecipeData(schema)!.steps![0]
    expect(step).not.toContain('<b>')
    expect(step).toContain('180°C')
    expect(step).toContain('vorheizen')
  })

  it('strips PUA characters (Cookidoo icons) from steps', () => {
    const schema: SchemaOrgRecipe = {
      name: 'Cookidoo',
      recipeIngredient: ['Wasser'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: '95°C\uE003\uE003Stufe 1' },
      ],
    }
    const step = schemaToRecipeData(schema)!.steps![0]
    expect(step).not.toMatch(/[\uE000-\uF8FF]/)
  })
})

// ─── finalizeRecipe ──────────────────────────────────────────────────────────

describe('finalizeRecipe', () => {
  it('fills missing emoji from name', () => {
    const result = finalizeRecipe({
      name: 'Spaghetti Carbonara',
      duration: 'mittel',
      ingredients: ['200g Spaghetti'],
      steps: ['Kochen.'],
    })
    expect(result.emoji).toBe('🍝')
  })

  it('keeps existing emoji', () => {
    const result = finalizeRecipe({
      name: 'Gericht',
      duration: 'kurz',
      emoji: '🎉',
      ingredients: ['Salz'],
      steps: ['Salzen.'],
    })
    expect(result.emoji).toBe('🎉')
  })

  it('produces a valid RecipeData', () => {
    const result = finalizeRecipe({
      name: 'Minimalrezept',
      duration: 'lang',
      ingredients: ['100g Mehl'],
      steps: ['Mehl sieben.'],
    })
    expect(result.name).toBe('Minimalrezept')
    expect(result.tags).toEqual([])
  })
})
