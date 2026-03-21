import type { KeyManager, StorageType, KeyValidationResult } from './key-manager.interface.js'
import { config } from '../config.js'

/**
 * Implementation of KeyManager interface for browser/localStorage
 */
export class BrowserKeyManager implements KeyManager {
  readonly storage: StorageType = 'localStorage'
  readonly priority: 'user' | 'default' = 'user'
  
  private readonly storageKey = 'rezepti_groq_key'

  getUserKey(): Promise<string | null> {
    const key = localStorage.getItem(this.storageKey)
    return Promise.resolve(key)
  }

  setUserKey(key: string): Promise<void> {
    localStorage.setItem(this.storageKey, key)
    return Promise.resolve()
  }

  clearUserKey(): Promise<void> {
    localStorage.removeItem(this.storageKey)
    return Promise.resolve()
  }

  getActiveKey(): Promise<string> {
    const userKey = localStorage.getItem(this.storageKey)
    return Promise.resolve(userKey || this.getDefaultKey())
  }

  getDefaultKey(): string {
    return config.groq.apiKey
  }

  async validateKey(key: string): Promise<boolean> {
    // Basic format validation
    if (!key.startsWith('gsk_')) {
      return false
    }

    // TODO: Implement actual Groq API validation
    // For now, just check if it looks like a valid key
    return key.length > 30
    
    // Future implementation:
    /*
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      })
      return response.ok
    } catch {
      return false
    }
    */
  }

  async validateKeyWithDetails(key: string): Promise<KeyValidationResult> {
    const isValid = await this.validateKey(key)
    
    if (!isValid) {
      return {
        isValid: false,
        error: 'Invalid Groq API key format',
      }
    }

    // TODO: Get actual details from Groq API
    return {
      isValid: true,
      remainingCredits: 1000, // Mock data
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000,
      },
    }
  }

  hasUserKey(): Promise<boolean> {
    const hasKey = localStorage.getItem(this.storageKey) !== null
    return Promise.resolve(hasKey)
  }
}

// Factory function for creating KeyManager based on platform
export function createKeyManager(): KeyManager {
  // Currently only browser implementation
  return new BrowserKeyManager()
}