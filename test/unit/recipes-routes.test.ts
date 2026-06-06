import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFlowError, configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

const dbMocks = vi.hoisted(() => ({
  getRecipeListFromReactDb: vi.fn(),
  getRecipeByIdFromReactDb: vi.fn(),
  saveRecipeToReactDb: vi.fn(),
  updateRecipeInReactDb: vi.fn(),
  deleteRecipeFromReactDb: vi.fn(),
  getRecipeCount: vi.fn(),
  searchRecipesByIngredientsAdvanced: vi.fn(),
  loadUserAuthorization: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: recipesRouter } = await import('../../src/routes/recipes.js')

const userId = '00000000-0000-0000-0000-000000000001'
const householdId = '10000000-0000-0000-0000-000000000001'
const authHeaders = { Authorization: 'Bearer valid-token' }
const expectedAuth = expect.objectContaining({
  userId,
  memberships: [expect.objectContaining({ householdId })],
})

describe('recipes route ingredient search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.getRecipeListFromReactDb.mockResolvedValue([])
    dbMocks.searchRecipesByIngredientsAdvanced.mockResolvedValue([
      { recipe: { id: 1, name: 'Pasta' }, matchScore: 100, matchedIngredients: ['tomate', 'nudeln'], missingIngredients: [] },
      { recipe: { id: 2, name: 'Salat' }, matchScore: 50, matchedIngredients: ['nudeln'], missingIngredients: ['tomate'] },
    ])
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('delegates ingredient search with defaults', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate,nudeln', { headers: authHeaders })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      recipes: [{ id: 1, name: 'Pasta' }, { id: 2, name: 'Salat' }],
      match_scores: [100, 50],
      matched_counts: [2, 1],
      missing_ingredients: [[], ['tomate']],
      match_mode: 'or',
      threshold: 0,
      limit: 50,
    })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).toHaveBeenCalledWith({
      ingredients: ['tomate', 'nudeln'],
      match: 'or',
      threshold: 0,
    }, expectedAuth)
  })

  it('supports AND mode, threshold, and limit', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate,nudeln&match=and&threshold=80&limit=1', { headers: authHeaders })

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
    }, expectedAuth)
  })

  it('returns 400 for empty ingredients', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=%20,%20', { headers: authHeaders })

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid threshold', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&threshold=abc', { headers: authHeaders })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/threshold/i) })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for threshold outside range', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&threshold=101', { headers: authHeaders })

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid limit', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&limit=0', { headers: authHeaders })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/limit/i) })
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid match mode', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate&match=xor', { headers: authHeaders })

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })

  it('returns 400 for overly long ingredients query', async () => {
    const res = await recipesRouter.request(`/api/v1/recipes?ingredients=${'a'.repeat(501)}`, { headers: authHeaders })

    expect(res.status).toBe(400)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).not.toHaveBeenCalled()
  })
})

describe('recipes route mutation auth boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.saveRecipeToReactDb.mockResolvedValue(123)
    dbMocks.updateRecipeInReactDb.mockResolvedValue(true)
    dbMocks.deleteRecipeFromReactDb.mockResolvedValue(true)
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('requires auth for recipe list reads', async () => {
    const res = await recipesRouter.request('/api/v1/recipes')

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'auth_missing' } })
    expect(dbMocks.getRecipeListFromReactDb).not.toHaveBeenCalled()
  })

  it('passes authenticated user id to recipe list reads', async () => {
    dbMocks.getRecipeListFromReactDb.mockResolvedValue([{ id: 2, name: 'Own Recipe' }])

    const res = await recipesRouter.request('/api/v1/recipes', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 2, name: 'Own Recipe' }])
    expect(dbMocks.getRecipeListFromReactDb).toHaveBeenCalledWith(expectedAuth)
  })

  it('passes authenticated user id to ingredient search reads', async () => {
    const res = await recipesRouter.request('/api/v1/recipes?ingredients=tomate', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    expect(dbMocks.searchRecipesByIngredientsAdvanced).toHaveBeenCalledWith({
      ingredients: ['tomate'],
      match: 'or',
      threshold: 0,
    }, expectedAuth)
  })

  it('returns auth_invalid for invalid tokens on recipe reads', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => {
        throw new AuthFlowError('auth_invalid', 'Invalid access token', 401)
      },
    })

    const res = await recipesRouter.request('/api/v1/recipes', {
      headers: { Authorization: 'Bearer bad-token' },
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'auth_invalid' } })
    expect(dbMocks.getRecipeListFromReactDb).not.toHaveBeenCalled()
  })

  it('passes authenticated user id to recipe detail reads', async () => {
    dbMocks.getRecipeByIdFromReactDb.mockResolvedValue({ id: 7, name: 'Own Recipe' })

    const res = await recipesRouter.request('/api/v1/recipes/7', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 7, name: 'Own Recipe' })
    expect(dbMocks.getRecipeByIdFromReactDb).toHaveBeenCalledWith(7, expectedAuth)
  })

  it('requires auth for recipe images', async () => {
    const res = await recipesRouter.request('/api/v1/recipes/8/image')

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'auth_missing' } })
    expect(dbMocks.getRecipeByIdFromReactDb).not.toHaveBeenCalled()
  })

  it('uses private cache for authenticated recipe images', async () => {
    dbMocks.getRecipeByIdFromReactDb.mockResolvedValue({
      id: 9,
      owner_type: 'user',
      image_url: 'data:image/png;base64,SGVsbG8=',
    })

    const res = await recipesRouter.request('/api/v1/recipes/9/image', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(dbMocks.getRecipeByIdFromReactDb).toHaveBeenCalledWith(9, expectedAuth)
  })

  it('requires auth for recipe creation', async () => {
    resetAuthAdaptersForTests()

    const res = await recipesRouter.request('/api/v1/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: { name: 'Pasta' }, sourceUrl: 'https://example.test/pasta' }),
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'auth_missing' } })
    expect(dbMocks.saveRecipeToReactDb).not.toHaveBeenCalled()
  })

  it('creates recipes with the authenticated user id', async () => {
    const recipe = {
      name: 'Pasta',
      tags: [],
      ingredients: ['Nudeln'],
      steps: ['Kochen'],
    }

    const res = await recipesRouter.request('/api/v1/recipes', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipe, sourceUrl: 'https://example.test/pasta', transcript: 'seed' }),
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ id: 123, success: true })
    expect(dbMocks.saveRecipeToReactDb).toHaveBeenCalledWith(recipe, 'https://example.test/pasta', 'seed', {
      owner: { type: 'user', userId },
      createdBy: userId,
    })
  })

  it('creates private recipes for users without an active household', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })
    const recipe = {
      name: 'Private Pasta',
      tags: [],
      ingredients: ['Nudeln'],
      steps: ['Kochen'],
    }

    const res = await recipesRouter.request('/api/v1/recipes', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipe, sourceUrl: 'https://example.test/private-pasta' }),
    })

    expect(res.status).toBe(201)
    expect(dbMocks.saveRecipeToReactDb).toHaveBeenCalledWith(recipe, 'https://example.test/private-pasta', undefined, {
      owner: { type: 'user', userId },
      createdBy: userId,
    })
  })

  it('returns auth_invalid when mutation token verification fails', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => {
        throw new AuthFlowError('auth_invalid', 'Invalid access token', 401)
      },
    })

    const res = await recipesRouter.request('/api/v1/recipes/7', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer bad-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'auth_invalid' } })
    expect(dbMocks.updateRecipeInReactDb).not.toHaveBeenCalled()
  })

  it('updates only through the owner-scoped helper', async () => {
    const res = await recipesRouter.request('/api/v1/recipes/7', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    expect(dbMocks.updateRecipeInReactDb).toHaveBeenCalledWith(7, expectedAuth, { name: 'Updated' })
  })

  it('returns 404 when owner-scoped update does not find a recipe', async () => {
    dbMocks.updateRecipeInReactDb.mockResolvedValue(false)

    const res = await recipesRouter.request('/api/v1/recipes/7', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Not found' })
  })

  it('deletes only through the owner-scoped helper', async () => {
    const res = await recipesRouter.request('/api/v1/recipes/7', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    expect(dbMocks.deleteRecipeFromReactDb).toHaveBeenCalledWith(7, expectedAuth)
  })

  it('returns 404 when owner-scoped delete does not find a recipe', async () => {
    dbMocks.deleteRecipeFromReactDb.mockResolvedValue(false)

    const res = await recipesRouter.request('/api/v1/recipes/7', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Not found' })
  })
})
