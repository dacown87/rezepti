import { describe, expect, it } from 'vitest'
import { scanContent } from '../../scripts/security/secret-scan.mjs'

describe('secret-scan', () => {
  it('flags committed Groq API keys but allows the documented placeholder', () => {
    expect(scanContent('.env.example', 'GROQ_API_KEY=gsk_...')).toEqual([])

    expect(
      scanContent('.env', 'GROQ_API_KEY=gsk_realkey1234567890abcdef'),
    ).toEqual([
      { path: '.env', line: 1, type: 'Groq API key' },
    ])
  })

  it('only allows Postgres placeholders in the password segment', () => {
    expect(
      scanContent('.env.example', 'DATABASE_URL=postgresql://postgres:<password>@db.xxxx.supabase.co:5432/postgres'),
    ).toEqual([])

    expect(
      scanContent('.env', 'DATABASE_URL=postgresql://postgres:real-secret@localhost:5432/rezepti_test'),
    ).toEqual([
      { path: '.env', line: 1, type: 'hardcoded Postgres URL' },
    ])

    expect(
      scanContent('.env', 'DATABASE_URL=postgresql://postgres:real-secret@db.example.com:5432/postgres'),
    ).toEqual([
      { path: '.env', line: 1, type: 'hardcoded Postgres URL' },
    ])
  })
})
