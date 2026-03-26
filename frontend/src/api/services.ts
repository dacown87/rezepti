/**
 * API Service Functions
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client.js'
import type { Recipe, JobStatus, ValidationResult, HealthStatus, KeyResponse, ShoppingItem, DictionaryEntry } from './types.js'

// Recipes
export async function getRecipes(ingredients?: string[]): Promise<Recipe[]> {
  try {
    let url = '/api/v1/recipes'
    if (ingredients && ingredients.length > 0) {
      url += `?ingredients=${encodeURIComponent(ingredients.join(','))}`
    }
    return await apiGet<Recipe[]>(url)
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
export async function startPhotoExtraction(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/v1/extract/photo', { method: 'POST', body: formData })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Fehler beim Hochladen des Fotos')
  }
  const data = await response.json()
  return data.jobId
}

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

// Shopping List (Phase 3c)
export async function getShoppingList(): Promise<{ items: ShoppingItem[] }> {
  try {
    return await apiGet<{ items: ShoppingItem[] }>('/api/v1/shopping')
  } catch (error) {
    console.error('Failed to fetch shopping list:', error)
    throw error
  }
}

export async function addShoppingItem(recipeId: number | null, canonicalName: string, quantity?: string, unit?: string): Promise<{ success: boolean; id: number }> {
  try {
    return await apiPost<{ success: boolean; id: number }>('/api/v1/shopping', {
      recipeId,
      canonicalName,
      quantity,
      unit,
    })
  } catch (error) {
    console.error('Failed to add shopping item:', error)
    throw error
  }
}

export async function toggleShoppingItem(id: number): Promise<{ success: boolean }> {
  try {
    return await apiPatch<{ success: boolean }>(`/api/v1/shopping/${id}`, {})
  } catch (error) {
    console.error(`Failed to toggle shopping item ${id}:`, error)
    throw error
  }
}

export async function deleteShoppingItem(id: number): Promise<{ success: boolean }> {
  try {
    return await apiDelete<{ success: boolean }>(`/api/v1/shopping/${id}`)
  } catch (error) {
    console.error(`Failed to delete shopping item ${id}:`, error)
    throw error
  }
}

export async function clearCheckedItems(): Promise<{ success: boolean }> {
  try {
    return await apiDelete<{ success: boolean }>('/api/v1/shopping/checked')
  } catch (error) {
    console.error('Failed to clear checked items:', error)
    throw error
  }
}

export async function clearAllShoppingItems(): Promise<{ success: boolean }> {
  try {
    return await apiDelete<{ success: boolean }>('/api/v1/shopping/all')
  } catch (error) {
    console.error('Failed to clear shopping list:', error)
    throw error
  }
}

// Ingredient Dictionary
export async function getDictionaryEntries(): Promise<{ entries: DictionaryEntry[] }> {
  try {
    return await apiGet<{ entries: DictionaryEntry[] }>('/api/v1/dictionary')
  } catch (error) {
    console.error('Failed to fetch dictionary:', error)
    throw error
  }
}

export async function addDictionaryEntry(canonicalName: string, aliases: string[] = []): Promise<{ success: boolean; id: number }> {
  try {
    return await apiPost<{ success: boolean; id: number }>('/api/v1/dictionary', {
      canonicalName,
      aliases,
    })
  } catch (error) {
    console.error('Failed to add dictionary entry:', error)
    throw error
  }
}

export async function matchDictionary(name: string): Promise<{ match: DictionaryEntry | null }> {
  try {
    return await apiGet<{ match: DictionaryEntry | null }>(`/api/v1/dictionary/match?name=${encodeURIComponent(name)}`)
  } catch (error) {
    console.error('Failed to match dictionary:', error)
    throw error
  }
}
