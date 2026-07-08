import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendRecipeInviteEmail } from '../../src/mail.js'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.RECIPE_INVITE_EMAIL_PROVIDER
  delete process.env.RESEND_API_KEY
  delete process.env.RECIPE_INVITE_EMAIL_FROM
  delete process.env.RECIPE_INVITE_EMAIL_REPLY_TO
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('sendRecipeInviteEmail', () => {
  it('skips delivery when mail is not configured', async () => {
    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: 'sender@example.com',
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({
      status: 'skipped',
      provider: 'disabled',
      errorCode: 'mail_not_configured',
    })
  })

  it('sends recipe invite emails through Resend when configured', async () => {
    process.env.RECIPE_INVITE_EMAIL_PROVIDER = 'resend'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'Rezepti <invite@example.com>'
    process.env.RECIPE_INVITE_EMAIL_REPLY_TO = 'support@example.com'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: 'sender@example.com',
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({ status: 'sent', provider: 'resend' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test')
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: 'Rezepti <invite@example.com>',
      to: ['friend@example.com'],
      reply_to: 'support@example.com',
      subject: 'Rezept-Einladung: Pasta',
    })
  })

  it('normalizes provider rejection into a failed delivery result', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'Rezepti <invite@example.com>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'validation_error' }), { status: 422 })))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: null,
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({
      status: 'failed',
      provider: 'resend',
      errorCode: 'provider_rejected',
    })
  })
})
