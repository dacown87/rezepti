import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('cookidoo legacy file cleanup', () => {
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

  it('removes deprecated singleton credential and session files', async () => {
    const credentialsPath = join(tempDir, 'data', 'cookidoo-credentials.json')
    const sessionPath = join(tempDir, 'data', 'cookidoo-session.json')
    const dataDir = join(tempDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(credentialsPath, JSON.stringify({ email: 'cookidoo@example.com', password: 'secret-pw' }), { encoding: 'utf-8', flag: 'w' })
    writeFileSync(sessionPath, JSON.stringify({ cookiesCookidoo: 'a=b', userAgent: 'ua', expires_at: Date.now() + 1000 }), { encoding: 'utf-8', flag: 'w' })

    expect(existsSync(dataDir)).toBe(true)

    const { removeLegacyCookidooFiles } = await import('../../src/fetchers/cookidoo.js')
    removeLegacyCookidooFiles()

    expect(existsSync(credentialsPath)).toBe(false)
    expect(existsSync(sessionPath)).toBe(false)
  })
})
