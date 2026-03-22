import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DatabaseManager, getDatabaseTypeFromRequest } from '../../src/db-manager.js'
import type { RecipeData } from '../../src/types.js'

vi.mock('../../src/db.js', () => ({
  ensureSchema: vi.fn(),
  getAllRecipes: vi.fn().mockReturnValue([]),
  getRecipeById: vi.fn(),
  saveRecipe: vi.fn().mockReturnValue(1),
  updateRecipe: vi.fn().mockReturnValue(true),
  deleteRecipe: vi.fn().mockReturnValue(true),
}))

vi.mock('../../src/db-react.js', () => ({
  ensureReactSchema: vi.fn(),
  getAllRecipesFromReactDb: vi.fn().mockReturnValue([]),
  getRecipeByIdFromReactDb: vi.fn(),
  saveRecipeToReactDb: vi.fn().mockReturnValue(1),
  updateRecipeInReactDb: vi.fn().mockReturnValue(true),
  deleteRecipeFromReactDb: vi.fn().mockReturnValue(true),
}))

vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ changes: 0 }),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  }
  return { default: vi.fn(() => mockDb) }
})

vi.mock('../../src/config.js', () => ({
  config: {
    sqlite: {
      path: ':memory:',
      reactPath: ':memory:',
    },
  },
}))

describe('DatabaseManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureSchema', () => {
    it('should call legacy schema for legacy database', async () => {
      const { ensureSchema } = await import('../../src/db.js')

      DatabaseManager.ensureSchema('legacy')

      expect(ensureSchema).toHaveBeenCalled()
    })

    it('should call react schema for react database', async () => {
      const { ensureReactSchema } = await import('../../src/db-react.js')

      DatabaseManager.ensureSchema('react')

      expect(ensureReactSchema).toHaveBeenCalled()
    })
  })

  describe('getAllRecipes', () => {
    it('should get recipes from legacy database by default', async () => {
      const { getAllRecipes } = await import('../../src/db.js')

      DatabaseManager.getAllRecipes()

      expect(getAllRecipes).toHaveBeenCalled()
    })

    it('should get recipes from react database when specified', async () => {
      const { getAllRecipesFromReactDb } = await import('../../src/db-react.js')

      DatabaseManager.getAllRecipes('react')

      expect(getAllRecipesFromReactDb).toHaveBeenCalled()
    })
  })

  describe('getRecipeById', () => {
    it('should get recipe from legacy database by default', async () => {
      const { getRecipeById } = await import('../../src/db.js')
      vi.mocked(getRecipeById).mockReturnValue(null)

      DatabaseManager.getRecipeById(1)

      expect(getRecipeById).toHaveBeenCalledWith(1)
    })

    it('should get recipe from react database when specified', async () => {
      const { getRecipeByIdFromReactDb } = await import('../../src/db-react.js')
      vi.mocked(getRecipeByIdFromReactDb).mockReturnValue(null)

      DatabaseManager.getRecipeById(1, 'react')

      expect(getRecipeByIdFromReactDb).toHaveBeenCalledWith(1)
    })
  })

  describe('saveRecipe', () => {
    it('should save to legacy database by default', async () => {
      const { saveRecipe } = await import('../../src/db.js')
      const recipe: RecipeData = {
        name: 'Test',
        duration: 'kurz',
        tags: [],
        emoji: '🍕',
        ingredients: [],
        steps: [],
      }

      DatabaseManager.saveRecipe(recipe, 'https://example.com')

      expect(saveRecipe).toHaveBeenCalledWith(recipe, 'https://example.com', undefined)
    })

    it('should save to react database when specified', async () => {
      const { saveRecipeToReactDb } = await import('../../src/db-react.js')
      const recipe: RecipeData = {
        name: 'Test',
        duration: 'kurz',
        tags: [],
        emoji: '🍕',
        ingredients: [],
        steps: [],
      }

      DatabaseManager.saveRecipe(recipe, 'https://example.com', 'transcript', 'react')

      expect(saveRecipeToReactDb).toHaveBeenCalledWith(recipe, 'https://example.com', 'transcript')
    })
  })

  describe('updateRecipe', () => {
    it('should update in legacy database by default', async () => {
      const { updateRecipe } = await import('../../src/db.js')

      DatabaseManager.updateRecipe(1, { name: 'Updated' })

      expect(updateRecipe).toHaveBeenCalledWith(1, { name: 'Updated' })
    })

    it('should update in react database when specified', async () => {
      const { updateRecipeInReactDb } = await import('../../src/db-react.js')

      DatabaseManager.updateRecipe(1, { name: 'Updated' }, 'react')

      expect(updateRecipeInReactDb).toHaveBeenCalledWith(1, { name: 'Updated' })
    })
  })

  describe('deleteRecipe', () => {
    it('should delete from legacy database by default', async () => {
      const { deleteRecipe } = await import('../../src/db.js')

      DatabaseManager.deleteRecipe(1)

      expect(deleteRecipe).toHaveBeenCalledWith(1)
    })

    it('should delete from react database when specified', async () => {
      const { deleteRecipeFromReactDb } = await import('../../src/db-react.js')

      DatabaseManager.deleteRecipe(1, 'react')

      expect(deleteRecipeFromReactDb).toHaveBeenCalledWith(1)
    })
  })

  describe('getDatabaseTypeFromRequest', () => {
    it('should return react for /api/v1/ endpoints', () => {
      const result = getDatabaseTypeFromRequest('https://example.com/api/v1/recipes')

      expect(result).toBe('react')
    })

    it('should return legacy for other endpoints', () => {
      const result = getDatabaseTypeFromRequest('https://example.com/api/recipes')

      expect(result).toBe('legacy')
    })

    it('should return legacy when no URL provided', () => {
      const result = getDatabaseTypeFromRequest()

      expect(result).toBe('legacy')
    })

    it('should return react for URL with query string containing api/v1', () => {
      const result = getDatabaseTypeFromRequest('https://example.com/api/v1/extract?url=test')

      expect(result).toBe('react')
    })
  })
})
