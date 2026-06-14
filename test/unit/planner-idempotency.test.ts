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

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return plannerRouter.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('planner POST idempotency (client_op_id)', () => {
  const householdId = '10000000-0000-0000-0000-000000000001'
  const userId = '00000000-0000-0000-0000-000000000001'
  const recipeId = 7
  const dayOfWeek = 2
  const weekStart = 1716760800

  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.recipeBelongsToHousehold.mockResolvedValue(true)
    dbMocks.addRecipeToMealPlan.mockResolvedValue({ id: 5 })
    dbMocks.addToShoppingList.mockResolvedValue({ id: 101 })
  })

  it('forwards client_op_id as 6th argument to addRecipeToMealPlan', async () => {
    const body = { recipeId, dayOfWeek, weekStart, client_op_id: 'dup-1' }
    const res = await jsonRequest('/api/v1/planner', body)

    expect(res.status).toBe(201)
    const json = await res.json() as { id: number }
    expect(json.id).toBe(5)
    expect(dbMocks.addRecipeToMealPlan).toHaveBeenCalledWith(
      householdId, userId, recipeId, dayOfWeek, weekStart, 'dup-1'
    )
  })

  it('deduplicates: both calls receive the same op-id and return id 5', async () => {
    const body = { recipeId, dayOfWeek, weekStart, client_op_id: 'dup-1' }

    const res1 = await jsonRequest('/api/v1/planner', body)
    const res2 = await jsonRequest('/api/v1/planner', body)

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    const json1 = await res1.json() as { id: number }
    const json2 = await res2.json() as { id: number }
    expect(json1.id).toBe(5)
    expect(json2.id).toBe(5)

    expect(dbMocks.addRecipeToMealPlan).toHaveBeenCalledTimes(2)
    expect(dbMocks.addRecipeToMealPlan).toHaveBeenNthCalledWith(
      1, householdId, userId, recipeId, dayOfWeek, weekStart, 'dup-1'
    )
    expect(dbMocks.addRecipeToMealPlan).toHaveBeenNthCalledWith(
      2, householdId, userId, recipeId, dayOfWeek, weekStart, 'dup-1'
    )
  })

  it('planner POST without client_op_id passes null as 6th arg', async () => {
    const body = { recipeId, dayOfWeek, weekStart }
    const res = await jsonRequest('/api/v1/planner', body)

    expect(res.status).toBe(201)
    expect(dbMocks.addRecipeToMealPlan).toHaveBeenCalledWith(
      householdId, userId, recipeId, dayOfWeek, weekStart, null
    )
  })

  it('shopping POST with client_op_id ignores it (K3): addToShoppingList called with existing arity', async () => {
    const body = {
      recipeId: 5,
      canonicalName: 'Tomate',
      quantity: '3',
      unit: 'Stück',
      client_op_id: 'x',
    }
    const res = await jsonRequest('/api/v1/shopping', body)

    // Shopping still succeeds
    expect(res.status).toBe(201)

    // addToShoppingList must be called with exactly 6 args (no client_op_id appended)
    expect(dbMocks.addToShoppingList).toHaveBeenCalledTimes(1)
    expect(dbMocks.addToShoppingList).toHaveBeenCalledWith(
      householdId, userId, 5, 'Tomate', '3', 'Stück'
    )
  })
})
