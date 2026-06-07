import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

const dbMocks = vi.hoisted(() => ({
  loadUserAuthorization: vi.fn(),
  ensureUserProfile: vi.fn(),
  ensureDefaultHouseholdForUser: vi.fn(),
  getAccountBootstrapStatus: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: authRouter } = await import('../../src/routes/auth.js')

describe('auth bootstrap route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('returns auth_missing with docs when no bearer token is present', async () => {
    const res = await authRouter.request('/api/v1/auth/bootstrap', { method: 'POST' })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'auth_missing',
        docs: 'docs/auth-runbook-route-privacy.md',
      },
    })
  })

  it('returns created bootstrap status for a fresh user', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'fresh@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })

    dbMocks.ensureUserProfile.mockResolvedValue({ created: true })
    dbMocks.ensureDefaultHouseholdForUser.mockResolvedValue({
      created: true,
      householdId: '10000000-0000-0000-0000-000000000001',
    })
    dbMocks.getAccountBootstrapStatus.mockResolvedValue({
      status: 'ready',
      profile: {
        ready: true,
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'fresh@example.com',
        appRole: 'user',
      },
      workspace: {
        ready: true,
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Mein Workspace',
        isDefault: true,
      },
      membership: {
        ready: true,
        householdId: '10000000-0000-0000-0000-000000000001',
        role: 'owner',
      },
      warnings: [],
    })

    const res = await authRouter.request('/api/v1/auth/bootstrap', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'ready',
      result: 'created',
      profile: {
        ready: true,
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'fresh@example.com',
        appRole: 'user',
      },
      workspace: {
        ready: true,
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Mein Workspace',
        isDefault: true,
      },
      membership: {
        ready: true,
        householdId: '10000000-0000-0000-0000-000000000001',
        role: 'owner',
      },
      warnings: [],
    })
    expect(dbMocks.ensureUserProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001', 'fresh@example.com')
    expect(dbMocks.ensureDefaultHouseholdForUser).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001')
    expect(dbMocks.getAccountBootstrapStatus).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001')
  })

  it('returns existing when bootstrap only re-reads ready state', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'ready@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    dbMocks.ensureUserProfile.mockResolvedValue({ created: false })
    dbMocks.ensureDefaultHouseholdForUser.mockResolvedValue({
      created: false,
      householdId: '10000000-0000-0000-0000-000000000001',
    })
    dbMocks.getAccountBootstrapStatus.mockResolvedValue({
      status: 'ready',
      profile: {
        ready: true,
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'ready@example.com',
        appRole: 'user',
      },
      workspace: {
        ready: true,
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Mein Workspace',
        isDefault: true,
      },
      membership: {
        ready: true,
        householdId: '10000000-0000-0000-0000-000000000001',
        role: 'owner',
      },
      warnings: [],
    })

    const res = await authRouter.request('/api/v1/auth/bootstrap', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      status: 'ready',
      result: 'existing',
    })
  })

  it('returns bootstrap_failed with docs when status cannot be re-read', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'broken@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })

    dbMocks.ensureUserProfile.mockResolvedValue({ created: true })
    dbMocks.ensureDefaultHouseholdForUser.mockResolvedValue({
      created: true,
      householdId: '10000000-0000-0000-0000-000000000001',
    })
    dbMocks.getAccountBootstrapStatus.mockResolvedValue(null)

    const res = await authRouter.request('/api/v1/auth/bootstrap', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'bootstrap_failed',
        fix: 'Retry account bootstrap.',
        docs: 'docs/auth-runbook-route-privacy.md#auth-onboarding-bootstrap',
      },
    })
  })
})
