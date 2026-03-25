/**
 * API Service Functions
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client.js'
import type { Recipe, JobStatus, ValidationResult, HealthStatus, KeyResponse } from './types.js'

// Recipes
export async function getRecipes(): Promise<Recipe[]> {
  try {
    return await apiGet<Recipe[]>('/api/v1/recipes')
  } catch (error) {
    console.error('Failed to fetch recipes:', error)
    throw error
  }
}

export async function getRecipe(id: number): Promise<Recipe> {
  try {
    return await apiGet<Recipe>(`/api/v1/recipes/${id}`)
  } catch (error) {
    console.error(`Failed to fetch recipe ${id}:`, error)
    throw error
  }
}

export async function updateRecipe(id: number, data: Partial<Recipe>): Promise<{ success: boolean }> {
  try {
    return await apiPatch<{ success: boolean }>(`/api/v1/recipes/${id}`, data)
  } catch (error) {
    console.error(`Failed to update recipe ${id}:`, error)
    throw error
  }
}

export async function deleteRecipe(id: number): Promise<{ success: boolean }> {
  try {
    return await apiDelete<{ success: boolean }>(`/api/v1/recipes/${id}`)
  } catch (error) {
    console.error(`Failed to delete recipe ${id}:`, error)
    throw error
  }
}

// Extraction Jobs
export async function startExtraction(url: string, userKey?: string): Promise<string> {
  try {
    const data = await apiPost<{ jobId: string }>('/api/v1/extract/react', {
      url,
      ...(userKey ? { apiKey: userKey } : {}),
    })
    return data.jobId
  } catch (error) {
    console.error('Failed to start extraction:', error)
    throw error
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  try {
    return await apiGet<JobStatus>(`/api/v1/extract/react/${jobId}`)
  } catch (error) {
    console.error(`Failed to get job status ${jobId}:`, error)
    throw error
  }
}

export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  return getJobStatus(jobId)
}

// BYOK Management
export async function validateApiKey(key: string): Promise<ValidationResult> {
  try {
    return await apiPost<ValidationResult>('/api/v1/keys/validate', { apiKey: key })
  } catch (error) {
    console.error('Failed to validate API key:', error)
    throw error
  }
}

export async function saveApiKey(key: string): Promise<KeyResponse> {
  try {
    return await apiPost<KeyResponse>('/api/v1/keys', { apiKey: key })
  } catch (error) {
    console.error('Failed to save API key:', error)
    throw error
  }
}

export async function clearApiKey(): Promise<KeyResponse> {
  try {
    return await apiDelete<KeyResponse>('/api/v1/keys')
  } catch (error) {
    console.error('Failed to clear API key:', error)
    throw error
  }
}

// Health
export async function checkHealth(): Promise<HealthStatus> {
  try {
    return await apiGet<HealthStatus>('/api/v1/health')
  } catch (error) {
    console.error('Failed to check health:', error)
    throw error
  }
}
