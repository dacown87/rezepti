import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decryptCredential,
  encryptCredential,
  isEncrypted,
  resetCredentialKeyCacheForTests,
} from '../../src/credential-crypto.js'

// Obviously-fake test-only key — not a real secret, generated the same way the docs recommend
// (`openssl rand -base64 32`) but never used anywhere except this test file.
const TEST_KEY = Buffer.from('0'.repeat(32)).toString('base64')
const OTHER_KEY = Buffer.from('1'.repeat(32)).toString('base64')

const ORIGINAL_ENV = process.env.CREDENTIAL_ENCRYPTION_KEY

function setKey(value: string | undefined) {
  if (value === undefined) {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY
  } else {
    process.env.CREDENTIAL_ENCRYPTION_KEY = value
  }
}

beforeEach(() => {
  resetCredentialKeyCacheForTests()
})

afterEach(() => {
  setKey(ORIGINAL_ENV)
  resetCredentialKeyCacheForTests()
  vi.restoreAllMocks()
})

describe('isEncrypted', () => {
  it('is true for a v1-prefixed value', () => {
    expect(isEncrypted('v1:aaaa:bbbb:cccc')).toBe(true)
  })

  it('is false for a plain string', () => {
    expect(isEncrypted('hunter2')).toBe(false)
  })

  it('is false for an empty string', () => {
    expect(isEncrypted('')).toBe(false)
  })
})

describe('encryptCredential / decryptCredential round trip', () => {
  beforeEach(() => {
    setKey(TEST_KEY)
  })

  it('round trips a simple value', () => {
    const encrypted = encryptCredential('mySecretPassword123')
    expect(decryptCredential(encrypted)).toBe('mySecretPassword123')
  })

  it('round trips unicode content', () => {
    const plaintext = 'Pässwörd mit Umlauten äöü ß 🍳 密码'
    const encrypted = encryptCredential(plaintext)
    expect(decryptCredential(encrypted)).toBe(plaintext)
  })

  it('round trips a long value', () => {
    const plaintext = 'x'.repeat(10_000) + '; session=abc123; extra=' + 'y'.repeat(5_000)
    const encrypted = encryptCredential(plaintext)
    expect(decryptCredential(encrypted)).toBe(plaintext)
  })

  it('round trips an empty string', () => {
    const encrypted = encryptCredential('')
    expect(decryptCredential(encrypted)).toBe('')
  })

  it('produces different ciphertext for the same plaintext across calls (fresh IV)', () => {
    const first = encryptCredential('same-plaintext')
    const second = encryptCredential('same-plaintext')
    expect(first).not.toBe(second)
  })

  it('matches the documented v1:<iv>:<authTag>:<ciphertext> shape', () => {
    const encrypted = encryptCredential('shape-check')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('v1')
    // iv (12 bytes) and authTag (16 bytes) base64-decode to fixed lengths
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12)
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16)
  })

  it('throws when the auth tag is tampered with', () => {
    const encrypted = encryptCredential('tamper-me')
    const [prefix, iv, authTag, ciphertext] = encrypted.split(':')
    const tamperedTag = Buffer.from(authTag, 'base64')
    tamperedTag[0] = tamperedTag[0] ^ 0xff
    const tampered = [prefix, iv, tamperedTag.toString('base64'), ciphertext].join(':')
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('throws when the ciphertext is tampered with', () => {
    const encrypted = encryptCredential('tamper-me-too')
    const [prefix, iv, authTag, ciphertext] = encrypted.split(':')
    const tamperedCiphertext = Buffer.from(ciphertext, 'base64')
    tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff
    const tampered = [prefix, iv, authTag, tamperedCiphertext.toString('base64')].join(':')
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('does not leak ciphertext or key material in the tampering error message', () => {
    const encrypted = encryptCredential('tamper-message-check')
    const [prefix, iv, authTag, ciphertext] = encrypted.split(':')
    const tamperedTag = Buffer.from(authTag, 'base64')
    tamperedTag[0] = tamperedTag[0] ^ 0xff
    const tampered = [prefix, iv, tamperedTag.toString('base64'), ciphertext].join(':')
    try {
      decryptCredential(tampered)
      expect.unreachable('expected decryptCredential to throw')
    } catch (error) {
      const message = (error as Error).message
      expect(message).not.toContain(ciphertext)
      expect(message).not.toContain(TEST_KEY)
    }
  })

  it('throws when decrypting with a different key than the one used to encrypt', () => {
    const encrypted = encryptCredential('encrypted-under-test-key')
    resetCredentialKeyCacheForTests()
    setKey(OTHER_KEY)
    expect(() => decryptCredential(encrypted)).toThrow()
  })
})

// The "warn once" flag is a module-level boolean (by design, per spec — not per-test-resettable),
// so each test here loads a FRESH module instance via vi.resetModules() to get an independent
// flag instead of fighting test-order dependence on a shared one.
describe('legacy plaintext passthrough on read', () => {
  it('returns a non-prefixed value unchanged and warns exactly once across multiple calls', async () => {
    vi.resetModules()
    const fresh = await import('../../src/credential-crypto.js')
    setKey(TEST_KEY)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(fresh.decryptCredential('hunter2')).toBe('hunter2')
    expect(fresh.decryptCredential('anotherLegacyValue')).toBe('anotherLegacyValue')
    expect(fresh.decryptCredential('yetAnotherLegacyValue')).toBe('yetAnotherLegacyValue')

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('works with no encryption key set at all (keeps a pre-backfill deployment alive)', async () => {
    vi.resetModules()
    const fresh = await import('../../src/credential-crypto.js')
    setKey(undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(fresh.decryptCredential('plaintext-no-key-configured')).toBe('plaintext-no-key-configured')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('missing or malformed key handling', () => {
  it('encryptCredential throws naming CREDENTIAL_ENCRYPTION_KEY when unset', () => {
    setKey(undefined)
    expect(() => encryptCredential('anything')).toThrow(/CREDENTIAL_ENCRYPTION_KEY/)
  })

  it('encryptCredential throws mentioning how to generate a key', () => {
    setKey(undefined)
    expect(() => encryptCredential('anything')).toThrow(/openssl rand -base64 32/)
  })

  it('throws a distinguishable message for a key of the wrong decoded length', () => {
    setKey(Buffer.from('too-short').toString('base64'))
    expect(() => encryptCredential('anything')).toThrow(/32 Byte/)
  })

  it('the "not set" message differs from the "wrong length" message', () => {
    setKey(undefined)
    let notSetMessage = ''
    try {
      encryptCredential('x')
    } catch (error) {
      notSetMessage = (error as Error).message
    }

    resetCredentialKeyCacheForTests()
    setKey(Buffer.from('short').toString('base64'))
    let wrongLengthMessage = ''
    try {
      encryptCredential('x')
    } catch (error) {
      wrongLengthMessage = (error as Error).message
    }

    expect(notSetMessage).not.toBe(wrongLengthMessage)
    expect(notSetMessage).toMatch(/nicht gesetzt/)
    expect(wrongLengthMessage).toMatch(/32 Byte/)
  })
})
