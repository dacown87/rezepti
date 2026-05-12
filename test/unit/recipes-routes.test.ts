import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  getRecipeListFromReactDb: vi.fn(),
  getRecipeByIdFromReactDb: vi.fn(),
  saveRecipeToReactDb: vi.fn(),
  updateRecipeInReactDb: vi.fn(),
  deleteRecipeFromReactDb: vi.fn(),
  getRecipeCount: vi.fn(),
  searchRecipesByIngredientsAdvanced: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: recipesRouter } = await import('../../src/routes/recipes.js')

describe('recipes route ingredient search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.getRecipeListFromReactDb.mockResolvedValue([])
    dbMocks.searchRecipesByIngredientsAdvanced.mockResolvedValue([
      { recipe: { id: 1, name: 'Pasta' }, matchScore: 100, missingIngredients: [] },
      { recipe: { id: 2, name: 'Salat' }, matchScore: 50, missingIngredients: ['tomate'] },
    ])
  })

  it('delegates ingredient search with defaults', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate,nudeln')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      recipes: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Salat' }],
      match_scores: [100, 50],
      missing_ingredients: [[], ['tomate']],
      match_mode: 'or',
      threshold: 0,
      limit: 50,
    })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).toHaveBeenCalledWith({
      ingredients: ['tomate', 'nudeln'],
      match: 'or',
      threshold: 0,
    })
  })

  it('supports AND mode, threshold, and limit', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate,nudeln&match=and&threshold=80&limit=1')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      recipes: [{ id: 1, name: 'Pasta' }],
      match_mode: 'and',
      threshold: 80,
      limit: 1,
    })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).toHaveBeenCalledWith({
      ingredients: ['tomate', 'nudeln'],
      match: 'and',
      threshold: 80,
    })
  })

  it('returns 400 for empty ingredients', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=%20,%20')

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid threshold', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&threshold=abc')

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/threshold/i) })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for threshold outside range', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&threshold=101')

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid limit', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&limit=0')

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/limit/i) })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid match mode', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&match=xor')

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for overly long ingredients query', async () => {
    const res = await recipesRouter.request(`/api/v1/recipes?ingredients=${'a'.repeat(501)}`)

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })
})
