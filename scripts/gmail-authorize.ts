import 'dotenv/config'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { google } from 'googleapis'
import { GMAIL_READONLY_SCOPE } from '../src/gmail-monitor.js'

interface DesktopClientFile { installed?: { client_id?: string; client_secret?: string } }
const clientFile = process.env.GMAIL_OAUTH_CLIENT_FILE?.trim()
const tokenFile = process.env.GMAIL_OAUTH_TOKEN_FILE?.trim() || 'data/gmail-oauth-token.json'
if (!clientFile) throw new Error('Set GMAIL_OAUTH_CLIENT_FILE to the downloaded Desktop OAuth client JSON path.')
const parsed = JSON.parse(await readFile(clientFile, 'utf8')) as DesktopClientFile
const clientId = parsed.installed?.client_id
const clientSecret = parsed.installed?.client_secret
if (!clientId || !clientSecret) throw new Error('GMAIL_OAUTH_CLIENT_FILE must be a Desktop OAuth client JSON file (expected an installed client).')

const server = createServer()
await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()) })
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Unable to start local OAuth callback server.')
const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`
const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
console.log('Open this URL in a browser signed in as recipedeckapp@gmail.com, then approve read-only Gmail access:')
console.log(oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [GMAIL_READONLY_SCOPE] }))

try {
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('OAuth authorization timed out after 10 minutes.')), 10 * 60_000)
    server.once('request', (request, response) => {
      const callbackUrl = new URL(request.url ?? '/', redirectUri)
      const authorizationCode = callbackUrl.searchParams.get('code')
      const oauthError = callbackUrl.searchParams.get('error')
      response.writeHead(authorizationCode ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' })
      response.end(authorizationCode ? '<h1>RecipeDeck Gmail authorization complete.</h1><p>You can close this tab.</p>' : '<h1>RecipeDeck Gmail authorization failed.</h1><p>You can close this tab and inspect the terminal.</p>')
      clearTimeout(timeout)
      if (authorizationCode) resolve(authorizationCode)
      else reject(new Error(`OAuth authorization failed: ${oauthError ?? 'missing authorization code'}`))
    })
  })
  const { tokens } = await oauth.getToken(code)
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Revoke RecipeDeck access in the Google account, then retry this command.')
  await mkdir(dirname(tokenFile), { recursive: true })
  await writeFile(tokenFile, `${JSON.stringify({ clientId, clientSecret, refreshToken: tokens.refresh_token, mailbox: process.env.GMAIL_MAILBOX?.trim() || 'recipedeckapp@gmail.com' }, null, 2)}\n`, { mode: 0o600 })
  console.log(`OAuth token cache written to ${tokenFile}. Copy its values into local .env and Northflank runtime secrets; do not commit it.`)
} finally { server.close() }
