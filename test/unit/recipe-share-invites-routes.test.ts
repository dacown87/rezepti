import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

const dbMocks = vi.hoisted(() => ({
  createRecipeShareInvite: vi.fn(),
  getRecipeShareInvitePreview: vi.fn(),
  acceptRecipeShareInvite: vi.fn(),
  loadUserAuthorization: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const mailMocks = vi.hoisted(() => ({
  sendRecipeInviteEmail: vi.fn(),
}))

vi.mock('../../src/mail.js', () => mailMocks)

const { default: router } = await import('../../src/routes/recipe-share-invites.js')

const USER_A = '00000000-0000-0000-0000-00000000000a'
const HOUSEHOLD_1 = '10000000-0000-0000-0000-000000000001'
const authHeaders = { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' }

function authAsUserA(email = 'user-a@example.com') {
  configureAuthForTests({
    verifyAccessToken: async () => ({ id: USER_A, email }),
    loadAuthorization: async () => ({
      appRole: 'user',
      memberships: [{ householdId: HOUSEHOLD_1, role: 'owner' as const }],
      activeHouseholdId: HOUSEHOLD_1,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mailMocks.sendRecipeInviteEmail.mockResolvedValue({
    status: 'skipped',
    provider: 'disabled',
    errorCode: 'mail_not_configured',
  })
  authAsUserA()
})

afterEach(() => {
  resetAuthAdaptersForTests()
})

describe('recipe share invite routes', () => {
  it('creates an invite for a visible recipe and email', async () => {
    dbMocks.createRecipeShareInvite.mockResolvedValue({
      token: 'token-1',
      expiresAt: '2026-07-21T00:00:00.000Z',
      preview: {
        status: 'pending',
        recipeName: 'Pasta',
        senderEmail: 'user-a@example.com',
        recipientEmail: 'friend@example.com',
        expiresAt: '2026-07-21T00:00:00.000Z',
        acceptedRecipeId: null,
      },
    })

    const res = await router.request('/api/v1/recipes/5/share-invites', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: 'friend@example.com' }),
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      invite: { token: 'token-1', preview: { recipeName: 'Pasta' } },
      shareUrl: 'http://localhost/share-invite/token-1',
      delivery: {
        status: 'skipped',
        provider: 'disabled',
        errorCode: 'mail_not_configured',
      },
    })
    expect(dbMocks.createRecipeShareInvite).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A, email: 'user-a@example.com' }),
      5,
      'friend@example.com',
    )
    expect(mailMocks.sendRecipeInviteEmail).toHaveBeenCalledWith({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: 'user-a@example.com',
      shareUrl: 'http://localhost/share-invite/token-1',
    })
  })

  it('returns sent delivery when provider accepts the invite email', async () => {
    dbMocks.createRecipeShareInvite.mockResolvedValue({
      token: 'token-1',
      expiresAt: '2026-07-21T00:00:00.000Z',
      preview: {
        status: 'pending',
        recipeName: 'Pasta',
        senderEmail: 'user-a@example.com',
        recipientEmail: 'friend@example.com',
        expiresAt: '2026-07-21T00:00:00.000Z',
        acceptedRecipeId: null,
      },
    })
    mailMocks.sendRecipeInviteEmail.mockResolvedValue({ status: 'sent', provider: 'brevo' })

    const res = await router.request('https://api.example.test/api/v1/recipes/5/share-invites', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: 'friend@example.com' }),
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      shareUrl: 'https://api.example.test/share-invite/token-1',
      delivery: { status: 'sent', provider: 'brevo' },
    })
  })

  it('keeps the invite when email delivery fails', async () => {
    dbMocks.createRecipeShareInvite.mockResolvedValue({
      token: 'token-1',
      expiresAt: '2026-07-21T00:00:00.000Z',
      preview: {
        status: 'pending',
        recipeName: 'Pasta',
        senderEmail: 'user-a@example.com',
        recipientEmail: 'friend@example.com',
        expiresAt: '2026-07-21T00:00:00.000Z',
        acceptedRecipeId: null,
      },
    })
    mailMocks.sendRecipeInviteEmail.mockResolvedValue({
      status: 'failed',
      provider: 'brevo',
      errorCode: 'provider_rejected',
    })

    const res = await router.request('/api/v1/recipes/5/share-invites', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: 'friend@example.com' }),
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      invite: { token: 'token-1' },
      delivery: { status: 'failed', provider: 'brevo', errorCode: 'provider_rejected' },
    })
  })

  it('rejects invalid invite email with 400', async () => {
    dbMocks.createRecipeShareInvite.mockRejectedValue(new Error('invalid_email'))
    const res = await router.request('/api/v1/recipes/5/share-invites', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email: 'bad' }),
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ code: 'invalid_email' })
  })

  it('returns a public minimal invite preview', async () => {
    dbMocks.getRecipeShareInvitePreview.mockResolvedValue({
      status: 'pending',
      recipeName: 'Pasta',
      senderEmail: 'user-a@example.com',
      recipientEmail: 'friend@example.com',
      expiresAt: '2026-07-21T00:00:00.000Z',
      acceptedRecipeId: null,
    })

    const res = await router.request('/api/v1/share-invites/token-1')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      invite: {
        status: 'pending',
        recipeName: 'Pasta',
        senderEmail: 'user-a@example.com',
        recipientEmail: 'friend@example.com',
        expiresAt: '2026-07-21T00:00:00.000Z',
        acceptedRecipeId: null,
      },
    })
  })

  it('accepts an invite and returns the private copy', async () => {
    dbMocks.acceptRecipeShareInvite.mockResolvedValue({
      status: 'accepted',
      recipe: { id: 42, name: 'Pasta' },
      alreadyAccepted: false,
    })

    const res = await router.request('/api/v1/share-invites/token-1/accept', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'accepted',
      recipe: { id: 42, name: 'Pasta' },
      alreadyAccepted: false,
    })
    expect(dbMocks.acceptRecipeShareInvite).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A, email: 'user-a@example.com' }),
      'token-1',
    )
  })

  it('maps email mismatch to 403', async () => {
    dbMocks.acceptRecipeShareInvite.mockResolvedValue('email_mismatch')
    const res = await router.request('/api/v1/share-invites/token-1/accept', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ code: 'email_mismatch' })
  })

  it('maps expired invite to 410', async () => {
    dbMocks.acceptRecipeShareInvite.mockResolvedValue('expired')
    const res = await router.request('/api/v1/share-invites/token-1/accept', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(410)
    await expect(res.json()).resolves.toMatchObject({ code: 'invite_expired' })
  })
})
