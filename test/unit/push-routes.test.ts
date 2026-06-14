import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  addPushSubscription: vi.fn(),
  deletePushSubscriptionByEndpoint: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  authed: true,
}))

vi.mock('../../src/db-react.js', () => dbMocks)

vi.mock('../../src/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/auth.js')>('../../src/auth.js')
  return {
    ...actual,
    requireUserAuth: () => async (c: any, next: any) => {
      if (!authState.authed) {
        return c.json({ error: 'unauthorized' }, 401)
      }
      c.set('auth', {
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'user-a@example.com',
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
        accessToken: 'test-token',
        isAuthenticated: true,
      })
      await next()
    },
  }
})

const { default: pushRouter } = await import('../../src/routes/push.js')

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return pushRouter.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('push subscribe/unsubscribe routes', () => {
  const userId = '00000000-0000-0000-0000-000000000001'
  const validEndpoint = 'https://push.example.com/sub/abc123'
  const validKeys = { p256dh: 'publicKeyHere', auth: 'authSecretHere' }

  beforeEach(() => {
    vi.clearAllMocks()
    authState.authed = true
    dbMocks.addPushSubscription.mockResolvedValue(undefined)
    dbMocks.deletePushSubscriptionByEndpoint.mockResolvedValue(undefined)
  })

  describe('POST /api/v1/push/subscribe', () => {
    it('returns 401 when unauthenticated', async () => {
      authState.authed = false

      const res = await jsonRequest('/api/v1/push/subscribe', {
        endpoint: validEndpoint,
        keys: validKeys,
      })

      expect(res.status).toBe(401)
      expect(dbMocks.addPushSubscription).not.toHaveBeenCalled()
    })

    it('returns 400 when endpoint is missing', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', {
        keys: validKeys,
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/endpoint/i) })
      expect(dbMocks.addPushSubscription).not.toHaveBeenCalled()
    })

    it('returns 400 when keys are missing', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', {
        endpoint: validEndpoint,
      })

      expect(res.status).toBe(400)
      expect(dbMocks.addPushSubscription).not.toHaveBeenCalled()
    })

    it('returns 400 when keys.p256dh is missing', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', {
        endpoint: validEndpoint,
        keys: { auth: validKeys.auth },
      })

      expect(res.status).toBe(400)
      expect(dbMocks.addPushSubscription).not.toHaveBeenCalled()
    })

    it('returns 201 and calls addPushSubscription with stringified keys', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', {
        endpoint: validEndpoint,
        keys: validKeys,
      })

      expect(res.status).toBe(201)
      await expect(res.json()).resolves.toEqual({ success: true })
      expect(dbMocks.addPushSubscription).toHaveBeenCalledOnce()
      expect(dbMocks.addPushSubscription).toHaveBeenCalledWith(
        userId,
        validEndpoint,
        JSON.stringify({ p256dh: validKeys.p256dh, auth: validKeys.auth }),
      )
    })
  })

  describe('DELETE /api/v1/push/subscribe', () => {
    it('returns 401 when unauthenticated', async () => {
      authState.authed = false

      const res = await jsonRequest('/api/v1/push/subscribe', { endpoint: validEndpoint }, 'DELETE')

      expect(res.status).toBe(401)
      expect(dbMocks.deletePushSubscriptionByEndpoint).not.toHaveBeenCalled()
    })

    it('returns 400 when endpoint is missing', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', {}, 'DELETE')

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/endpoint/i) })
      expect(dbMocks.deletePushSubscriptionByEndpoint).not.toHaveBeenCalled()
    })

    it('returns 200 and calls deletePushSubscriptionByEndpoint', async () => {
      const res = await jsonRequest('/api/v1/push/subscribe', { endpoint: validEndpoint }, 'DELETE')

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ success: true })
      expect(dbMocks.deletePushSubscriptionByEndpoint).toHaveBeenCalledOnce()
      expect(dbMocks.deletePushSubscriptionByEndpoint).toHaveBeenCalledWith(userId, validEndpoint)
    })
  })
})
