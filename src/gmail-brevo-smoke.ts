import 'dotenv/config'
import { verifyExpectedInboxMessageFromEnv } from './gmail-monitor.js'

function argument(name: string): string | undefined { const prefix = `--${name}=`; return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) }
const subject = argument('subject')
const maxAgeMinutes = Number(argument('max-age-minutes') ?? '15')
if (!subject) {
  console.error('Usage: node dist/gmail-brevo-smoke.js --subject="RecipeDeck Brevo smoke <unique-id>" [--max-age-minutes=15]')
  process.exitCode = 2
} else {
  try {
    const result = await verifyExpectedInboxMessageFromEnv({ subject, maxAgeMinutes })
    console.log(JSON.stringify({ ...result, subject, checkedAt: new Date().toISOString() }))
    if (result.status !== 'found') process.exitCode = 1
  } catch (error) {
    console.error(`Gmail smoke failed: ${error instanceof Error ? error.message : 'Unknown Gmail monitor error.'}`)
    process.exitCode = 1
  }
}
