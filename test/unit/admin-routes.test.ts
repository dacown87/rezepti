import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

const dbMocks = vi.hoisted(() => ({
  getByokValidationPolicy: vi.fn(),
  upsertByokValidationPolicy: vi.fn(),
  loadUserAuthorization: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: authRouter } = await import('../../src/routes/auth.js')
const { default: adminRouter } = await import('../../src/routes/admin.js')

function withAuth(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: 'Bearer valid-token',
      ...(init?.headers ?? {}),
    },
  })
}

describe('admin + auth me routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('GET /api/v1/auth/me returns read-only auth context', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'admin',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    const response = await authRouter.request('/api/v1/auth/me', withAuth('/api/v1/auth/me'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      appRole: 'admin',
      activeHouseholdId: '10000000-0000-0000-0000-000000000001',
    })
  })

  it('GET /api/v1/admin/byok-validation-policy rejects non-admin users', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000002',
        email: 'user@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })

    const response = await adminRouter.request(
      '/api/v1/admin/byok-validation-policy',
      withAuth('/api/v1/admin/byok-validation-policy'),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'admin_required' },
    })
  })

  it('GET /api/v1/admin/byok-validation-policy returns the effective policy for admins', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'admin',
        memberships: [],
        activeHouseholdId: null,
      }),
    })
    dbMocks.getByokValidationPolicy.mockResolvedValue({
      windowMinutes: 60,
      maxRequests: 20,
      source: 'default',
      status: 'uninitialized',
      updatedAt: null,
      updatedBy: null,
      updatedByUserId: null,
      appliesTo: ['keys_validate', 'extract_react', 'extract_photo', 'extract_text'],
    })

    const response = await adminRouter.request(
      '/api/v1/admin/byok-validation-policy',
      withAuth('/api/v1/admin/byok-validation-policy'),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      source: 'default',
      status: 'uninitialized',
      maxRequests: 20,
      windowMinutes: 60,
    })
  })

  it('PUT /api/v1/admin/byok-validation-policy validates input and persists policy', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@example.com',
      }),
      loadAuthorization: async () => ({
        appRole: 'admin',
        memberships: [],
        activeHouseholdId: null,
      }),
    })
    dbMocks.upsertByokValidationPolicy.mockResolvedValue({
      windowMinutes: 90,
      maxRequests: 12,
      source: 'database',
      status: 'active',
      updatedAt: '2026-06-19T12:00:00.000Z',
      updatedBy: 'admin@example.com',
      updatedByUserId: '00000000-0000-0000-0000-000000000001',
      appliesTo: ['keys_validate', 'extract_react', 'extract_photo', 'extract_text'],
    })

    const response = await adminRouter.request(
      '/api/v1/admin/byok-validation-policy',
      withAuth('/api/v1/admin/byok-validation-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowMinutes: 90, maxRequests: 12 }),
      }),
    )

    expect(response.status).toBe(200)
    expect(dbMocks.upsertByokValidationPolicy).toHaveBeenCalledWith({
      windowMinutes: 90,
      maxRequests: 12,
      updatedByUserId: '00000000-0000-0000-0000-000000000001',
    })
    await expect(response.json()).resolves.toMatchObject({
      source: 'database',
      status: 'active',
      windowMinutes: 90,
      maxRequests: 12,
    })
  })
})
