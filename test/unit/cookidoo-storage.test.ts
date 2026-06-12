import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('cookidoo credential disk storage', () => {
  const originalCwd = process.cwd()
  let tempDir = ''

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    tempDir = mkdtempSync(join(tmpdir(), 'rezepti-cookidoo-'))
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('writes credentials via temp file rename and exposes them via getSessionStatus/getCredentials', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: { cookidoo: { email: '', password: '' } },
    }))

    const {
      saveCredentialsToDisk,
      getCredentials,
      getSessionStatus,
    } = await import('../../src/fetchers/cookidoo.js')

    saveCredentialsToDisk('cookidoo@example.com', 'secret-pw')

    const credentialsPath = join(tempDir, 'data', 'cookidoo-credentials.json')
    const tmpPath = `${credentialsPath}.tmp`

    expect(existsSync(credentialsPath)).toBe(true)
    expect(existsSync(tmpPath)).toBe(false)
    expect(JSON.parse(readFileSync(credentialsPath, 'utf-8'))).toEqual({
      email: 'cookidoo@example.com',
      password: 'secret-pw',
    })
    expect(getCredentials()).toEqual({
      email: 'cookidoo@example.com',
      password: 'secret-pw',
    })
    expect(getSessionStatus()).toEqual({
      connected: true,
      hasFileCredentials: true,
    })
  })

  it('clears cached credentials and removes the persisted credentials file', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: { cookidoo: { email: '', password: '' } },
    }))

    const {
      saveCredentialsToDisk,
      clearCredentialsFromDisk,
      getCredentials,
      getSessionStatus,
    } = await import('../../src/fetchers/cookidoo.js')

    saveCredentialsToDisk('cookidoo@example.com', 'secret-pw')
    clearCredentialsFromDisk()

    const credentialsPath = join(tempDir, 'data', 'cookidoo-credentials.json')

    expect(existsSync(credentialsPath)).toBe(false)
    expect(getCredentials()).toBeNull()
    expect(getSessionStatus()).toEqual({
      connected: false,
      hasFileCredentials: false,
    })
  })
})
