import { describe, expect, it } from 'vitest'
import { GmailMonitorConfigurationError, buildInboxSubjectQuery, resolveGmailMonitorConfig, verifyExpectedInboxMessage, type GmailMonitorClient } from '../../src/gmail-monitor.js'

const NOW = new Date('2026-07-25T10:00:00.000Z')
function client(messages: Array<{ id: string; subject: string; internalDate: string }>): GmailMonitorClient {
  return {
    async listInboxMessages() { return messages.map(({ id, internalDate }) => ({ id, internalDate })) },
    async getMessageMetadata(id) {
      const message = messages.find((candidate) => candidate.id === id)
      if (!message) throw new Error('not found')
      return { subject: message.subject, internalDate: message.internalDate }
    },
  }
}

describe('Gmail production monitor', () => {
  it('requires all production-only OAuth settings', () => {
    expect(() => resolveGmailMonitorConfig({})).toThrow(GmailMonitorConfigurationError)
    expect(resolveGmailMonitorConfig({ GMAIL_OAUTH_CLIENT_ID: 'client', GMAIL_OAUTH_CLIENT_SECRET: 'secret', GMAIL_OAUTH_REFRESH_TOKEN: 'refresh', GMAIL_MAILBOX: 'RecipeDeckApp@Gmail.com' })).toMatchObject({ mailbox: 'recipedeckapp@gmail.com' })
  })

  it('builds a bounded inbox subject query and rejects multiline subjects', () => {
    expect(buildInboxSubjectQuery('RecipeDeck Brevo smoke abc')).toBe('in:inbox subject:"RecipeDeck Brevo smoke abc"')
    expect(() => buildInboxSubjectQuery('bad\nsubject')).toThrow(GmailMonitorConfigurationError)
  })

  it('finds exactly one recent exact-subject message without reading a body', async () => {
    await expect(verifyExpectedInboxMessage(client([
      { id: 'new', subject: 'RecipeDeck Brevo smoke abc', internalDate: '1784973540000' },
      { id: 'old', subject: 'RecipeDeck Brevo smoke abc', internalDate: '1784970000000' },
    ]), { subject: 'RecipeDeck Brevo smoke abc', maxAgeMinutes: 15, now: NOW })).resolves.toEqual({ status: 'found', matches: 1 })
  })

  it('fails closed for missing or duplicate recent matches', async () => {
    await expect(verifyExpectedInboxMessage(client([]), { subject: 'RecipeDeck Brevo smoke abc', now: NOW })).resolves.toEqual({ status: 'missing', matches: 0 })
    await expect(verifyExpectedInboxMessage(client([
      { id: 'one', subject: 'RecipeDeck Brevo smoke abc', internalDate: '1784973540000' },
      { id: 'two', subject: 'RecipeDeck Brevo smoke abc', internalDate: '1784973541000' },
    ]), { subject: 'RecipeDeck Brevo smoke abc', now: NOW })).resolves.toEqual({ status: 'ambiguous', matches: 2 })
  })
})
