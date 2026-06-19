import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

// Mock all external dependencies before importing the route
const mockCreateJob = vi.fn()
const mockStartJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCompleteJob = vi.fn()
const mockFailJob = vi.fn()
const mockGetJob = vi.fn()
const mockIsUrlProcessing = vi.fn().mockReturnValue(false)
const mockJobToEvent = vi.fn()
const mockGetRecentJobs = vi.fn()

vi.mock('../../src/job-manager.js', () => ({
  jobManager: {
    createJob: mockCreateJob,
    startJob: mockStartJob,
    updateJob: mockUpdateJob,
    completeJob: mockCompleteJob,
    failJob: mockFailJob,
    getJob: mockGetJob,
    jobToEvent: mockJobToEvent,
    getJobEventsSince: vi.fn(),
    getRecentJobs: mockGetRecentJobs,
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
  extractRecipeFromText: vi.fn().mockResolvedValue({
    name: 'Text-Testrezept',
    duration: 'kurz',
    tags: [],
    emoji: '🍽️',
    ingredients: ['1 Testzutat'],
    steps: ['Testen.'],
  }),
}))

vi.mock('../../src/db-react.js', () => ({
  saveRecipeToReactDb: vi.fn().mockReturnValue(42),
  loadUserAuthorization: vi.fn(),
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

const { searchRecipeImages } = await import('../../src/utils/image-search.js')

vi.mock('../../src/byok-validator.js', () => ({
  BYOKValidator: {
    validateKey: vi.fn(),
    hashKey: vi.fn(),
  },
}))

const { default: extractionRouter } = await import('../../src/routes/extraction.js')

const userId = '00000000-0000-0000-0000-000000000001'
const householdId = '10000000-0000-0000-0000-000000000001'
const authHeaders = { Authorization: 'Bearer valid-token' }

function makePhotoRequest(file: File | null, fieldName = 'file') {
  const formData = new FormData()
  if (file) formData.append(fieldName, file)
  return extractionRouter.request('/api/v1/extract/photo', {
    method: 'POST',
    headers: authHeaders,
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
    mockGetJob.mockReturnValue({ id: 'test-job', userId })
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
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
        undefined,
        undefined,
        userId,
        householdId,
      )
    })
  })
})

describe('URL extraction route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsUrlProcessing.mockReturnValue(false)
    mockGetJob.mockReturnValue({ id: 'test-job', userId })
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('returns 400 when URL is missing', async () => {
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/URL is required/i)
  })

  it('returns 400 for invalid URL format', async () => {
    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
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
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
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
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
    })
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.jobId).toBe('url-job-1')
    expect(body.pollUrl).toBe('/api/v1/extract/react/url-job-1')
  })

  it('creates user-owned URL extraction jobs without an active household', async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [],
        activeHouseholdId: null,
      }),
    })
    mockCreateJob.mockReturnValue({ id: 'url-job-no-household' })

    const res = await extractionRouter.request('/api/v1/extract/react', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/private-recipe' }),
    })

    expect(res.status).toBe(202)
    expect(mockCreateJob).toHaveBeenCalledWith(
      'https://example.com/private-recipe',
      undefined,
      undefined,
      userId,
      null,
    )
  })

  it('requires auth to poll user-owned jobs', async () => {
    mockGetJob.mockReturnValue({
      id: 'private-job',
      url: 'https://example.com/recipe',
      status: 'completed',
      progress: 100,
      userId: '00000000-0000-0000-0000-000000000001',
    })

    const res = await extractionRouter.request('/api/v1/extract/react/private-job')

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('auth_missing')
    expect(mockJobToEvent).not.toHaveBeenCalled()
  })

  it('polls user-owned jobs for the matching authenticated user', async () => {
    mockGetJob.mockReturnValue({
      id: 'private-job',
      url: 'https://example.com/recipe',
      status: 'completed',
      progress: 100,
      userId,
    })
    mockJobToEvent.mockReturnValue({ id: 'private-job', status: 'completed', progress: 100 })
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    const res = await extractionRouter.request('/api/v1/extract/react/private-job', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'private-job', status: 'completed', progress: 100 })
  })

  it('hides other users private jobs from the job list', async () => {
    mockGetRecentJobs.mockReturnValue([
      { id: 'public-job', userId: null },
      { id: 'own-job', userId },
      { id: 'foreign-job', userId: '00000000-0000-0000-0000-000000000002' },
    ])
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' }],
        activeHouseholdId: '10000000-0000-0000-0000-000000000001',
      }),
    })

    const res = await extractionRouter.request('/api/v1/extract/jobs', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      jobs: [{ id: 'own-job' }],
      total: 1,
    })
  })
})

describe('text extraction route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('snapshots activeHouseholdId for text extraction jobs', async () => {
    mockCreateJob.mockReturnValue({ id: 'text-job-household' })

    const res = await extractionRouter.request('/api/v1/extract/text', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Das ist ein ausreichend langer Rezepttext mit Zutaten, Schritten und genug Inhalt für die Validierung.',
      }),
    })

    expect(res.status).toBe(202)
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.stringContaining('text://manual-'),
      undefined,
      undefined,
      userId,
      householdId,
    )
  })
})

describe('image search endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureAuthForTests({
      verifyAccessToken: async () => ({ id: userId, email: 'user-a@example.com' }),
      loadAuthorization: async () => ({
        appRole: 'user',
        memberships: [{ householdId, role: 'owner' }],
        activeHouseholdId: householdId,
      }),
    })
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
  })

  it('requires auth before searching for recipe images', async () => {
    const res = await extractionRouter.request('/api/v1/images/search?q=lasagne')

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'auth_missing' },
    })
    expect(searchRecipeImages).not.toHaveBeenCalled()
  })

  it('returns searched images for authenticated users and honors allowed limits', async () => {
    vi.mocked(searchRecipeImages).mockResolvedValueOnce([
      'https://cdn.example.com/lasagne-1.jpg',
      'https://cdn.example.com/lasagne-2.jpg',
    ])

    const res = await extractionRouter.request('/api/v1/images/search?q=lasagne&limit=8', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      images: [
        'https://cdn.example.com/lasagne-1.jpg',
        'https://cdn.example.com/lasagne-2.jpg',
      ],
    })
    expect(searchRecipeImages).toHaveBeenCalledWith('lasagne', 8)
  })
})
