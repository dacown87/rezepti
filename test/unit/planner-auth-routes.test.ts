import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFlowError, configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

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
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: plannerRouter } = await import('../../src/routes/planner.js')

describe('planner route auth boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.getShoppingList.mockResolvedValue([])
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('returns auth_missing when a protected route has no bearer token', async () => {
    const res = await plannerRouter.request('/api/v1/shopping')

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(dbMocks.getShoppingList).not.toHaveBeenCalled()
  })

  it('returns auth_invalid when token verification fails', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => {
        throw new AuthFlowError('auth_invalid', 'Invalid access token', 401)
      },
    })

    const res = await plannerRouter.request('/api/v1/shopping', {
      headers: { Authorization: 'Bearer bad-token' },
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_invalid' },
    })
    expect(dbMocks.getShoppingList).not.toHaveBeenCalled()
  })

  it('returns no_household when a verified user has no active household', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })

    const res = await plannerRouter.request('/api/v1/shopping', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'no_household' },
    })
    expect(dbMocks.getShoppingList).not.toHaveBeenCalled()
  })

  it('passes active household context to protected routes on valid auth', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    const res = await plannerRouter.request('/api/v1/shopping', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ items: [] })
    expect(dbMocks.getShoppingList).toHaveBeenCalledWith('10000000-0000-0000-0000-000000000001')
  })
})
