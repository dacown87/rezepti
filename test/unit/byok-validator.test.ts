import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { BYOKValidator } from '../../src/byok-validator.js'

const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
  models: {
    list: vi.fn(),
  },
}

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}))

describe('BYOKValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'gsk_testdefaultkey1234567890abcdef'
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
  })

  describe('validateKey', () => {
    it('should reject empty API key', async () => {
      const result = await BYOKValidator.validateKey('')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('API key is empty')
    })

    it('should reject whitespace-only API key', async () => {
      const result = await BYOKValidator.validateKey('   ')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('API key is empty')
    })

    it('should reject invalid key format (not starting with gsk_)', async () => {
      const result = await BYOKValidator.validateKey('sk_invalid_key_12345')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('gsk_')
    })

    it('should accept keys with minimum valid length', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'valid' } }],
        model: 'llama-3.1-8b-instant',
      })

      const result = await BYOKValidator.validateKey('gsk_12345678901234567890')
      
      expect(result.valid).toBe(true)
      expect(result.model).toBe('llama-3.1-8b-instant')
    })

    it('should validate correctly formatted Groq key', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'test response' } }],
        model: 'llama-3.1-8b-instant',
      })

      const result = await BYOKValidator.validateKey('gsk_testkey1234567890abcdef')
      
      expect(result.valid).toBe(true)
      expect(result.model).toBe('llama-3.1-8b-instant')
    })

    it('should handle 401 Unauthorized error', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue({
        status: 401,
        message: 'Unauthorized',
      })

      const result = await BYOKValidator.validateKey('gsk_invalid_key_1234567890')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('unauthorized')
    })

    it('should handle 403 Forbidden error', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue({
        status: 403,
        message: 'Forbidden',
      })

      const result = await BYOKValidator.validateKey('gsk_forbidden_key_1234567890')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('permissions')
    })

    it('should handle 429 Rate limit error', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      })

      const result = await BYOKValidator.validateKey('gsk_rate_limited_key_1234567890')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Rate limit')
    })

    it('should handle network errors gracefully', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue({
        message: 'Network connection failed',
      })

      const result = await BYOKValidator.validateKey('gsk_network_error_key_1234567890')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('validation failed')
    })

    it('should return false when API returns no content', async () => {
      mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: null } }],
      })

      const result = await BYOKValidator.validateKey('gsk_empty_response_key_1234567890')
      
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('No response')
    })
  })

  describe('hashKey', () => {
    it('should generate consistent SHA256 hash', () => {
      const key = 'gsk_testkey1234567890abcdef'
      const hash1 = BYOKValidator.hashKey(key)
      const hash2 = BYOKValidator.hashKey(key)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('should generate different hashes for different keys', () => {
      const hash1 = BYOKValidator.hashKey('gsk_key1_1234567890abcdef')
      const hash2 = BYOKValidator.hashKey('gsk_key2_1234567890abcdef')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce valid hex string', () => {
      const hash = BYOKValidator.hashKey('gsk_testkey1234567890abcdef')
      expect(/^[a-f0-9]+$/i.test(hash)).toBe(true)
    })
  })

  describe('checkRateLimit', () => {
    it('should always return allowed for now (placeholder implementation)', async () => {
      const result = await BYOKValidator.checkRateLimit('test_hash_123')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(100)
    })

    it('should include reset time in response', async () => {
      const before = Date.now()
      const result = await BYOKValidator.checkRateLimit('test_hash_456')
      const after = Date.now()

      expect(result.resetTime).toBeGreaterThanOrEqual(before)
      expect(result.resetTime).toBeLessThanOrEqual(after + 60 * 60 * 1000)
    })

    it('should respect custom max requests parameter', async () => {
      const result = await BYOKValidator.checkRateLimit('test_hash_789', 30, 50)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
    })
  })

  describe('getAvailableModels', () => {
    it('should filter and return Groq models', async () => {
      mockOpenAI.models.list = vi.fn().mockResolvedValue({
        data: [
          { id: 'llama-3.1-8b-instant' },
          { id: 'mixtral-8x7b-32768' },
          { id: 'gemma2-9b-it' },
          { id: 'gpt-4' },
        ],
      })

      const models = await BYOKValidator.getAvailableModels('gsk_test_key_123')

      expect(models).toContain('llama-3.1-8b-instant')
      expect(models).toContain('mixtral-8x7b-32768')
      expect(models).toContain('gemma2-9b-it')
      expect(models).not.toContain('gpt-4')
    })

    it('should return empty array on error', async () => {
      mockOpenAI.models.list = vi.fn().mockRejectedValue(new Error('API Error'))

      const models = await BYOKValidator.getAvailableModels('gsk_error_key_123')

      expect(models).toEqual([])
    })

    it('should remove duplicate models', async () => {
      mockOpenAI.models.list = vi.fn().mockResolvedValue({
        data: [
          { id: 'llama-3.1-8b-instant' },
          { id: 'llama-3.1-8b-instant' },
          { id: 'mixtral-8x7b-32768' },
        ],
      })

      const models = await BYOKValidator.getAvailableModels('gsk_dup_key_123')

      expect(models).toHaveLength(2)
    })
  })
})
