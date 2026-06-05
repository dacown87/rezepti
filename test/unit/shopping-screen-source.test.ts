import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  addToShoppingList: vi.fn(),
  getShoppingList: vi.fn(),
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

vi.mock('../../src/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/auth.js')>('../../src/auth.js')
  return {
    ...actual,
    requireAuth: () => async (c: any, next: any) => {
      c.set('auth', {
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
        appRole: 'user',
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

describe('shopping add request contract', () => {
  const householdId = '10000000-0000-0000-0000-000000000001'
  const userId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.addToShoppingList.mockResolvedValue({ id: 101 })
  })

  it('accepts manual entries with recipeId null and forwards null to persistence', async () => {
    const res = await plannerRouter.request('/api/v1/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonicalName: 'Milch', recipeId: null }),
    })

    expect(res.status).toBe(201)
    expect(dbMocks.addToShoppingList).toHaveBeenCalledWith(householdId, userId, null, 'Milch', undefined, undefined)
  })
})
