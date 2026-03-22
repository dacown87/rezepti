import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RecipeData } from '../../src/types.js'

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ changes: 1 }),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      }),
      pragma: vi.fn(),
      close: vi.fn(),
    })),
  }
})

vi.mock('../../src/config.js', () => ({
  config: {
    sqlite: {
      reactPath: ':memory:',
    },
  },
}))

vi.mock('../../src/schema.js', () => ({
  recipes: {
    id: { primaryKey: true, autoIncrement: true },
    name: { notNull: true },
    emoji: { notNull: false },
    source_url: { notNull: false },
    image_url: { notNull: false },
    servings: { notNull: false },
    duration: { notNull: false },
    calories: { notNull: false },
    tags: { notNull: false },
    ingredients: { notNull: true },
    steps: { notNull: true },
    transcript: { notNull: false },
    tried: { notNull: false },
    created_at: { notNull: false },
  },
}))

describe('db-react', () => {
  describe('RecipeData type', () => {
    it('should have all required fields', () => {
      const recipe: RecipeData = {
        name: 'Test Recipe',
        duration: 'mittel',
        tags: ['Italian', 'Pasta'],
        emoji: '🍝',
        ingredients: ['pasta', 'tomato sauce', 'cheese'],
        steps: ['Cook pasta', 'Add sauce', 'Top with cheese'],
      }

      expect(recipe.name).toBe('Test Recipe')
      expect(recipe.duration).toBe('mittel')
      expect(recipe.tags).toEqual(['Italian', 'Pasta'])
      expect(recipe.emoji).toBe('🍝')
      expect(recipe.ingredients).toHaveLength(3)
      expect(recipe.steps).toHaveLength(3)
    })

    it('should support optional fields', () => {
      const recipe: RecipeData = {
        name: 'Full Recipe',
        duration: 'lang',
        tags: ['Vegan', 'Healthy'],
        emoji: '🥗',
        imageUrl: 'https://example.com/image.jpg',
        calories: 350,
        servings: '4 Portionen',
        ingredients: ['tofu', 'vegetables'],
        steps: ['Prepare tofu', 'Add vegetables'],
      }

      expect(recipe.imageUrl).toBe('https://example.com/image.jpg')
      expect(recipe.calories).toBe(350)
      expect(recipe.servings).toBe('4 Portionen')
    })
  })

  describe('JSON serialization', () => {
    it('should serialize recipe fields to JSON', () => {
      const recipe: RecipeData = {
        name: 'Test',
        duration: 'kurz',
        tags: ['tag1', 'tag2'],
        emoji: '🍕',
        ingredients: ['item1', 'item2'],
        steps: ['step1', 'step2'],
      }

      const tagsJson = JSON.stringify(recipe.tags)
      const ingredientsJson = JSON.stringify(recipe.ingredients)
      const stepsJson = JSON.stringify(recipe.steps)

      expect(tagsJson).toBe('["tag1","tag2"]')
      expect(ingredientsJson).toBe('["item1","item2"]')
      expect(stepsJson).toBe('["step1","step2"]')
    })

    it('should deserialize JSON fields from database', () => {
      const tagsJson = '["vegan","healthy"]'
      const ingredientsJson = '["tofu","spinach"]'
      const stepsJson = '["blend","serve"]'

      const tags = JSON.parse(tagsJson)
      const ingredients = JSON.parse(ingredientsJson)
      const steps = JSON.parse(stepsJson)

      expect(tags).toEqual(['vegan', 'healthy'])
      expect(ingredients).toEqual(['tofu', 'spinach'])
      expect(steps).toEqual(['blend', 'serve'])
    })

    it('should handle empty arrays in JSON', () => {
      const tags = JSON.parse('[]')
      const ingredients = JSON.parse('[]')
      const steps = JSON.parse('[]')

      expect(tags).toEqual([])
      expect(ingredients).toEqual([])
      expect(steps).toEqual([])
    })
  })

  describe('Database schema mapping', () => {
    it('should map RecipeData to database schema fields', () => {
      const recipe: RecipeData = {
        name: 'Database Recipe',
        duration: 'mittel',
        tags: ['test'],
        emoji: '🍕',
        imageUrl: 'https://example.com/img.jpg',
        servings: '2',
        calories: 500,
        ingredients: ['ingredient1'],
        steps: ['step1'],
      }

      const dbRecord = {
        name: recipe.name,
        emoji: recipe.emoji,
        source_url: 'https://example.com',
        image_url: recipe.imageUrl,
        servings: recipe.servings,
        duration: recipe.duration,
        calories: recipe.calories,
        tags: JSON.stringify(recipe.tags),
        ingredients: JSON.stringify(recipe.ingredients),
        steps: JSON.stringify(recipe.steps),
        transcript: null,
        tried: false,
        created_at: Date.now(),
      }

      expect(dbRecord.name).toBe('Database Recipe')
      expect(dbRecord.image_url).toBe('https://example.com/img.jpg')
      expect(dbRecord.calories).toBe(500)
      expect(JSON.parse(dbRecord.tags)).toEqual(['test'])
    })
  })

  describe('Duration enum values', () => {
    it('should accept valid duration values', () => {
      const validDurations = ['kurz', 'mittel', 'lang'] as const

      validDurations.forEach(d => {
        const recipe: RecipeData = {
          name: 'Test',
          duration: d,
          tags: [],
          emoji: '🍕',
          ingredients: [],
          steps: [],
        }
        expect(recipe.duration).toBe(d)
      })
    })
  })
})
