import { describe, it, expect, type LocalStorageMock } from 'vitest'
import type { Recipe, JobStatus, ValidationResult, ApiResponse, HealthStatus, KeyResponse } from '../../frontend/src/api/types.js'

describe('API Types', () => {
  describe('Recipe', () => {
    it('should accept valid recipe object', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Margherita Pizza',
        emoji: '🍕',
        duration: '45 min',
        servings: '4',
        calories: 285,
        tags: ['Italian', 'Vegetarian', 'Classic'],
        ingredients: [
          '500g flour',
          '250ml water',
          '7g yeast',
          '200g tomato sauce',
          '250g mozzarella',
          'Fresh basil leaves',
        ],
        steps: [
          'Mix flour, water, and yeast. Let rise for 1 hour.',
          'Spread tomato sauce on dough.',
          'Add mozzarella and bake at 250°C for 15 minutes.',
          'Top with fresh basil.',
        ],
        imageUrl: 'https://example.com/pizza.jpg',
        source_url: 'https://example.com/pizza-recipe',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      }

      expect(recipe.id).toBe(1)
      expect(recipe.name).toBe('Margherita Pizza')
      expect(recipe.emoji).toBe('🍕')
      expect(recipe.tags).toContain('Italian')
      expect(recipe.ingredients).toHaveLength(6)
      expect(recipe.steps).toHaveLength(4)
    })

    it('should allow optional imageUrl', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Simple Recipe',
        emoji: '🍳',
        duration: '10 min',
        servings: '1',
        calories: 100,
        tags: [],
        ingredients: [],
        steps: [],
        source_url: 'https://example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(recipe.imageUrl).toBeUndefined()
    })

    it('should handle empty arrays', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Empty Recipe',
        emoji: '❓',
        duration: '0 min',
        servings: '0',
        calories: 0,
        tags: [],
        ingredients: [],
        steps: [],
        source_url: '',
        created_at: '',
        updated_at: '',
      }

      expect(recipe.tags).toHaveLength(0)
      expect(recipe.ingredients).toHaveLength(0)
      expect(recipe.steps).toHaveLength(0)
    })

    it('should support numeric id for recipes', () => {
      const recipe: Recipe = {
        id: 999999,
        name: 'Large ID Recipe',
        emoji: '🔢',
        duration: '30 min',
        servings: '10',
        calories: 1000,
        tags: ['Large'],
        ingredients: ['lots of stuff'],
        steps: ['do it'],
        source_url: 'https://example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(typeof recipe.id).toBe('number')
      expect(recipe.id).toBeGreaterThan(0)
    })
  })

  describe('JobStatus', () => {
    it('should accept pending status', () => {
      const job: JobStatus = {
        jobId: 'job-123',
        status: 'pending',
        progress: 0,
      }

      expect(job.status).toBe('pending')
      expect(job.progress).toBe(0)
    })

    it('should accept processing status with stage', () => {
      const job: JobStatus = {
        jobId: 'job-456',
        status: 'processing',
        progress: 50,
        stage: 'extracting',
        message: 'Extracting recipe data...',
      }

      expect(job.status).toBe('processing')
      expect(job.stage).toBe('extracting')
      expect(job.message).toContain('Extracting')
    })

    it('should accept completed status with recipeId', () => {
      const job: JobStatus = {
        jobId: 'job-789',
        status: 'completed',
        progress: 100,
        message: 'Recipe extracted successfully',
        recipeId: 42,
      }

      expect(job.status).toBe('completed')
      expect(job.progress).toBe(100)
      expect(job.recipeId).toBe(42)
    })

    it('should accept failed status with error', () => {
      const job: JobStatus = {
        jobId: 'job-000',
        status: 'failed',
        progress: 25,
        error: 'Failed to parse webpage: no recipe found',
      }

      expect(job.status).toBe('failed')
      expect(job.error).toContain('Failed to parse')
    })

    it('should have valid status union type', () => {
      const statuses: JobStatus['status'][] = ['pending', 'processing', 'completed', 'failed']

      statuses.forEach(status => {
        const job: JobStatus = {
          jobId: `job-${status}`,
          status,
          progress: status === 'completed' ? 100 : 50,
        }
        expect(['pending', 'processing', 'completed', 'failed']).toContain(job.status)
      })
    })

    it('should allow optional fields to be undefined', () => {
      const minimalJob: JobStatus = {
        jobId: 'job-minimal',
        status: 'pending',
        progress: 0,
      }

      expect(minimalJob.stage).toBeUndefined()
      expect(minimalJob.message).toBeUndefined()
      expect(minimalJob.recipeId).toBeUndefined()
      expect(minimalJob.error).toBeUndefined()
    })
  })

  describe('ValidationResult', () => {
    it('should accept valid key result', () => {
      const result: ValidationResult = {
        isValid: true,
        remainingCredits: 10000,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000,
        },
      }

      expect(result.isValid).toBe(true)
      expect(result.remainingCredits).toBe(10000)
      expect(result.rateLimits?.requestsPerMinute).toBe(60)
    })

    it('should accept invalid key result', () => {
      const result: ValidationResult = {
        isValid: false,
        error: 'Invalid API key format',
      }

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid API key format')
    })

    it('should allow missing optional fields for valid key', () => {
      const result: ValidationResult = {
        isValid: true,
      }

      expect(result.remainingCredits).toBeUndefined()
      expect(result.rateLimits).toBeUndefined()
    })

    it('should support rate limits object', () => {
      const result: ValidationResult = {
        isValid: true,
        remainingCredits: 5000,
        rateLimits: {
          requestsPerMinute: 120,
          tokensPerMinute: 200000,
        },
      }

      expect(result.rateLimits).toEqual({
        requestsPerMinute: 120,
        tokensPerMinute: 200000,
      })
    })
  })

  describe('ApiResponse', () => {
    it('should accept successful response with data', () => {
      const response: ApiResponse<Recipe[]> = {
        success: true,
        data: [
          { id: 1, name: 'Recipe 1', emoji: '🍕', duration: '30 min', servings: '4', calories: 500, tags: [], ingredients: [], steps: [], source_url: '', created_at: '', updated_at: '' },
        ],
        message: 'Recipes fetched successfully',
      }

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(1)
    })

    it('should accept error response', () => {
      const response: ApiResponse = {
        success: false,
        error: 'Something went wrong',
        message: 'Failed to fetch recipes',
      }

      expect(response.success).toBe(false)
      expect(response.error).toBe('Something went wrong')
    })

    it('should work with any data type', () => {
      const response1: ApiResponse<string> = {
        success: true,
        data: 'simple string',
      }

      const response2: ApiResponse<number> = {
        success: true,
        data: 42,
      }

      const response3: ApiResponse<{ custom: boolean }> = {
        success: true,
        data: { custom: true },
      }

      expect(response1.data).toBe('simple string')
      expect(response2.data).toBe(42)
      expect(response3.data).toEqual({ custom: true })
    })
  })

  describe('HealthStatus', () => {
    it('should accept healthy status', () => {
      const health: HealthStatus = {
        server: true,
        database: 'react',
        recipeCount: 42,
        status: 'healthy',
      }

      expect(health.status).toBe('healthy')
      expect(health.server).toBe(true)
      expect(health.recipeCount).toBe(42)
    })

    it('should accept unhealthy status with error', () => {
      const health: HealthStatus = {
        server: true,
        database: 'react',
        recipeCount: 0,
        status: 'unhealthy',
        error: 'Database connection lost',
      }

      expect(health.status).toBe('unhealthy')
      expect(health.error).toBe('Database connection lost')
    })

    it('should only allow "react" database type', () => {
      const health: HealthStatus = {
        server: true,
        database: 'react',
        recipeCount: 10,
        status: 'healthy',
      }

      expect(health.database).toBe('react')
    })

    it('should support status union type', () => {
      const healthy: HealthStatus = {
        server: true,
        database: 'react',
        recipeCount: 0,
        status: 'healthy',
      }

      const unhealthy: HealthStatus = {
        server: false,
        database: 'react',
        recipeCount: 0,
        status: 'unhealthy',
        error: 'Error',
      }

      expect(['healthy', 'unhealthy']).toContain(healthy.status)
      expect(['healthy', 'unhealthy']).toContain(unhealthy.status)
    })
  })

  describe('KeyResponse', () => {
    it('should accept success response', () => {
      const response: KeyResponse = {
        success: true,
        keySaved: true,
        message: 'API key saved successfully',
      }

      expect(response.success).toBe(true)
      expect(response.keySaved).toBe(true)
    })

    it('should accept clear response', () => {
      const response: KeyResponse = {
        success: true,
        message: 'API key cleared',
      }

      expect(response.success).toBe(true)
      expect(response.keySaved).toBeUndefined()
    })

    it('should accept error response', () => {
      const response: KeyResponse = {
        success: false,
        error: 'Failed to save API key',
      }

      expect(response.success).toBe(false)
      expect(response.error).toBe('Failed to save API key')
    })

    it('should allow minimal success response', () => {
      const response: KeyResponse = {
        success: true,
      }

      expect(response.message).toBeUndefined()
      expect(response.error).toBeUndefined()
      expect(response.keySaved).toBeUndefined()
    })
  })
})

describe('Type Relationships', () => {
  it('JobStatus should be usable with service functions', () => {
    const job: JobStatus = {
      jobId: 'job-123',
      status: 'completed',
      progress: 100,
      recipeId: 42,
    }

    const isComplete = job.status === 'completed' && job.progress === 100
    
    expect(isComplete).toBe(true)
    if (isComplete && job.recipeId) {
      expect(typeof job.recipeId).toBe('number')
    }
  })

  it('ValidationResult should support conditional logic', () => {
    const result: ValidationResult = {
      isValid: true,
      remainingCredits: 5000,
    }

    if (result.isValid && result.remainingCredits !== undefined) {
      expect(result.remainingCredits).toBeGreaterThan(0)
    }

    const invalidResult: ValidationResult = {
      isValid: false,
      error: 'Invalid key',
    }

    if (!invalidResult.isValid) {
      expect(invalidResult.error).toBeDefined()
    }
  })

  it('Recipe should work with filtering patterns', () => {
    const recipes: Recipe[] = [
      { id: 1, name: 'Pizza', emoji: '🍕', duration: '45 min', servings: '4', calories: 500, tags: ['Italian'], ingredients: [], steps: [], source_url: '', created_at: '', updated_at: '' },
      { id: 2, name: 'Burger', emoji: '🍔', duration: '20 min', servings: '2', calories: 600, tags: ['American'], ingredients: [], steps: [], source_url: '', created_at: '', updated_at: '' },
    ]

    const italianRecipes = recipes.filter(r => r.tags.includes('Italian'))
    expect(italianRecipes).toHaveLength(1)
    expect(italianRecipes[0].name).toBe('Pizza')
  })

  it('HealthStatus should support status checks', () => {
    const health: HealthStatus = {
      server: true,
      database: 'react',
      recipeCount: 10,
      status: 'healthy',
    }

    const isServerReady = health.server && health.status === 'healthy'
    expect(isServerReady).toBe(true)
  })
})

describe('Edge Cases', () => {
  it('Recipe with maximum values', () => {
    const recipe: Recipe = {
      id: Number.MAX_SAFE_INTEGER,
      name: 'A'.repeat(1000),
      emoji: '🔥',
      duration: '999 min',
      servings: '9999',
      calories: Number.MAX_SAFE_INTEGER,
      tags: new Array(100).fill('tag'),
      ingredients: new Array(100).fill('ingredient'),
      steps: new Array(100).fill('step'),
      source_url: 'https://verylongurl.example.com/' + 'a'.repeat(500),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    expect(recipe.id).toBe(Number.MAX_SAFE_INTEGER)
    expect(recipe.tags).toHaveLength(100)
  })

  it('JobStatus with all fields', () => {
    const job: JobStatus = {
      jobId: 'job-with-all-fields',
      status: 'completed',
      progress: 100,
      stage: 'complete',
      message: 'All done!',
      recipeId: 12345,
      error: undefined,
    }

    expect(job.recipeId).toBe(12345)
    expect(job.stage).toBe('complete')
  })

  it('ValidationResult with zero credits', () => {
    const result: ValidationResult = {
      isValid: true,
      remainingCredits: 0,
    }

    expect(result.isValid).toBe(true)
    expect(result.remainingCredits).toBe(0)
  })

  it('HealthStatus with zero recipes', () => {
    const health: HealthStatus = {
      server: true,
      database: 'react',
      recipeCount: 0,
      status: 'healthy',
    }

    expect(health.recipeCount).toBe(0)
    expect(health.status).toBe('healthy')
  })
})
