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
}

export interface JobStatus {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  stage?: string
  message?: string
  recipeId?: number
  error?: string
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  remainingCredits?: number
  rateLimits?: {
    requestsPerMinute: number
    tokensPerMinute: number
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