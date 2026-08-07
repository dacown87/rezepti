import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { sendRecipeInviteEmail } from './mail.js'
import { resolveGmailMonitorConfig, verifyExpectedInboxMessage, createGmailMonitorClient } from './gmail-monitor.js'

const enabled = process.env.GMAIL_BREVO_PROBE_ENABLED === 'true'
if (!enabled) {
  console.error('Gmail Brevo probe is disabled. Set GMAIL_BREVO_PROBE_ENABLED=true for this controlled internal operation.')
  process.exitCode = 2
} else {
  const config = resolveGmailMonitorConfig()
  const probeId = randomUUID()
  const recipeName = `Brevo delivery probe ${probeId}`
  const subject = `Rezept-Einladung: ${recipeName}`
  const sent = await sendRecipeInviteEmail({
    to: config.mailbox,
    recipeName,
    senderEmail: null,
    shareUrl: `${(process.env.RECIPE_INVITE_BASE_URL || 'https://p01--rezepti-app--2s7hvlwm5zc5.code.run').replace(/\/+$/, '')}/share-invite/gmail-production-probe`,
  })
  if (sent.status !== 'sent') {
    console.error(`Gmail Brevo probe could not send through ${sent.provider}: ${sent.errorCode ?? 'unknown error'}`)
    process.exitCode = 1
  } else {
    const client = createGmailMonitorClient(config)
    const deadline = Date.now() + 15 * 60_000
    let result: Awaited<ReturnType<typeof verifyExpectedInboxMessage>> = { status: 'missing', matches: 0 }
    do {
      result = await verifyExpectedInboxMessage(client, { subject, maxAgeMinutes: 15 })
      if (result.status !== 'missing') break
      if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 15_000))
    } while (Date.now() < deadline)
    console.log(JSON.stringify({ ...result, probeId, checkedAt: new Date().toISOString() }))
    if (result.status !== 'found') process.exitCode = 1
  }
}
