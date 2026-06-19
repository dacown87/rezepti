import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthFlowError, configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

// ---------------------------------------------------------------------------
// Module-level mocks — must be hoisted before any dynamic imports
// ---------------------------------------------------------------------------

const cookidooMocks = vi.hoisted(() => ({
  removeLegacyCookidooFiles: vi.fn(),
}))

vi.mock('../../src/fetchers/cookidoo.js', () => cookidooMocks)

const byokMocks = vi.hoisted(() => ({
  BYOKValidator: {
    hashKey: vi.fn((key: string) => `hash:${key}`),
    checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19, resetTime: 1234567890 })),
    validateKey: vi.fn(),
  },
}))

vi.mock('../../src/byok-validator.js', () => byokMocks)

const dbMocks = vi.hoisted(() => ({
  ensureReactSchema: vi.fn(),
  loadUserAuthorization: vi.fn(),
  getCookidooStatus: vi.fn(async () => ({
    scope: 'none',
    connected: false,
    sharedByCurrentHousehold: false,
    canManageHouseholdShare: false,
  })),
  saveUserCookidooCredentials: vi.fn(async () => undefined),
  deleteUserCookidooCredentials: vi.fn(async () => true),
  shareCookidooCredentialsToHousehold: vi.fn(async () => true),
  deleteHouseholdCookidooShare: vi.fn(async () => true),
}))

vi.mock('../../src/db-react.js', () => ({
  ...dbMocks,
  // provide any other named exports that might be imported transitively
  getRecipes: vi.fn(),
  getRecipeById: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
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
  getExtractionJob: vi.fn(),
  listExtractionJobs: vi.fn(),
  createExtractionJob: vi.fn(),
  updateExtractionJob: vi.fn(),
}))

// Import routers after mocks are in place
const { default: platformsRouter } = await import('../../src/routes/platforms.js')
const { default: keysRouter } = await import('../../src/routes/keys.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonRequest(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// ---------------------------------------------------------------------------
// T6 — No-token → 401 on protected routes
// ---------------------------------------------------------------------------

describe('Cookidoo + BYOK route auth boundary (no token → 401)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('GET /api/v1/cookidoo/status — returns 401 without Bearer token', async () => {
    const res = await platformsRouter.request('/api/v1/cookidoo/status')

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(dbMocks.getCookidooStatus).not.toHaveBeenCalled()
  })

  it('POST /api/v1/cookidoo/credentials — returns 401 without Bearer token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/cookidoo/credentials',
      makeJsonRequest('POST', '/api/v1/cookidoo/credentials', { email: 'x@x.com', password: 'pw' }),
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(dbMocks.saveUserCookidooCredentials).not.toHaveBeenCalled()
  })

  it('DELETE /api/v1/cookidoo/credentials — returns 401 without Bearer token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/cookidoo/credentials',
      new Request('http://localhost/api/v1/cookidoo/credentials', { method: 'DELETE' }),
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(dbMocks.deleteUserCookidooCredentials).not.toHaveBeenCalled()
  })

  it('POST /api/v1/keys/validate — returns 401 without Bearer token', async () => {
    const res = await keysRouter.request(
      '/api/v1/keys/validate',
      makeJsonRequest('POST', '/api/v1/keys/validate', { apiKey: 'some-key' }),
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(byokMocks.BYOKValidator.checkRateLimit).not.toHaveBeenCalled()
    expect(byokMocks.BYOKValidator.validateKey).not.toHaveBeenCalled()
  })
})

describe('BYOK validation rate limit', () => {
  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('returns 429 before live key validation when the validation limit is exhausted', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user' as const,
        memberships: [],
        activeHouseholdId: null,
      }),
    })
    byokMocks.BYOKValidator.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: 1234567890,
    })

    const res = await keysRouter.request(
      '/api/v1/keys/validate',
      new Request('http://localhost/api/v1/keys/validate', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: 'gsk_some_key_1234567890' }),
      }),
    )

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({
      code: 'byok_validation_rate_limited',
      remaining: 0,
      resetTime: 1234567890,
    })
    expect(byokMocks.BYOKValidator.hashKey).toHaveBeenCalledWith('gsk_some_key_1234567890')
    expect(byokMocks.BYOKValidator.validateKey).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T6 — Pinterest / Facebook → 501 (with AND without token)
// ---------------------------------------------------------------------------

describe('Pinterest and Facebook routes → 501', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  const configureValidAuth = () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user' as const,
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' as const }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })
  }

  // Without token — auth check runs first (protected), returns 401
  it('GET /api/v1/pinterest/status — returns 401 without token', async () => {
    const res = await platformsRouter.request('/api/v1/pinterest/status')
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  it('POST /api/v1/pinterest/credentials — returns 401 without token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/pinterest/credentials',
      makeJsonRequest('POST', '/api/v1/pinterest/credentials', {}),
    )
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  it('DELETE /api/v1/pinterest/credentials — returns 401 without token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/pinterest/credentials',
      new Request('http://localhost/api/v1/pinterest/credentials', { method: 'DELETE' }),
    )
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  it('GET /api/v1/facebook/status — returns 401 without token', async () => {
    const res = await platformsRouter.request('/api/v1/facebook/status')
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  it('POST /api/v1/facebook/cookies — returns 401 without token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/facebook/cookies',
      makeJsonRequest('POST', '/api/v1/facebook/cookies', {}),
    )
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  it('DELETE /api/v1/facebook/cookies — returns 401 without token', async () => {
    const res = await platformsRouter.request(
      '/api/v1/facebook/cookies',
      new Request('http://localhost/api/v1/facebook/cookies', { method: 'DELETE' }),
    )
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
  })

  // With valid token — these are disabled, so 501
  it('GET /api/v1/pinterest/status — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request('/api/v1/pinterest/status', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })

  it('POST /api/v1/pinterest/credentials — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request(
      '/api/v1/pinterest/credentials',
      makeJsonRequest('POST', '/api/v1/pinterest/credentials', {}),
    )
    // Need to manually attach auth header — use the request overload
    const authRes = await platformsRouter.request('/api/v1/pinterest/credentials', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(authRes.status).toBe(501)
    await expect(authRes.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })

  it('DELETE /api/v1/pinterest/credentials — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request('/api/v1/pinterest/credentials', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })

  it('GET /api/v1/facebook/status — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request('/api/v1/facebook/status', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })

  it('POST /api/v1/facebook/cookies — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request('/api/v1/facebook/cookies', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })

  it('DELETE /api/v1/facebook/cookies — returns 501 with valid token', async () => {
    configureValidAuth()
    const res = await platformsRouter.request('/api/v1/facebook/cookies', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(501)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_implemented' } })
  })
})

// ---------------------------------------------------------------------------
// G5 — Cookidoo happy-path (authed) → 200
// ---------------------------------------------------------------------------

describe('Cookidoo routes — authenticated happy-path (G5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  const configureValidAuth = () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user' as const,
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' as const }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })
  }

  it('GET /api/v1/cookidoo/status with valid token → 200 with scoped status payload', async () => {
    configureValidAuth()
    dbMocks.getCookidooStatus.mockResolvedValueOnce({
      scope: 'user',
      connected: true,
      sharedByCurrentHousehold: true,
    })

    const res = await platformsRouter.request('/api/v1/cookidoo/status', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      scope: 'user',
      connected: true,
      sharedByCurrentHousehold: true,
    })
    expect(dbMocks.getCookidooStatus).toHaveBeenCalled()
  })

  it('POST /api/v1/cookidoo/credentials with valid token → 200 { success: true }', async () => {
    configureValidAuth()

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chef@example.com', password: 'thermomix123' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ success: true, scope: 'user' })
    expect(dbMocks.saveUserCookidooCredentials).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'chef@example.com',
      'thermomix123',
    )
  })

  it('DELETE /api/v1/cookidoo/credentials with valid token → 200 { success: true }', async () => {
    configureValidAuth()

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ success: true, scope: 'user' })
    expect(dbMocks.deleteUserCookidooCredentials).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
    )
  })

  it('POST /api/v1/cookidoo/credentials/share with owner token → 200 { success: true }', async () => {
    configureValidAuth()

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials/share', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ success: true, scope: 'household' })
    expect(dbMocks.shareCookidooCredentialsToHousehold).toHaveBeenCalledWith(expect.objectContaining({
      userId: '00000000-0000-0000-0000-000000000001',
      activeHouseholdId: '10000000-0000-0000-0000-000000000001',
    }))
  })

  it('DELETE /api/v1/cookidoo/credentials/share with owner token → 200 { success: true }', async () => {
    configureValidAuth()

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials/share', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ success: true, scope: 'household' })
    expect(dbMocks.deleteHouseholdCookidooShare).toHaveBeenCalledWith(expect.objectContaining({
      userId: '00000000-0000-0000-0000-000000000001',
      activeHouseholdId: '10000000-0000-0000-0000-000000000001',
    }))
  })

  it('POST /api/v1/cookidoo/credentials/share with non-owner token → 403', async () => {
    configureValidAuth()
    dbMocks.shareCookidooCredentialsToHousehold.mockResolvedValueOnce(false)

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials/share', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Only household owners can manage Cookidoo sharing',
    })
  })

  it('DELETE /api/v1/cookidoo/credentials/share with non-owner token → 403', async () => {
    configureValidAuth()
    dbMocks.deleteHouseholdCookidooShare.mockResolvedValueOnce(false)

    const res = await platformsRouter.request('/api/v1/cookidoo/credentials/share', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Only household owners can manage Cookidoo sharing',
    })
  })
})

// ---------------------------------------------------------------------------
// T6 — Proxy image route stays open (no auth required — regression guard)
// ---------------------------------------------------------------------------

describe('/api/v1/proxy/image — intentionally unauthenticated (regression guard)', () => {
  it('returns 400 for missing URL without a Bearer token (not 401)', async () => {
    const res = await platformsRouter.request('/api/v1/proxy/image')

    // Must NOT be 401 — this route is intentionally open
    expect(res.status).not.toBe(401)
    // Missing `url` param → 400 Invalid URL
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid URL' })
  })

  it('returns 400 for non-https URL without a Bearer token (not 401)', async () => {
    const res = await platformsRouter.request('/api/v1/proxy/image?url=http%3A%2F%2Fexample.com%2Fimg.jpg')

    expect(res.status).not.toBe(401)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid URL' })
  })

  it('returns 400 for private/localhost URL without a Bearer token (SSRF guard)', async () => {
    const res = await platformsRouter.request('/api/v1/proxy/image?url=https%3A%2F%2Flocalhost%2Fimg.jpg')

    expect(res.status).not.toBe(401)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid URL' })
  })
})
