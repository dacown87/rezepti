import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies before importing the route
const mockCreateJob = vi.fn()
const mockStartJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCompleteJob = vi.fn()
const mockFailJob = vi.fn()
const mockGetJob = vi.fn()
const mockIsUrlProcessing = vi.fn().mockReturnValue(false)

vi.mock('../../src/job-manager.js', () => ({
  jobManager: {
    createJob: mockCreateJob,
    startJob: mockStartJob,
    updateJob: mockUpdateJob,
    completeJob: mockCompleteJob,
    failJob: mockFailJob,
    getJob: mockGetJob,
    jobToEvent: vi.fn(),
    getJobEventsSince: vi.fn(),
    getRecentJobs: vi.fn(),
    isUrlProcessing: mockIsUrlProcessing,
  },
}))

vi.mock('../../src/processors/llm.js', () => ({
  extractRecipeFromImage: vi.fn().mockResolvedValue({
    name: 'Foto-Testrezept',
    duration: 'kurz',
    tags: [],
    emoji: '🍽️',
    ingredients: ['1 Testzutat'],
    steps: ['Testen.'],
  }),
  extractRecipeFromText: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => ({
  saveRecipeToReactDb: vi.fn().mockReturnValue(42),
}))

vi.mock('../../src/pipeline.js', () => ({
  processURL: vi.fn(),
  toUserFriendlyError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unbekannter Fehler',
    hint: undefined,
  })),
  buildQualityWarnings: vi.fn(() => []),
}))

vi.mock('../../src/classifier.js', () => ({
  classifyURL: vi.fn().mockReturnValue({ type: 'web' }),
}))

vi.mock('../../src/middleware/facebook-rate-limit.js', () => ({
  checkFacebookRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('../../src/utils/image-search.js', () => ({
  searchRecipeImages: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../src/byok-validator.js', () => ({
  BYOKValidator: {
    validateKey: vi.fn(),
    hashKey: vi.fn(),
  },
}))

const { default: extractionRouter } = await import('../../src/routes/extraction.js')

function makePhotoRequest(file: File | null, fieldName = 'file') {
  const formData = new FormData()
  if (file) formData.append(fieldName, file)
  return extractionRouter.request('/api/v1/extract/photo', {
    method: 'POST',
    body: formData,
  })
}

function makeFile(name: string, type: string, sizeBytes: number) {
  const content = new Uint8Array(sizeBytes).fill(0)
  return new File([content], name, { type })
}

describe('photo extraction route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsUrlProcessing.mockReturnValue(false)
  })

  describe('input validation', () => {
    it('returns 400 when no file is provided', async () => {
      const res = await makePhotoRequest(null)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Keine Datei/i)
    })

    it('returns 400 for disallowed file type (PDF)', async () => {
      const file = makeFile('recipe.pdf', 'application/pdf', 100)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Ungültiges Format/i)
    })

    it('returns 400 for disallowed file type (GIF)', async () => {
      const file = makeFile('recipe.gif', 'image/gif', 100)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/Ungültiges Format/i)
    })

    it('returns 400 when file exceeds 10 MB', async () => {
      const file = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/zu groß/i)
    })

    it('accepts JPEG files', async () => {
      mockCreateJob.mockReturnValue({ id: 'job-jpeg' })
      const file = makeFile('photo.jpg', 'image/jpeg', 1024)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(202)
    })

    it('accepts PNG files', async () => {
      mockCreateJob.mockReturnValue({ id: 'job-png' })
      const file = makeFile('photo.png', 'image/png', 1024)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(202)
    })

    it('accepts WebP files', async () => {
      mockCreateJob.mockReturnValue({ id: 'job-webp' })
      const file = makeFile('photo.webp', 'image/webp', 1024)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(202)
    })

    it('accepts file exactly at 10 MB limit', async () => {
      mockCreateJob.mockReturnValue({ id: 'job-limit' })
      const file = makeFile('photo.jpg', 'image/jpeg', 10 * 1024 * 1024)
      const res = await makePhotoRequest(file)
      expect(res.status).toBe(202)
    })
  })

  describe('job creation', () => {
    it('creates a job and returns jobId + pollUrl', async () => {
      mockCreateJob.mockReturnValue({ id: 'photo-job-1' })
      const file = makeFile('food.jpg', 'image/jpeg', 512)

      const res = await makePhotoRequest(file)
      expect(res.status).toBe(202)

      const body = await res.json()
      expect(body.jobId).toBe('photo-job-1')
      expect(body.status).toBe('pending')
      expect(body.pollUrl).toBe('/api/v1/extract/react/photo-job-1')
      expect(mockCreateJob).toHaveBeenCalledOnce()
    })

    it('passes filename to jobManager.createJob', async () => {
      mockCreateJob.mockReturnValue({ id: 'photo-job-2' })
      const file = makeFile('mein-rezept.jpg', 'image/jpeg', 512)

      await makePhotoRequest(file)
      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.stringContaining('mein-rezept.jpg'),
        undefined
      )
    })
  })
})

describe('URL extraction route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsUrlProcessing.mockReturnValue(false)
  })

  it('returns 400 when URL is missing', async () => {
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/URL is required/i)
  })

  it('returns 400 for invalid URL format', async () => {
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid URL/i)
  })

  it('returns 409 when URL is already being processed', async () => {
    mockIsUrlProcessing.mockReturnValue(true)
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.status).toBe('conflict')
  })

  it('creates a job for valid URL', async () => {
    mockCreateJob.mockReturnValue({ id: 'url-job-1' })
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
    })
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.jobId).toBe('url-job-1')
    expect(body.pollUrl).toBe('/api/v1/extract/react/url-job-1')
  })
})
