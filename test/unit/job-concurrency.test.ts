import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'
import { jobManager } from '../../src/job-manager.js'
import { config } from '../../src/config.js'

// This suite deliberately does NOT mock ../../src/job-manager.js: the whole
// point is to drive the real, module-level `jobManager` singleton through
// the routes and observe the concurrency gate reacting to genuine active
// job counts. Everything downstream of "job created" (LLM calls, DB saves,
// image search) is mocked exactly as in test/unit/photo-extraction.test.ts
// so background processing can never touch the network.

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
  loadRuntimeByokValidationPolicy: vi.fn(async () => ({
    policy: {
      windowMinutes: 60,
      maxRequests: 20,
      source: 'default',
      status: 'uninitialized',
      updatedAt: null,
      updatedBy: null,
      updatedByUserId: null,
      appliesTo: ['keys_validate', 'extract_react', 'extract_photo', 'extract_text'],
    },
  })),
}))

vi.mock('../../src/pipeline.js', () => ({
  processURL: vi.fn().mockResolvedValue({ success: true, recipeId: 1, recipe: { name: 'Test' } }),
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

const { default: extractionRouter } = await import('../../src/routes/extraction.js')

const userId = '00000000-0000-0000-0000-000000000001'
const householdId = '10000000-0000-0000-0000-000000000001'
const authHeaders = { Authorization: 'Bearer valid-token' }

function makeFile(name: string, type: string, sizeBytes: number) {
  const content = new Uint8Array(sizeBytes).fill(0)
  return new File([content], name, { type })
}

async function postUrl(url: string) {
  return extractionRouter.request('/api/v1/extract/react', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

async function postText(text: string) {
  return extractionRouter.request('/api/v1/extract/text', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

async function postPhoto(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return extractionRouter.request('/api/v1/extract/photo', {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })
}

const longEnoughText =
  'Das ist ein ausreichend langer Rezepttext mit Zutaten, Schritten und genug Inhalt für die Validierung.'

describe('extraction concurrency limit', () => {
  const originalMaxConcurrent = config.jobs.maxConcurrent

  function setLimit(n: number) {
    (config.jobs as { maxConcurrent: number }).maxConcurrent = n
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // The routes schedule background processing via `setTimeout(fn, 0)`,
    // and the mocked pipeline/LLM/DB resolve immediately, so that macrotask
    // would call completeJob() and free the concurrency slot we're trying to
    // assert on. Whether it fires between two sequential `await postUrl(...)`
    // calls is pure event-loop timing — real timers made this suite flaky
    // under CI load. Fake timers make the background job deterministic: it
    // never runs unless a test explicitly advances timers.
    vi.useFakeTimers()
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
    vi.useRealTimers()
    ;(config.jobs as { maxConcurrent: number }).maxConcurrent = originalMaxConcurrent
    // Drain any jobs this test created so active-job state never leaks
    // into the next test (jobManager is a module-level singleton).
    for (const job of jobManager.getActiveJobs()) {
      jobManager.failJob(job.id, 'test cleanup')
    }
    resetAuthAdaptersForTests()
  })

  it('creates a job when the server is under the concurrency limit', async () => {
    setLimit(5)
    const res = await postUrl('https://example.com/under-limit')
    expect(res.status).toBe(202)
  })

  it('returns a German 429 busy payload once the URL route hits the limit', async () => {
    setLimit(1)
    const first = await postUrl('https://example.com/filler-a')
    expect(first.status).toBe(202)

    const second = await postUrl('https://example.com/filler-b')
    expect(second.status).toBe(429)

    const body = await second.json()
    expect(body).toMatchObject({
      status: 'busy',
      activeJobs: 1,
      maxConcurrent: 1,
    })
    expect(body.error).toBe(
      'Zu viele Importe laufen gerade gleichzeitig. Bitte in einer Minute erneut versuchen.',
    )
  })

  it('enforces the shared limit across entry points: a URL job blocks a text job', async () => {
    setLimit(1)
    const urlJob = await postUrl('https://example.com/url-filler')
    expect(urlJob.status).toBe(202)

    const textRes = await postText(longEnoughText)
    expect(textRes.status).toBe(429)
    const body = await textRes.json()
    expect(body.status).toBe('busy')
    expect(body.error).toMatch(/gleichzeitig/)
  })

  it('enforces the shared limit across entry points: a URL job blocks a photo job', async () => {
    setLimit(1)
    const urlJob = await postUrl('https://example.com/url-filler-2')
    expect(urlJob.status).toBe(202)

    const activeBefore = jobManager.getActiveJobs().length

    const file = makeFile('food.jpg', 'image/jpeg', 1024)
    const photoRes = await postPhoto(file)

    expect(photoRes.status).toBe(429)
    const body = await photoRes.json()
    expect(body.status).toBe('busy')

    // The whole point of checking concurrency before `file.arrayBuffer()` is
    // to avoid materialising the upload into base64 in RAM. We can't observe
    // the buffer read directly through the HTTP boundary (Hono re-parses the
    // multipart body into a fresh File instance), so we assert the outcome
    // that ordering guarantees instead: no job was created for this request.
    expect(jobManager.getActiveJobs().length).toBe(activeBefore)
  })

  it('rejects a text job at the limit without creating a job', async () => {
    setLimit(1)
    const urlJob = await postUrl('https://example.com/url-filler-3')
    expect(urlJob.status).toBe(202)

    const activeBefore = jobManager.getActiveJobs().length
    const textRes = await postText(longEnoughText)
    expect(textRes.status).toBe(429)
    expect(jobManager.getActiveJobs().length).toBe(activeBefore)
  })

  it('allows new jobs again once active jobs drop back under the limit', async () => {
    setLimit(1)
    const first = await postUrl('https://example.com/first')
    expect(first.status).toBe(202)
    const firstBody = await first.json()

    const blocked = await postUrl('https://example.com/second')
    expect(blocked.status).toBe(429)

    // Free the slot.
    jobManager.failJob(firstBody.jobId, 'done for test')

    const nowAllowed = await postUrl('https://example.com/third')
    expect(nowAllowed.status).toBe(202)
  })
})
