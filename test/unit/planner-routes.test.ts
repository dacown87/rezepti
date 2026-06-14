import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  getShoppingList: vi.fn(),
  addToShoppingList: vi.fn(),
  toggleShoppingItem: vi.fn(),
  deleteShoppingItem: vi.fn(),
  clearCheckedItems: vi.fn(),
  clearAllShoppingItems: vi.fn(),
  getAllDictionaryEntries: vi.fn(),
  addToDictionary: vi.fn(),
  findCanonicalBySimilarity: vi.fn(),
  getMealPlanForWeek: vi.fn(),
  addRecipeToMealPlan: vi.fn(),
  removeRecipeFromMealPlan: vi.fn(),
  clearMealPlanForWeek: vi.fn(),
  getRecipeByIdFromReactDb: vi.fn(),
  recipeBelongsToHousehold: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  appRole: 'user' as 'user' | 'admin',
}))

vi.mock('../../src/db-react.js', () => dbMocks)

vi.mock('../../src/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/auth.js')>('../../src/auth.js')
  return {
    ...actual,
    requireAuth: () => async (c: any, next: any) => {
      c.set('auth', {
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
        appRole: authState.appRole,
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
        accessToken: 'test-token',
        isAuthenticated: true,
      })
      await next()
    },
  }
})

const { default: plannerRouter } = await import('../../src/routes/planner.js')

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return plannerRouter.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('planner route APIs', () => {
  const householdId = '10000000-0000-0000-0000-000000000001'
  const userId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.clearAllMocks()
    authState.appRole = 'user'
    dbMocks.getShoppingList.mockResolvedValue([])
    dbMocks.addToShoppingList.mockResolvedValue({ id: 101 })
    dbMocks.toggleShoppingItem.mockResolvedValue(true)
    dbMocks.deleteShoppingItem.mockResolvedValue(true)
    dbMocks.clearCheckedItems.mockResolvedValue(undefined)
    dbMocks.clearAllShoppingItems.mockResolvedValue(undefined)
    dbMocks.findCanonicalBySimilarity.mockResolvedValue(null)
    dbMocks.getRecipeByIdFromReactDb.mockResolvedValue({ id: 5, name: 'Visible Recipe' })
    dbMocks.recipeBelongsToHousehold.mockResolvedValue(true)
  })

  describe('/api/v1/shopping', () => {
    it('lists shopping items', async () => {
      dbMocks.getShoppingList.mockResolvedValue([{ id: 1, canonical_name: 'Milch' }])

      const res = await plannerRouter.request('/api/v1/shopping')

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ items: [{ id: 1, canonical_name: 'Milch' }] })
      expect(dbMocks.getShoppingList).toHaveBeenCalledWith(householdId)
    })

    it('adds an item when recipeId is explicitly null', async () => {
      const res = await jsonRequest('/api/v1/shopping', {
        recipeId: null,
        canonicalName: 'Milch',
        quantity: '1',
        unit: 'l',
      })

      expect(res.status).toBe(201)
      expect(dbMocks.addToShoppingList).toHaveBeenCalledWith(householdId, userId, null, 'Milch', '1', 'l')
    })

    it('returns 400 for malformed JSON', async () => {
      const res = await jsonRequest('/api/v1/shopping', '{"recipeId":')

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/invalid json/i) })
      expect(dbMocks.addToShoppingList).not.toHaveBeenCalled()
    })

    it('treats missing recipeId as null (backwards compatible)', async () => {
      const res = await jsonRequest('/api/v1/shopping', { canonicalName: 'Milch' })

      expect(res.status).toBe(201)
      expect(dbMocks.addToShoppingList).toHaveBeenCalledWith(householdId, userId, null, 'Milch', undefined, undefined)
    })

    it('returns 400 when recipeId has the wrong type', async () => {
      const res = await jsonRequest('/api/v1/shopping', { recipeId: 'abc', canonicalName: 'Milch' })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/recipeId/i) })
      expect(dbMocks.addToShoppingList).not.toHaveBeenCalled()
    })

    it('returns 400 when canonicalName is missing', async () => {
      const res = await jsonRequest('/api/v1/shopping', { recipeId: 7 })

      expect(res.status).toBe(400)
      expect(dbMocks.addToShoppingList).not.toHaveBeenCalled()
    })

    it('clears checked items idempotently', async () => {
      const first = await plannerRouter.request('/api/v1/shopping/checked', { method: 'DELETE' })
      const second = await plannerRouter.request('/api/v1/shopping/checked', { method: 'DELETE' })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(dbMocks.clearCheckedItems).toHaveBeenCalledTimes(2)
      expect(dbMocks.clearCheckedItems).toHaveBeenCalledWith(householdId)
    })

    it('returns 404 for repeated delete of the same item', async () => {
      dbMocks.deleteShoppingItem.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const first = await plannerRouter.request('/api/v1/shopping/101', { method: 'DELETE' })
      const second = await plannerRouter.request('/api/v1/shopping/101', { method: 'DELETE' })

      expect(first.status).toBe(200)
      expect(second.status).toBe(404)
      expect(dbMocks.deleteShoppingItem).toHaveBeenCalledWith(householdId, 101)
    })

    it('is idempotent on duplicate POST — returns same id and calls db once per request', async () => {
      // First call: insert succeeds, db returns the new row.
      dbMocks.addToShoppingList.mockResolvedValueOnce({ id: 42 })
      // Second call: db detects conflict and returns the existing row id.
      dbMocks.addToShoppingList.mockResolvedValueOnce({ id: 42 })

      const payload = { recipeId: 5, canonicalName: 'Tomate', quantity: '3', unit: 'Stück' }

      const first = await jsonRequest('/api/v1/shopping', payload)
      const second = await jsonRequest('/api/v1/shopping', payload)

      expect(first.status).toBe(201)
      expect(second.status).toBe(201)

      const body1 = await first.json() as { id: number }
      const body2 = await second.json() as { id: number }

      // Both responses must carry the same stable id.
      expect(body1.id).toBe(42)
      expect(body2.id).toBe(42)

      // db function was called for each request (conflict resolution is inside db layer).
      expect(dbMocks.addToShoppingList).toHaveBeenCalledTimes(2)
      expect(dbMocks.addToShoppingList).toHaveBeenNthCalledWith(1, householdId, userId, 5, 'Tomate', '3', 'Stück')
      expect(dbMocks.addToShoppingList).toHaveBeenNthCalledWith(2, householdId, userId, 5, 'Tomate', '3', 'Stück')
      expect(dbMocks.recipeBelongsToHousehold).toHaveBeenCalledWith(5, householdId)
    })

    it('rejects shopping items for recipes outside the active household', async () => {
      dbMocks.recipeBelongsToHousehold.mockResolvedValue(false)

      const res = await jsonRequest('/api/v1/shopping', {
        recipeId: 99,
        canonicalName: 'Tomate',
      })

      expect(res.status).toBe(404)
      await expect(res.json()).resolves.toEqual({ error: 'Recipe not found' })
      expect(dbMocks.recipeBelongsToHousehold).toHaveBeenCalledWith(99, householdId)
      expect(dbMocks.addToShoppingList).not.toHaveBeenCalled()
    })
  })

  describe('/api/v1/planner', () => {
    it('lists planner entries for the active household', async () => {
      dbMocks.getMealPlanForWeek.mockResolvedValue([{ id: 9, recipe_id: 3, week_start: 1716760800 }])

      const res = await plannerRouter.request('/api/v1/planner?week=1716760800')

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        entries: [{ id: 9, recipe_id: 3, week_start: 1716760800 }],
        weekStart: 1716760800,
      })
      expect(dbMocks.getMealPlanForWeek).toHaveBeenCalledWith(householdId, 1716760800)
    })

    it('adds a planner entry in the active household', async () => {
      dbMocks.addRecipeToMealPlan.mockResolvedValue({ id: 10 })

      const res = await jsonRequest('/api/v1/planner', {
        recipeId: 5,
        dayOfWeek: 2,
        weekStart: 1716760800,
      })

      expect(res.status).toBe(201)
      expect(dbMocks.recipeBelongsToHousehold).toHaveBeenCalledWith(5, householdId)
      expect(dbMocks.addRecipeToMealPlan).toHaveBeenCalledWith(householdId, userId, 5, 2, 1716760800, null)
    })

    it('rejects planner entries for recipes outside the active household', async () => {
      dbMocks.recipeBelongsToHousehold.mockResolvedValue(false)

      const res = await jsonRequest('/api/v1/planner', {
        recipeId: 99,
        dayOfWeek: 2,
        weekStart: 1716760800,
      })

      expect(res.status).toBe(404)
      await expect(res.json()).resolves.toEqual({ error: 'Recipe not found' })
      expect(dbMocks.recipeBelongsToHousehold).toHaveBeenCalledWith(99, householdId)
      expect(dbMocks.addRecipeToMealPlan).not.toHaveBeenCalled()
    })

    it('clears one week only in the active household', async () => {
      const res = await plannerRouter.request('/api/v1/planner/week/1716760800', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(dbMocks.clearMealPlanForWeek).toHaveBeenCalledWith(householdId, 1716760800)
    })
  })

  describe('/api/v1/dictionary/match', () => {
    it('creates a dictionary entry without aliases by defaulting to an empty array', async () => {
      authState.appRole = 'admin'
      dbMocks.addToDictionary.mockResolvedValue({ id: 7 })

      const res = await jsonRequest('/api/v1/dictionary', {
        canonicalName: 'Tomate',
      })

      expect(res.status).toBe(201)
      expect(dbMocks.addToDictionary).toHaveBeenCalledWith('Tomate', [])
    })

    it('creates a dictionary entry with string aliases', async () => {
      authState.appRole = 'admin'
      dbMocks.addToDictionary.mockResolvedValue({ id: 8 })

      const res = await jsonRequest('/api/v1/dictionary', {
        canonicalName: 'Tomate',
        aliases: ['Paradeiser', 'Roma-Tomate'],
      })

      expect(res.status).toBe(201)
      expect(dbMocks.addToDictionary).toHaveBeenCalledWith('Tomate', ['Paradeiser', 'Roma-Tomate'])
    })

    it('returns 400 when aliases is not an array of strings', async () => {
      authState.appRole = 'admin'
      const res = await jsonRequest('/api/v1/dictionary', {
        canonicalName: 'Tomate',
        aliases: 'Paradeiser',
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/aliases/i) })
      expect(dbMocks.addToDictionary).not.toHaveBeenCalled()
    })

    it('rejects dictionary writes for non-admin users', async () => {
      const res = await jsonRequest('/api/v1/dictionary', {
        canonicalName: 'Tomate',
      })

      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toMatchObject({
        error: {
          code: 'admin_required',
          cause: 'The authenticated user is not an admin.',
          fix: 'Sign in with an admin account before editing the dictionary.',
        },
      })
      expect(dbMocks.addToDictionary).not.toHaveBeenCalled()
    })

    it('returns a canonical dictionary match', async () => {
      dbMocks.findCanonicalBySimilarity.mockResolvedValue({
        id: 1,
        canonical_name: 'Tomate',
        aliases: ['Paradeiser'],
      })

      const res = await plannerRouter.request('/api/v1/dictionary/match?name=Paradeiser')

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        match: { id: 1, canonical_name: 'Tomate', aliases: ['Paradeiser'] },
      })
      expect(dbMocks.findCanonicalBySimilarity).toHaveBeenCalledWith('Paradeiser')
    })

    it('returns 400 for empty query', async () => {
      const res = await plannerRouter.request('/api/v1/dictionary/match?name=%20%20')

      expect(res.status).toBe(400)
      expect(dbMocks.findCanonicalBySimilarity).not.toHaveBeenCalled()
    })

    it('returns 400 for overly long query', async () => {
      const longName = 'a'.repeat(201)
      const res = await plannerRouter.request(`/api/v1/dictionary/match?name=${longName}`)

      expect(res.status).toBe(400)
      expect(dbMocks.findCanonicalBySimilarity).not.toHaveBeenCalled()
    })
  })
})
