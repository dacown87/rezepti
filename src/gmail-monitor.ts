import { google } from 'googleapis'

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

export interface GmailMonitorConfig { clientId: string; clientSecret: string; refreshToken: string; mailbox: string }
export interface GmailMessageSummary { id: string; internalDate: string | null | undefined }
export interface GmailMessageMetadata { subject: string | null; internalDate: string | null | undefined }
export interface GmailMonitorClient { listInboxMessages(query: string): Promise<GmailMessageSummary[]>; getMessageMetadata(id: string): Promise<GmailMessageMetadata> }
export type GmailSmokeResult = { status: 'found'; matches: 1 } | { status: 'missing'; matches: 0 } | { status: 'ambiguous'; matches: number }

export class GmailMonitorConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'GmailMonitorConfigurationError' }
}

export function resolveGmailMonitorConfig(env: NodeJS.ProcessEnv = process.env): GmailMonitorConfig {
  const clientId = env.GMAIL_OAUTH_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.GMAIL_OAUTH_CLIENT_SECRET?.trim() ?? ''
  const refreshToken = env.GMAIL_OAUTH_REFRESH_TOKEN?.trim() ?? ''
  const mailbox = env.GMAIL_MAILBOX?.trim().toLowerCase() ?? ''
  if (!clientId || !clientSecret || !refreshToken || !mailbox) throw new GmailMonitorConfigurationError('Gmail monitor is not configured. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, and GMAIL_MAILBOX.')
  if (!/^\S+@\S+\.\S+$/.test(mailbox)) throw new GmailMonitorConfigurationError('GMAIL_MAILBOX must be a valid email address.')
  return { clientId, clientSecret, refreshToken, mailbox }
}

export function buildInboxSubjectQuery(subject: string): string {
  const normalized = subject.trim()
  if (!normalized || /[\r\n]/.test(normalized)) throw new GmailMonitorConfigurationError('The expected Gmail subject must be a single non-empty line.')
  return `in:inbox subject:${JSON.stringify(normalized)}`
}

export async function verifyExpectedInboxMessage(client: GmailMonitorClient, input: { subject: string; maxAgeMinutes?: number; now?: Date }): Promise<GmailSmokeResult> {
  const maxAgeMinutes = input.maxAgeMinutes ?? 15
  if (!Number.isInteger(maxAgeMinutes) || maxAgeMinutes < 1 || maxAgeMinutes > 1440) throw new GmailMonitorConfigurationError('maxAgeMinutes must be an integer between 1 and 1440.')
  const subject = input.subject.trim()
  const notBefore = (input.now ?? new Date()).getTime() - maxAgeMinutes * 60_000
  const messages = await client.listInboxMessages(buildInboxSubjectQuery(subject))
  let matches = 0
  for (const message of messages) {
    const metadata = await client.getMessageMetadata(message.id)
    const receivedAt = Number(metadata.internalDate ?? message.internalDate)
    if (metadata.subject === subject && Number.isFinite(receivedAt) && receivedAt >= notBefore) matches += 1
  }
  if (matches === 1) return { status: 'found', matches }
  if (matches === 0) return { status: 'missing', matches }
  return { status: 'ambiguous', matches }
}

export function createGmailMonitorClient(config: GmailMonitorConfig): GmailMonitorClient {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  const gmail = google.gmail({ version: 'v1', auth })
  return {
    async listInboxMessages(query) {
      const messages: GmailMessageSummary[] = []
      let pageToken: string | undefined
      do {
        const response = await gmail.users.messages.list({ userId: config.mailbox, q: query, maxResults: 100, pageToken })
        messages.push(...(response.data.messages ?? []).map((message) => ({ id: message.id ?? '', internalDate: message.internalDate })).filter((message) => message.id))
        pageToken = response.data.nextPageToken ?? undefined
      } while (pageToken && messages.length < 200)
      return messages
    },
    async getMessageMetadata(id) {
      const response = await gmail.users.messages.get({ userId: config.mailbox, id, format: 'metadata', metadataHeaders: ['Subject'] })
      const headers = response.data.payload?.headers ?? []
      return { subject: headers.find((header) => header.name?.toLowerCase() === 'subject')?.value ?? null, internalDate: response.data.internalDate }
    },
  }
}

export async function verifyExpectedInboxMessageFromEnv(input: { subject: string; maxAgeMinutes?: number; now?: Date; env?: NodeJS.ProcessEnv }): Promise<GmailSmokeResult> {
  return verifyExpectedInboxMessage(createGmailMonitorClient(resolveGmailMonitorConfig(input.env)), input)
}

export { GMAIL_READONLY_SCOPE }
