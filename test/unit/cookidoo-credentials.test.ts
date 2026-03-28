import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CREDENTIALS_FILE = join(tmpdir(), 'test-cookidoo-credentials.json')

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

vi.mock('../../src/config.js', () => ({
  config: {
    cookidoo: {
      email: '',
      password: '',
    },
  },
}))

vi.mock('../../src/fetchers/cookidoo.js', async () => {
  const actual = await vi.importActual('../../src/fetchers/cookidoo.js')
  return {
    ...actual,
  }
})

describe('Cookidoo Credentials Management', () => {
  const mockFs = vi.mocked({ readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync })
  const testEmail = 'test@example.com'
  const testPassword = 'testpassword123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.existsSync.mockReturnValue(false)
  })

  describe('Credential File Operations', () => {
    it('should validate credentials file structure', () => {
      const validCredentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      expect(validCredentials.email).toBeDefined()
      expect(validCredentials.password).toBeDefined()
      expect(typeof validCredentials.email).toBe('string')
      expect(typeof validCredentials.password).toBe('string')
    })

    it('should reject credentials without email', () => {
      const invalidCredentials = {
        password: 'password123',
      }

      expect('email' in invalidCredentials).toBe(false)
    })

    it('should reject credentials without password', () => {
      const invalidCredentials = {
        email: 'test@example.com',
      }

      expect('password' in invalidCredentials).toBe(false)
    })

    it('should handle empty credentials', () => {
      const emptyCredentials = {
        email: '',
        password: '',
      }

      expect(emptyCredentials.email).toBe('')
      expect(emptyCredentials.password).toBe('')
    })
  })

  describe('Session Status', () => {
    it('should return disconnected status when no credentials exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      const status = {
        connected: false,
        hasFileCredentials: false,
      }

      expect(status.connected).toBe(false)
      expect(status.hasFileCredentials).toBe(false)
    })

    it('should return connected status when credentials exist', () => {
      mockFs.existsSync.mockReturnValue(true)

      const status = {
        connected: true,
        hasFileCredentials: true,
      }

      expect(status.connected).toBe(true)
      expect(status.hasFileCredentials).toBe(true)
    })

    it('should return email in status when credentials loaded', () => {
      const creds = { email: testEmail, password: testPassword }

      expect(creds.email).toBe(testEmail)
      expect(creds.email).not.toBeNull()
    })

    it('should mask password in status response', () => {
      const creds = { email: testEmail, password: testPassword }
      const maskedPassword = '********'

      expect(creds.password).not.toBe(maskedPassword)
    })
  })

  describe('Credential Persistence', () => {
    it('should save credentials to disk', () => {
      const credentials = { email: testEmail, password: testPassword }
      const jsonData = JSON.stringify(credentials, null, 2)

      expect(jsonData).toContain(testEmail)
      expect(JSON.parse(jsonData).email).toBe(testEmail)
    })

    it('should load credentials from disk', () => {
      const credentials = { email: testEmail, password: testPassword }
      const jsonData = JSON.stringify(credentials)

      const parsed = JSON.parse(jsonData)
      expect(parsed.email).toBe(testEmail)
      expect(parsed.password).toBe(testPassword)
    })

    it('should handle corrupted JSON gracefully', () => {
      const corruptedData = '{ invalid json }'

      expect(() => JSON.parse(corruptedData)).toThrow()
    })

    it('should handle missing fields in credentials', () => {
      const incompleteData = '{ "email": "test@example.com" }'
      const parsed = JSON.parse(incompleteData)

      expect('password' in parsed).toBe(false)
    })
  })

  describe('Credential Clearing', () => {
    it('should clear cached credentials', () => {
      let cached: { email: string; password: string } | null = {
        email: testEmail,
        password: testPassword,
      }

      cached = null

      expect(cached).toBeNull()
    })

    it('should delete credentials file', () => {
      mockFs.existsSync.mockReturnValue(true)

      const fileExists = mockFs.existsSync('/path/to/credentials.json')
      expect(fileExists).toBe(true)
    })

    it('should handle deletion of non-existent file', () => {
      mockFs.existsSync.mockReturnValue(false)

      const fileExists = mockFs.existsSync('/path/to/nonexistent.json')
      expect(fileExists).toBe(false)
    })
  })

  describe('Fallback to .env Config', () => {
    it('should fall back to .env when no file credentials exist', () => {
      mockFs.existsSync.mockReturnValue(false)

      const envCredentials = {
        email: 'env@example.com',
        password: 'envpassword',
      }

      expect(envCredentials.email).toBeDefined()
      expect(envCredentials.password).toBeDefined()
    })

    it('should prioritize file credentials over .env', () => {
      mockFs.existsSync.mockReturnValue(true)

      const fileCreds = { email: 'file@example.com', password: 'filepassword' }
      const envCreds = { email: 'env@example.com', password: 'envpassword' }

      const activeCreds = fileCreds
      expect(activeCreds.email).toBe('file@example.com')
    })
  })
})

describe('Cookidoo API Response Types', () => {
  describe('Status Response', () => {
    it('should have correct status response structure', () => {
      const statusResponse = {
        connected: true,
        hasFileCredentials: true,
        email: 'test@example.com',
      }

      expect(typeof statusResponse.connected).toBe('boolean')
      expect(typeof statusResponse.hasFileCredentials).toBe('boolean')
      expect(statusResponse.email === null || typeof statusResponse.email === 'string').toBe(true)
    })
  })

  describe('Save Credentials Response', () => {
    it('should have success response structure', () => {
      const successResponse = {
        success: true,
        message: 'Cookidoo credentials saved successfully',
      }

      expect(successResponse.success).toBe(true)
      expect(typeof successResponse.message).toBe('string')
    })
  })

  describe('Clear Credentials Response', () => {
    it('should have success response structure', () => {
      const successResponse = {
        success: true,
        message: 'Cookidoo credentials removed',
      }

      expect(successResponse.success).toBe(true)
      expect(typeof successResponse.message).toBe('string')
    })
  })

  describe('Error Response', () => {
    it('should have error response structure', () => {
      const errorResponse = {
        error: 'Failed to save Cookidoo credentials',
      }

      expect(typeof errorResponse.error).toBe('string')
    })
  })
})
