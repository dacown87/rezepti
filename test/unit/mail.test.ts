import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendRecipeInviteEmail } from '../../src/mail.js'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.RECIPE_INVITE_EMAIL_PROVIDER
  delete process.env.BREVO_API_KEY
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

  it('sends recipe invite emails through Brevo when configured', async () => {
    process.env.RECIPE_INVITE_EMAIL_PROVIDER = 'brevo'
    process.env.BREVO_API_KEY = 'xkeysib_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'RecipeDeck <recipedeckapp@gmail.com>'
    process.env.RECIPE_INVITE_EMAIL_REPLY_TO = 'support@example.com'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: 'sender@example.com',
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({ status: 'sent', provider: 'brevo' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib_test')
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { name: 'RecipeDeck', email: 'recipedeckapp@gmail.com' },
      to: [{ email: 'friend@example.com' }],
      replyTo: { email: 'support@example.com' },
      subject: 'Rezept-Einladung: Pasta',
    })
  })

  it('normalizes provider rejection into a failed delivery result', async () => {
    process.env.BREVO_API_KEY = 'xkeysib_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'RecipeDeck <recipedeckapp@gmail.com>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'validation_error' }), { status: 422 })))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: null,
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({
      status: 'failed',
      provider: 'brevo',
      errorCode: 'provider_rejected',
    })
  })

  it('normalizes provider network failures into a failed delivery result', async () => {
    process.env.BREVO_API_KEY = 'xkeysib_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'RecipeDeck <recipedeckapp@gmail.com>'
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network unavailable') }))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: null,
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({
      status: 'failed',
      provider: 'brevo',
      errorCode: 'provider_unavailable',
    })
  })

  it('normalizes provider server failures into an unavailable delivery result', async () => {
    process.env.BREVO_API_KEY = 'xkeysib_test'
    process.env.RECIPE_INVITE_EMAIL_FROM = 'RecipeDeck <recipedeckapp@gmail.com>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'temporary outage' }), { status: 503 })))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendRecipeInviteEmail({
      to: 'friend@example.com',
      recipeName: 'Pasta',
      senderEmail: null,
      shareUrl: 'https://app.test/share-invite/token',
    })).resolves.toEqual({
      status: 'failed',
      provider: 'brevo',
      errorCode: 'provider_unavailable',
    })
  })
})
