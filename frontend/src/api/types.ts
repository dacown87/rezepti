/**
 * API Types für React Frontend
 */

export interface Recipe {
  id: number
  name: string
  emoji: string
  duration: string
  servings: string
  calories: number
  tags: string[]
  ingredients: string[]
  steps: string[]
  imageUrl?: string
  source_url: string
  created_at: string
  updated_at: string
  rating?: number | null
  notes?: string | null
}

export interface JobStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  stage?: string
  message?: string
  recipeId?: number
  error?: string
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  model?: string
  remainingCredits?: number
  rateLimits?: {
    remaining: number
    limit: number
    reset: string
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface HealthStatus {
  server: boolean
  database: 'react'
  recipeCount: number
  status: 'healthy' | 'unhealthy'
  error?: string
}

export interface KeyResponse {
  success: boolean
  message?: string
  error?: string
  keySaved?: boolean
}

export interface ShoppingItem {
  id: number
  recipe_id: number | null
  canonical_name: string
  quantity?: string
  unit?: string
  checked: boolean
  created_at: string
}

export interface DictionaryEntry {
  id: number
  canonical_name: string
  aliases: string[]
}