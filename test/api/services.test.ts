import { describe, it, expect, beforeEach, vi, afterEach, jest } from 'vitest'
import * as client from '../../frontend/src/api/client.js'
import * as services from '../../frontend/src/api/services.js'
import type { Recipe, JobStatus, ValidationResult, HealthStatus, KeyResponse } from '../../frontend/src/api/types.js'

describe('API Services', () => {
  let mockFetch: any
  let mockPoll: any

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    mockPoll = vi.spyOn(client, 'poll')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Recipe Services', () => {
    const mockRecipe: Recipe = {
      id: 1,
      name: 'Test Recipe',
      emoji: '🍕',
      duration: '30 min',
      servings: '4',
      calories: 500,
      tags: ['Italian', 'Quick'],
      ingredients: ['flour', 'tomato', 'cheese'],
      steps: ['mix', 'bake', 'enjoy'],
      source_url: 'https://example.com/recipe',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    describe('getRecipes', () => {
      it('should fetch all recipes', async () => {
        const recipes = [mockRecipe, { ...mockRecipe, id: 2, name: 'Recipe 2' }]
        
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(recipes),
        })

        const result = await services.getRecipes()

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/recipes',
          expect.any(Object)
        )
        expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/recipes')
        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('Test Recipe')
      })

      it('should throw on fetch error', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          json: () => Promise.resolve({ error: 'Database error' }),
        })

        await expect(services.getRecipes()).rejects.toThrow()
      })
    })

    describe('getRecipe', () => {
      it('should fetch single recipe by id', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockRecipe),
        })

        const result = await services.getRecipe(1)

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/recipes/1',
          expect.any(Object)
        )
        expect(result.id).toBe(1)
        expect(result.name).toBe('Test Recipe')
      })

      it('should throw 404 for non-existent recipe', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'Recipe not found' }),
        })

        await expect(services.getRecipe(999)).rejects.toThrow()
      })
    })

    describe('updateRecipe', () => {
      it('should update recipe with partial data', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const updateData = { name: 'Updated Name' }
        const result = await services.updateRecipe(1, updateData)

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/recipes/1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(updateData),
          })
        )
        expect(result.success).toBe(true)
      })

      it('should handle validation errors', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ error: 'Invalid recipe data' }),
        })

        await expect(services.updateRecipe(1, {})).rejects.toThrow()
      })
    })

    describe('deleteRecipe', () => {
      it('should delete recipe', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const result = await services.deleteRecipe(1)

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/recipes/1',
          expect.objectContaining({
            method: 'DELETE',
          })
        )
        expect(result.success).toBe(true)
      })

      it('should handle already deleted recipe', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'Recipe already deleted' }),
        })

        await expect(services.deleteRecipe(999)).rejects.toThrow()
      })
    })
  })

  describe('Extraction Job Services', () => {
    const mockJobStatus: JobStatus = {
      jobId: 'job-123',
      status: 'running',
      progress: 50,
      stage: 'extracting',
      message: 'Extracting recipe data...',
    }

    describe('startExtraction', () => {
      it('should start extraction and return jobId', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-abc123' }),
        })

        const result = await services.startExtraction('https://example.com/recipe')

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/extract/react',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com/recipe' }),
          })
        )
        expect(result).toBe('job-abc123')
      })

      it('should include userKey in params when provided', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ jobId: 'job-xyz' }),
        })

        await services.startExtraction('https://example.com', 'gsk_userkey123')

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/extract/react',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com', apiKey: 'gsk_userkey123' }),
          })
        )
      })

      it('should handle extraction service unavailable', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ error: 'Extraction service not available' }),
        })

        await expect(services.startExtraction('https://example.com')).rejects.toThrow()
      })
    })

    describe('getJobStatus', () => {
      it('should fetch job status', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockJobStatus),
        })

        const result = await services.getJobStatus('job-123')

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/extract/react/job-123',
          expect.any(Object)
        )
        expect(result.status).toBe('running')
        expect(result.progress).toBe(50)
      })

      it('should return completed status with recipeId', async () => {
        const completedJob: JobStatus = {
          jobId: 'job-123',
          status: 'completed',
          progress: 100,
          recipeId: 42,
          message: 'Recipe extracted successfully',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(completedJob),
        })

        const result = await services.getJobStatus('job-123')

        expect(result.status).toBe('completed')
        expect(result.recipeId).toBe(42)
      })

      it('should return failed status with error', async () => {
        const failedJob: JobStatus = {
          jobId: 'job-123',
          status: 'failed',
          progress: 25,
          error: 'Failed to parse webpage',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(failedJob),
        })

        const result = await services.getJobStatus('job-123')

        expect(result.status).toBe('failed')
        expect(result.error).toBe('Failed to parse webpage')
      })

      it('should throw on job not found', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'Job not found' }),
        })

        await expect(services.getJobStatus('invalid-job')).rejects.toThrow()
      })
    })

    describe('pollJobStatus', () => {
      it('should use poll function with correct parameters', async () => {
        const completedJob: JobStatus = {
          jobId: 'job-123',
          status: 'completed',
          progress: 100,
          recipeId: 42,
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(completedJob),
        })

        mockPoll.mockResolvedValue(completedJob)

        const result = await services.pollJobStatus('job-123')

        expect(mockPoll).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
          expect.objectContaining({
            interval: 1000,
            maxAttempts: 300,
            exponentialBackoff: true,
            onProgress: expect.any(Function),
          })
        )
        expect(result.status).toBe('completed')
      })

      it('should stop polling on failed status', async () => {
        const failedJob: JobStatus = {
          jobId: 'job-123',
          status: 'failed',
          progress: 50,
          error: 'Extraction failed',
        }

        mockPoll.mockImplementation((fetcher, condition) => {
          return fetcher().then((data: JobStatus) => {
            if (condition(data)) return data
            return Promise.reject(new Error('Polling timeout'))
          })
        })

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(failedJob),
        })

        await services.pollJobStatus('job-123')

        expect(mockPoll).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
          expect.objectContaining({
            interval: 1000,
            maxAttempts: 300,
          })
        )
      })
    })
  })

  describe('BYOK Management Services', () => {
    describe('validateApiKey', () => {
      it('should validate API key from server', async () => {
        const validationResult: ValidationResult = {
          valid: true,
          model: 'llama-3.1-8b-instant',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(validationResult),
        })

        const result = await services.validateApiKey('gsk_testkey123')

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/keys/validate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ apiKey: 'gsk_testkey123' }),
          })
        )
        expect(result.valid).toBe(true)
        expect(result.model).toBe('llama-3.1-8b-instant')
      })

      it('should throw on network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        await expect(services.validateApiKey('gsk_key123')).rejects.toThrow('Network error')
      })

      it('should handle invalid key response from server', async () => {
        const invalidResult: ValidationResult = {
          valid: false,
          reason: 'Invalid or expired API key',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(invalidResult),
        })

        const result = await services.validateApiKey('gsk_invalidkey')

        expect(result.valid).toBe(false)
        expect(result.reason).toBe('Invalid or expired API key')
      })
    })

    describe('saveApiKey', () => {
      it('should save API key', async () => {
        const response: KeyResponse = {
          success: true,
          keySaved: true,
          message: 'API key saved successfully',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(response),
        })

        const result = await services.saveApiKey('gsk_newkey123')

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/keys',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ apiKey: 'gsk_newkey123' }),
          })
        )
        expect(result.success).toBe(true)
        expect(result.keySaved).toBe(true)
      })

      it('should throw on save failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          json: () => Promise.resolve({ error: 'Failed to save key' }),
        })

        await expect(services.saveApiKey('gsk_newkey123')).rejects.toThrow()
      })
    })

    describe('clearApiKey', () => {
      it('should clear API key', async () => {
        const response: KeyResponse = {
          success: true,
          message: 'API key cleared',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(response),
        })

        const result = await services.clearApiKey()

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/keys',
          expect.objectContaining({
            method: 'DELETE',
          })
        )
        expect(result.success).toBe(true)
      })

      it('should throw on clear failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          json: () => Promise.resolve({ error: 'Failed to clear key' }),
        })

        await expect(services.clearApiKey()).rejects.toThrow()
      })
    })
  })

  describe('Health Service', () => {
    const mockHealth: HealthStatus = {
      server: true,
      database: 'react',
      recipeCount: 42,
      status: 'healthy',
    }

    describe('checkHealth', () => {
      it('should return health status', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockHealth),
        })

        const result = await services.checkHealth()

        expect(result.server).toBe(true)
        expect(result.database).toBe('react')
        expect(result.recipeCount).toBe(42)
        expect(result.status).toBe('healthy')
      })

      it('should throw on health check failure', async () => {
        mockFetch.mockRejectedValue(new Error('Connection refused'))

        await expect(services.checkHealth()).rejects.toThrow()
      })

      it('should return unhealthy status from server', async () => {
        const unhealthyStatus: HealthStatus = {
          server: false,
          database: 'react',
          recipeCount: 0,
          status: 'unhealthy',
          error: 'Database connection lost',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(unhealthyStatus),
        })

        const result = await services.checkHealth()

        expect(result.status).toBe('unhealthy')
        expect(result.error).toBe('Database connection lost')
      })
    })

    describe('checkReactApiSupport', () => {
      it('should return true when health check succeeds', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy' }),
        })

        const result = await services.checkReactApiSupport()

        expect(result).toBe(true)
      })

      it('should return false when health check fails', async () => {
        mockFetch.mockRejectedValue(new Error('Connection refused'))

        const result = await services.checkReactApiSupport()

        expect(result).toBe(false)
      })

      it('should return false on non-ok response', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ error: 'Service down' }),
        })

        const result = await services.checkReactApiSupport()

        expect(result).toBe(false)
      })
    })
  })

  describe('Migration Service', () => {
    describe('migrateRecipes', () => {
      it('should trigger migration', async () => {
        const response = {
          success: true,
          message: 'Migration completed: 15 recipes migrated',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(response),
        })

        const result = await services.migrateRecipes()

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/migrate',
          expect.objectContaining({
            method: 'POST',
          })
        )
        expect(result.success).toBe(true)
        expect(result.message).toContain('15 recipes migrated')
      })

      it('should throw on migration failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Migration failed: database locked' }),
        })

        await expect(services.migrateRecipes()).rejects.toThrow()
      })

      it('should handle partial migration', async () => {
        const response = {
          success: false,
          message: 'Migration partially failed: 10 of 15 recipes migrated',
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(response),
        })

        const result = await services.migrateRecipes()

        expect(result.success).toBe(false)
        expect(result.message).toContain('partially failed')
      })
    })
  })
})

describe('Service Integration', () => {
  let mockFetch: any

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should chain recipe operations', async () => {
    const recipes = [
      { id: 1, name: 'Recipe 1', emoji: '🍕', duration: '30 min', servings: '4', calories: 500, tags: [], ingredients: [], steps: [], source_url: '', created_at: '', updated_at: '' },
      { id: 2, name: 'Recipe 2', emoji: '🍔', duration: '20 min', servings: '2', calories: 600, tags: [], ingredients: [], steps: [], source_url: '', created_at: '', updated_at: '' },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(recipes),
    })

    const result = await services.getRecipes()
    expect(result).toHaveLength(2)
  })

  it('should handle extraction workflow', async () => {
    // Start extraction
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123' }),
    })

    // Poll job status - pending
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123', status: 'pending', progress: 0 }),
    })

    // Poll job status - processing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123', status: 'running', progress: 50 }),
    })

    // Poll job status - completed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123', status: 'completed', progress: 100, recipeId: 42 }),
    })

    const jobId = await services.startExtraction('https://example.com')
    expect(jobId).toBe('job-123')
  })
})
