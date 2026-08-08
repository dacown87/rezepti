import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// This test proves the actual choke point: src/db-react.ts must encrypt Cookidoo credentials on
// write and decrypt them on read, without any of that leaking into src/fetchers/cookidoo.ts or
// src/routes/platforms.ts (which keep working with plaintext in memory, per spec). Postgres and
// drizzle are mocked so this runs without a live database — only the query-builder shape used by
// db-react.ts (insert().values().onConflictDoUpdate() / select().from().where().limit()) needs to
// be faked.

interface DbState {
  insertedValues: Record<string, unknown> | null
  conflictSet: Record<string, unknown> | null
  selectResult: Array<Record<string, unknown>>
  updateSet: Record<string, unknown> | null
}

const dbState: DbState = { insertedValues: null, conflictSet: null, selectResult: [], updateSet: null }

vi.mock('postgres', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        dbState.insertedValues = values
        return {
          onConflictDoUpdate: vi.fn((opts: { set: Record<string, unknown> }) => {
            dbState.conflictSet = opts.set
            return Promise.resolve([])
          }),
        }
      }),
    })),
    // `.from(table)` needs to work BOTH as a further-chainable query (`.where().limit()`, used by
    // the scoped Cookidoo selects) AND as directly awaitable (`await db.select(...).from(table)`,
    // used by listCookidooCredentialSecretsForBackfill's unfiltered select) — real drizzle query
    // builders are thenable at every step, so the mock needs a `.then()` too.
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(dbState.selectResult)),
        })),
        then: (resolve: (rows: Array<Record<string, unknown>>) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(dbState.selectResult).then(resolve, reject),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setValues: Record<string, unknown>) => {
        dbState.updateSet = setValues
        return {
          where: vi.fn(() => Promise.resolve()),
        }
      }),
    })),
  })),
}))

const TEST_KEY = Buffer.from('2'.repeat(32)).toString('base64')
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL
const ORIGINAL_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY

beforeEach(() => {
  dbState.insertedValues = null
  dbState.conflictSet = null
  dbState.selectResult = []
  dbState.updateSet = null
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test'
  process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY
})

afterEach(() => {
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL
  if (ORIGINAL_KEY === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
  else process.env.CREDENTIAL_ENCRYPTION_KEY = ORIGINAL_KEY
})

describe('cookidoo credential encryption choke point in db-react.ts', () => {
  it('saveUserCookidooCredentials stores ciphertext for both insert and conflict-update branches', async () => {
    const { saveUserCookidooCredentials } = await import('../../src/db-react.js')

    await saveUserCookidooCredentials('user-1', 'me@example.test', 'plaintext-password')

    expect(dbState.insertedValues).not.toBeNull()
    expect(dbState.insertedValues?.password).not.toBe('plaintext-password')
    expect(String(dbState.insertedValues?.password)).toMatch(/^v1:/)

    expect(dbState.conflictSet).not.toBeNull()
    expect(dbState.conflictSet?.password).not.toBe('plaintext-password')
    expect(String(dbState.conflictSet?.password)).toMatch(/^v1:/)

    // Email is not a credential on its own — it must stay plaintext.
    expect(dbState.insertedValues?.email).toBe('me@example.test')
  })

  it('resolveCookidooCredentials decrypts password and session cookies from encrypted storage', async () => {
    const { encryptCredential } = await import('../../src/credential-crypto.js')
    const { resolveCookidooCredentials } = await import('../../src/db-react.js')

    dbState.selectResult = [{
      scopeType: 'user',
      userId: 'user-1',
      householdId: null,
      email: 'me@example.test',
      password: encryptCredential('plaintext-password'),
      sessionCookies: encryptCredential('session=abc123'),
      sessionUserAgent: 'ua-string',
      sessionExpiresAt: null,
    }]

    const resolved = await resolveCookidooCredentials({
      userId: 'user-1',
      memberships: [],
      activeHouseholdId: null,
    })

    expect(resolved).not.toBeNull()
    expect(resolved?.password).toBe('plaintext-password')
    expect(resolved?.sessionCookies).toBe('session=abc123')
    expect(resolved?.sessionUserAgent).toBe('ua-string')
  })

  it('resolveCookidooCredentials passes through a null session cookie without decrypting', async () => {
    const { resolveCookidooCredentials } = await import('../../src/db-react.js')
    const { encryptCredential } = await import('../../src/credential-crypto.js')

    dbState.selectResult = [{
      scopeType: 'user',
      userId: 'user-1',
      householdId: null,
      email: 'me@example.test',
      password: encryptCredential('plaintext-password'),
      sessionCookies: null,
      sessionUserAgent: null,
      sessionExpiresAt: null,
    }]

    const resolved = await resolveCookidooCredentials({
      userId: 'user-1',
      memberships: [],
      activeHouseholdId: null,
    })

    expect(resolved?.sessionCookies).toBeNull()
  })
})

describe('backfill-only raw accessors deliberately bypass the encrypt/decrypt layer', () => {
  it('listCookidooCredentialSecretsForBackfill returns the raw stored values unchanged', async () => {
    const { listCookidooCredentialSecretsForBackfill } = await import('../../src/db-react.js')

    dbState.selectResult = [
      { id: 1, password: 'v1:iv:tag:ciphertext', sessionCookies: 'v1:iv2:tag2:ciphertext2' },
      { id: 2, password: 'still-plaintext-legacy-row', sessionCookies: null },
    ]

    const rows = await listCookidooCredentialSecretsForBackfill()

    // No decryption attempted — a legacy plaintext row (id=2) must pass through as-is instead of
    // being run through decryptCredential (which would just warn-and-passthrough anyway, but the
    // whole point of this accessor is that the backfill script decides what needs encrypting, so
    // it must see exactly what is in the column).
    expect(rows).toEqual([
      { id: 1, password: 'v1:iv:tag:ciphertext', sessionCookies: 'v1:iv2:tag2:ciphertext2' },
      { id: 2, password: 'still-plaintext-legacy-row', sessionCookies: null },
    ])
  })

  it('updateCookidooCredentialSecretsById writes the given values verbatim, without re-encrypting', async () => {
    const { updateCookidooCredentialSecretsById } = await import('../../src/db-react.js')

    // The caller (the backfill script) is responsible for encryption; this accessor must not
    // double-encrypt an already-encrypted value passed in.
    const alreadyEncryptedPassword = 'v1:already:encrypted:value'
    await updateCookidooCredentialSecretsById(7, { password: alreadyEncryptedPassword })

    expect(dbState.updateSet).not.toBeNull()
    expect(dbState.updateSet?.password).toBe(alreadyEncryptedPassword)
    expect(dbState.updateSet?.sessionCookies).toBeUndefined()
    expect(dbState.updateSet?.updatedAt).toBeInstanceOf(Date)
  })

  it('updateCookidooCredentialSecretsById only sets the fields actually provided', async () => {
    const { updateCookidooCredentialSecretsById } = await import('../../src/db-react.js')

    await updateCookidooCredentialSecretsById(7, { sessionCookies: 'v1:x:y:z' })

    expect(dbState.updateSet?.password).toBeUndefined()
    expect(dbState.updateSet?.sessionCookies).toBe('v1:x:y:z')
  })
})
