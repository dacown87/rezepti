/**
 * HTTP Client für API Calls
 */

const API_BASE = ''

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408)
    }
    throw error
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      // Ignore JSON parsing errors
    }
    throw new ApiError(errorMessage, response.status)
  }

  try {
    const data = await response.json()
    return data as T
  } catch (error) {
    throw new ApiError('Invalid JSON response', 500)
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE}${endpoint}`)
  return handleResponse<T>(response)
}

export async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
  return handleResponse<T>(response)
}

export async function apiPatch<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
  return handleResponse<T>(response)
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
  })
  return handleResponse<T>(response)
}

// Polling utilities
export async function poll<T>(
  fetcher: () => Promise<T>,
  condition: (data: T) => boolean,
  options: {
    interval?: number
    maxAttempts?: number
    onProgress?: (data: T, attempt: number) => void
    exponentialBackoff?: boolean
  } = {}
): Promise<T> {
  const {
    interval = 1000,
    maxAttempts = 60, // 60 seconds max
    onProgress,
    exponentialBackoff = true,
  } = options

  let attempts = 0
  let currentInterval = interval

  while (attempts < maxAttempts) {
    try {
      const data = await fetcher()
      onProgress?.(data, attempts)
      
      if (condition(data)) {
        return data
      }
    } catch (error) {
      console.warn(`Polling attempt ${attempts + 1} failed:`, error)
      // Continue polling on error
    }

    attempts++
    
    // Exponential backoff with jitter
    if (exponentialBackoff) {
      const jitter = Math.random() * 0.3 + 0.85 // 0.85-1.15
      currentInterval = Math.min(interval * Math.pow(1.5, attempts - 1) * jitter, 10000)
    }
    
    await new Promise(resolve => setTimeout(resolve, currentInterval))
  }

  throw new ApiError('Polling timeout', 408)
}