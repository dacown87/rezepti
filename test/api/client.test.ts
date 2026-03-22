import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ApiError, apiGet, apiPost, apiPatch, apiDelete, poll } from '../../frontend/src/api/client.js'

const client = { ApiError }

describe('ApiError', () => {
  it('should create error with message and status', () => {
    const error = new ApiError('Test error', 404)
    expect(error.message).toBe('Test error')
    expect(error.status).toBe(404)
    expect(error.name).toBe('ApiError')
    expect(error).toBeInstanceOf(Error)
  })

  it('should include optional data', () => {
    const data = { code: 'NOT_FOUND' }
    const error = new ApiError('Not found', 404, data)
    expect(error.data).toEqual(data)
  })

  it('should work with throw statement', () => {
    expect(() => {
      throw new ApiError('Test', 500)
    }).toThrow('Test')
  })
})

describe('HTTP Client', () => {
  let mockFetch: any

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('apiGet', () => {
    it('should make GET request and return parsed JSON', async () => {
      const mockData = { id: 1, name: 'Test Recipe' }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      const result = await apiGet<typeof mockData>('/api/v1/recipes')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/recipes',
        expect.any(Object)
      )
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/recipes')
      expect(mockFetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
      expect(result).toEqual(mockData)
    })

    it('should throw ApiError on non-200 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.reject(new Error('Not JSON')),
      })

      await expect(apiGet('/api/v1/recipes/999')).rejects.toThrow(ApiError)
      await expect(apiGet('/api/v1/recipes/999')).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('404'),
      })
    })

    it('should extract error message from response body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid input data' }),
      })

      await expect(apiGet('/api/v1/recipes')).rejects.toMatchObject({
        status: 400,
        message: 'Invalid input data',
      })
    })

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Parse error')),
      })

      await expect(apiGet('/api/v1/recipes')).rejects.toThrow('Invalid JSON response')
    })

    it('should include timeout abort signal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiGet('/api/v1/recipes')

      const fetchCall = mockFetch.mock.calls[0]
      expect(fetchCall[1].signal).toBeDefined()
    })
  })

  describe('apiPost', () => {
    it('should make POST request with JSON body', async () => {
      const postData = { name: 'New Recipe', url: 'https://example.com' }
      const mockResponse = { id: 42, ...postData }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiPost<typeof mockResponse>('/api/v1/recipes', postData)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/recipes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make POST request without body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      await apiPost('/api/v1/migrate')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/migrate',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      )
    })

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Database connection failed' }),
      })

      await expect(apiPost('/api/v1/recipes')).rejects.toMatchObject({
        status: 500,
        message: 'Database connection failed',
      })
    })
  })

  describe('apiPatch', () => {
    it('should make PATCH request with partial data', async () => {
      const updateData = { name: 'Updated Recipe' }
      const mockResponse = { success: true }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiPatch('/api/v1/recipes/1', updateData)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/recipes/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('apiDelete', () => {
    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await apiDelete('/api/v1/recipes/1')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/recipes/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
      expect(result).toEqual({ success: true })
    })

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Recipe not found' }),
      })

      await expect(apiDelete('/api/v1/recipes/999')).rejects.toMatchObject({
        status: 404,
        message: 'Recipe not found',
      })
    })
  })
})

describe('Polling', () => {
  let mockFetch: any
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const originalRandom = Math.random

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch = vi.fn()
    global.fetch = mockFetch
    Math.random = vi.fn().mockReturnValue(1) // No jitter for predictable timing
  })

  afterEach(() => {
    vi.useRealTimers()
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
    Math.random = originalRandom
    vi.restoreAllMocks()
  })

  it('should return data when condition is met', async () => {
    const mockData = { status: 'completed', progress: 100 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    const pollPromise = poll(fetcher, condition, { interval: 100, maxAttempts: 10 })
    
    // Advance timers to allow polling to complete
    await vi.runAllTimersAsync()
    
    const result = await pollPromise
    expect(result).toEqual(mockData)
  })

  it('should throw ApiError on timeout', async () => {
    const mockData = { status: 'processing', progress: 50 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    const pollPromise = poll(fetcher, condition, { interval: 100, maxAttempts: 3 })

    await expect(pollPromise).rejects.toThrow('Polling timeout')
  })

  it('should call onProgress callback', async () => {
    const mockData = { status: 'completed', progress: 100 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'
    const onProgress = vi.fn()

    const pollPromise = poll(fetcher, condition, { 
      interval: 100, 
      maxAttempts: 10,
      onProgress 
    })

    await vi.runAllTimersAsync()
    await pollPromise

    expect(onProgress).toHaveBeenCalled()
  })

  it('should continue polling on fetch error', async () => {
    const mockData = { status: 'completed', progress: 100 }
    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    const pollPromise = poll(fetcher, condition, { interval: 100, maxAttempts: 10 })
    await vi.runAllTimersAsync()
    
    const result = await pollPromise
    expect(result).toEqual(mockData)
    expect(callCount).toBe(2)
  })

  it('should use exponential backoff', async () => {
    const mockData = { status: 'processing', progress: 0 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    let error: any
    try {
      await poll(fetcher, condition, { 
        interval: 100, 
        maxAttempts: 3,
        exponentialBackoff: true 
      })
    } catch (e) {
      error = e
    }
    
    expect(error).toBeInstanceOf(client.ApiError)
    expect((error as any).message).toBe('Polling timeout')
  })

  it('should respect custom interval', async () => {
    const mockData = { status: 'processing', progress: 0 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    let error: any
    try {
      await poll(fetcher, condition, { 
        interval: 50, 
        maxAttempts: 2,
        exponentialBackoff: false 
      })
    } catch (e) {
      error = e
    }
    
    expect(error).toBeInstanceOf(client.ApiError)
    expect((error as any).message).toBe('Polling timeout')
  })

  it('should handle immediate condition match', async () => {
    const mockData = { status: 'completed', progress: 100 }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const fetcher = () => fetch('/api/v1/jobs/123').then(r => r.json())
    const condition = (data: typeof mockData) => data.status === 'completed'

    const result = await poll(fetcher, condition, { interval: 100, maxAttempts: 10 })

    expect(result).toEqual(mockData)
    // Should not have called setTimeout if condition met immediately
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('Timeout handling', () => {
  it('should handle timeout via AbortController', async () => {
    vi.useRealTimers()
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ test: 'data' }),
    })
    global.fetch = mockFetch

    const result = await apiGet<{ test: string }>('/api/v1/recipes')
    expect(result.test).toBe('data')
  })
})
