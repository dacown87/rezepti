export type StorageType = 'localStorage' | 'asyncStorage' | 'secureStore'

export interface KeyManager {
  /**
   * Get the user's Groq API key
   */
  getUserKey(): Promise<string | null>
  
  /**
   * Set the user's Groq API key
   */
  setUserKey(key: string): Promise<void>
  
  /**
   * Clear the user's Groq API key
   */
  clearUserKey(): Promise<void>
  
  /**
   * Get the active API key (user key or default key)
   */
  getActiveKey(): Promise<string>
  
  /**
   * Get the default API key from environment
   */
  getDefaultKey(): string
  
  /**
   * Storage type being used
   */
  readonly storage: StorageType
  
  /**
   * Priority order for keys
   */
  readonly priority: 'user' | 'default'
  
  /**
   * Validate if a Groq API key is valid
   */
  validateKey(key: string): Promise<boolean>
  
  /**
   * Check if user has set their own key
   */
  hasUserKey(): Promise<boolean>
}

export interface KeyValidationResult {
  isValid: boolean
  error?: string
  remainingCredits?: number
  rateLimits?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}