import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthFlowError,
  configureAuthForTests,
  extractBearerToken,
  resetAuthAdaptersForTests,
  resolveAuthContext,
  resolveUserAuthContext,
} from '../../src/auth.js'

describe('auth helpers', () => {
  afterEach(() => {
    resetAuthAdaptersForTests()
    vi.unstubAllEnvs()
  })

  it('extracts a bearer token case-insensitively', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def')
    expect(extractBearerToken('bearer token')).toBe('token')
  })

  it('rejects missing or malformed authorization headers', async () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken('Basic abc')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
    expect(extractBearerToken('Bearer abc extra')).toBeNull()

    await expect(resolveAuthContext(undefined)).rejects.toMatchObject({
      code: 'auth_missing',
      status: 401,
    })
  })

  it('rejects invalid tokens from the verifier', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => {
        throw new AuthFlowError('auth_invalid', 'Invalid access token', 401)
      },
    })

    await expect(resolveAuthContext('Bearer bad-token')).rejects.toMatchObject({
      code: 'auth_invalid',
      status: 401,
    })
  })

  it('builds auth context from verified user and DB-backed authorization', async () => {
    configureAuthForTests({
      verifyAccessToken: async (accessToken) => ({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
        accessToken,
      } as any),
      loadAuthorization: async () => ({
        appRole: 'admin',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    await expect(resolveAuthContext('Bearer valid-token')).resolves.toEqual({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'user-a@example.com',
      appRole: 'admin',
      memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
      activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      accessToken: 'valid-token',
      isAuthenticated: true,
    })
  })

  it('rejects verified users without an active household', async () => {
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

    await expect(resolveAuthContext('Bearer valid-token')).rejects.toMatchObject({
      code: 'no_household',
      status: 403,
    })
  })

  it('allows user auth context without an active household', async () => {
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

    await expect(resolveUserAuthContext('Bearer valid-token')).resolves.toEqual({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'user-a@example.com',
      appRole: 'user',
      memberships: [],
      activeHouseholdId: null,
      accessToken: 'valid-token',
      isAuthenticated: true,
    })
  })
})
