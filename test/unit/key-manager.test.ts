import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeyManager } from '../../src/interfaces/key-manager.interface.js'

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null
  },
  setItem(key: string, value: string) {
    this.store[key] = value.toString()
  },
  removeItem(key: string) {
    delete this.store[key]
  },
  clear() {
    this.store = {}
  },
  length: 0,
  key(index: number) {
    return Object.keys(this.store)[index] || null
  },
}

describe('KeyManager Interface Tests', () => {
  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
    localStorageMock.clear()
    
    // Setup env
    process.env.GROQ_API_KEY = 'test_default_key_gsk_1234567890abcdef'
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
  })

  describe('Basic functionality', () => {
    it('should get default key from environment', () => {
      const km: KeyManager = {
        getUserKey: vi.fn().mockResolvedValue(null),
        setUserKey: vi.fn(),
        clearUserKey: vi.fn(),
        getActiveKey: vi.fn().mockResolvedValue(process.env.GROQ_API_KEY!),
        getDefaultKey: () => process.env.GROQ_API_KEY!,
        storage: 'localStorage' as const,
        priority: 'user' as const,
        validateKey: vi.fn().mockResolvedValue(true),
        hasUserKey: vi.fn().mockResolvedValue(false),
      }

      expect(km.getDefaultKey()).toBe('test_default_key_gsk_1234567890abcdef')
    })

    it('should prioritize user key over default key', async () => {
      const km: KeyManager = {
        getUserKey: vi.fn().mockResolvedValue('user_key_gsk_abcdef1234567890'),
        setUserKey: vi.fn(),
        clearUserKey: vi.fn(),
        getActiveKey: vi.fn().mockResolvedValue('user_key_gsk_abcdef1234567890'),
        getDefaultKey: () => process.env.GROQ_API_KEY!,
        storage: 'localStorage' as const,
        priority: 'user' as const,
        validateKey: vi.fn().mockResolvedValue(true),
        hasUserKey: vi.fn().mockResolvedValue(true),
      }

      expect(await km.getActiveKey()).toBe('user_key_gsk_abcdef1234567890')
      expect(await km.hasUserKey()).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should validate correct Groq key format', async () => {
      const km: KeyManager = {
        getUserKey: vi.fn(),
        setUserKey: vi.fn(),
        clearUserKey: vi.fn(),
        getActiveKey: vi.fn(),
        getDefaultKey: () => '',
        storage: 'localStorage' as const,
        priority: 'user' as const,
        validateKey: vi.fn().mockImplementation(async (key: string) => {
          return key.startsWith('gsk_') && key.length > 30
        }),
        hasUserKey: vi.fn(),
      }

      const validKey = 'gsk_1234567890abcdef1234567890abcdef'
      const invalidKey = 'invalid_key'

      expect(await km.validateKey(validKey)).toBe(true)
      expect(await km.validateKey(invalidKey)).toBe(false)
    })
  })

  describe('Storage operations', () => {
    it('should handle setting and getting user key', async () => {
      let storedKey: string | null = null
      
      const km: KeyManager = {
        getUserKey: vi.fn().mockImplementation(async () => storedKey),
        setUserKey: vi.fn().mockImplementation(async (key: string) => {
          storedKey = key
        }),
        clearUserKey: vi.fn().mockImplementation(async () => {
          storedKey = null
        }),
        getActiveKey: vi.fn().mockImplementation(async () => storedKey || process.env.GROQ_API_KEY!),
        getDefaultKey: () => process.env.GROQ_API_KEY!,
        storage: 'localStorage' as const,
        priority: 'user' as const,
        validateKey: vi.fn().mockResolvedValue(true),
        hasUserKey: vi.fn().mockImplementation(async () => storedKey !== null),
      }

      const userKey = 'gsk_testuserkey1234567890abcdef'
      
      await km.setUserKey(userKey)
      expect(await km.getUserKey()).toBe(userKey)
      expect(await km.hasUserKey()).toBe(true)
      expect(await km.getActiveKey()).toBe(userKey)

      await km.clearUserKey()
      expect(await km.getUserKey()).toBe(null)
      expect(await km.hasUserKey()).toBe(false)
      expect(await km.getActiveKey()).toBe(process.env.GROQ_API_KEY!)
    })
  })
})