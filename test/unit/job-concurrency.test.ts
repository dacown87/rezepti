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
const userIdB = '00000000-0000-0000-0000-000000000002'
const householdId = '10000000-0000-0000-0000-000000000001'
const validToken = 'valid-token'
const validTokenB = 'valid-token-b'
const authHeaders = { Authorization: `Bearer ${validToken}` }
const authHeadersB = { Authorization: `Bearer ${validTokenB}` }

function makeFile(name: string, type: string, sizeBytes: number) {
  const content = new Uint8Array(sizeBytes).fill(0)
  return new File([content], name, { type })
}

async function postUrl(url: string, headers: Record<string, string> = authHeaders) {
  return extractionRouter.request('/api/v1/extract/react', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

async function postText(text: string, headers: Record<string, string> = authHeaders) {
  return extractionRouter.request('/api/v1/extract/text', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

async function postPhoto(file: File, headers: Record<string, string> = authHeaders) {
  const formData = new FormData()
  formData.append('file', file)
  return extractionRouter.request('/api/v1/extract/photo', {
    method: 'POST',
    headers,
    body: formData,
  })
}

const longEnoughText =
  'Das ist ein ausreichend langer Rezepttext mit Zutaten, Schritten und genug Inhalt für die Validierung.'

describe('extraction concurrency limit', () => {
  const originalMaxConcurrent = config.jobs.maxConcurrent
  const originalMaxConcurrentPerUser = config.jobs.maxConcurrentPerUser

  function setLimit(n: number) {
    (config.jobs as { maxConcurrent: number }).maxConcurrent = n
  }

  function setPerUserLimit(n: number) {
    (config.jobs as { maxConcurrentPerUser: number }).maxConcurrentPerUser = n
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
    // The bearer token itself carries the identity here so a test can act as
    // a second, independent user just by sending a different token — no
    // mid-test reconfiguration of the auth adapters required.
    configureAuthForTests({
      verifyAccessToken: async (token) => ({
        id: token === validTokenB ? userIdB : userId,
        email: token === validTokenB ? 'user-b@example.com' : 'user-a@example.com',
      }),
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
    ;(config.jobs as { maxConcurrentPerUser: number }).maxConcurrentPerUser = originalMaxConcurrentPerUser
    // Drain any jobs this test created so active-job state never leaks
    // into the next test (jobManager is a module-level singleton).
    for (const job of jobManager.getActiveJobs()) {
      jobManager.failJob(job.id, 'test cleanup')
    }
    resetAuthAdaptersForTests()
  })

  it('creates a job when the server is under the concurrency limit', async () => {
    setLimit(5)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
    const res = await postUrl('https://example.com/under-limit')
    expect(res.status).toBe(202)
  })

  it('returns a German 429 busy payload once the URL route hits the limit', async () => {
    setLimit(1)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
    const first = await postUrl('https://example.com/filler-a')
    expect(first.status).toBe(202)

    const second = await postUrl('https://example.com/filler-b')
    expect(second.status).toBe(429)

    const body = await second.json()
    expect(body).toMatchObject({
      status: 'busy',
      scope: 'server',
      activeJobs: 1,
      maxConcurrent: 1,
    })
    expect(body.error).toBe(
      'Zu viele Importe laufen gerade gleichzeitig. Bitte in einer Minute erneut versuchen.',
    )
  })

  it('enforces the shared limit across entry points: a URL job blocks a text job', async () => {
    setLimit(1)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
    const urlJob = await postUrl('https://example.com/url-filler')
    expect(urlJob.status).toBe(202)

    const textRes = await postText(longEnoughText)
    expect(textRes.status).toBe(429)
    const body = await textRes.json()
    expect(body.status).toBe('busy')
    expect(body.scope).toBe('server')
    expect(body.error).toMatch(/gleichzeitig/)
  })

  it('enforces the shared limit across entry points: a URL job blocks a photo job', async () => {
    setLimit(1)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
    const urlJob = await postUrl('https://example.com/url-filler-2')
    expect(urlJob.status).toBe(202)

    const activeBefore = jobManager.getActiveJobs().length

    const file = makeFile('food.jpg', 'image/jpeg', 1024)
    const photoRes = await postPhoto(file)

    expect(photoRes.status).toBe(429)
    const body = await photoRes.json()
    expect(body.status).toBe('busy')
    expect(body.scope).toBe('server')

    // The whole point of checking concurrency before `file.arrayBuffer()` is
    // to avoid materialising the upload into base64 in RAM. We can't observe
    // the buffer read directly through the HTTP boundary (Hono re-parses the
    // multipart body into a fresh File instance), so we assert the outcome
    // that ordering guarantees instead: no job was created for this request.
    expect(jobManager.getActiveJobs().length).toBe(activeBefore)
  })

  it('rejects a text job at the limit without creating a job', async () => {
    setLimit(1)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
    const urlJob = await postUrl('https://example.com/url-filler-3')
    expect(urlJob.status).toBe(202)

    const activeBefore = jobManager.getActiveJobs().length
    const textRes = await postText(longEnoughText)
    expect(textRes.status).toBe(429)
    expect(jobManager.getActiveJobs().length).toBe(activeBefore)
  })

  it('allows new jobs again once active jobs drop back under the limit', async () => {
    setLimit(1)
    setPerUserLimit(99) // this test is about the global limit, not the per-user one
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

  it('blocks a user at their per-user limit with a German 429 while the server stays free', async () => {
    setLimit(10)
    setPerUserLimit(2)

    const first = await postUrl('https://example.com/per-user-a')
    expect(first.status).toBe(202)
    const second = await postUrl('https://example.com/per-user-b')
    expect(second.status).toBe(202)

    const third = await postUrl('https://example.com/per-user-c')
    expect(third.status).toBe(429)

    const body = await third.json()
    expect(body).toMatchObject({
      status: 'busy',
      scope: 'user',
      activeJobs: 2,
      maxConcurrent: 2,
    })
    expect(body.error).toBe('Du hast bereits 2 Importe laufen. Bitte warte, bis einer davon fertig ist.')

    // The global limit was nowhere near tripped — this really was the
    // per-user gate, not a coincidental global one.
    expect(jobManager.getActiveJobs().length).toBe(2)
    expect(config.jobs.maxConcurrent).toBe(10)
  })

  it('reports the server scope when both the global and per-user limits would trip', async () => {
    setLimit(1)
    setPerUserLimit(1)

    const first = await postUrl('https://example.com/both-limits-a')
    expect(first.status).toBe(202)

    const second = await postUrl('https://example.com/both-limits-b')
    expect(second.status).toBe(429)

    const body = await second.json()
    // Both gates would reject this request (1 active >= global max 1, and
    // 1 active-for-this-user >= per-user max 1) — the global check runs
    // first and must win.
    expect(body.scope).toBe('server')
    expect(body.maxConcurrent).toBe(1)
  })

  it('lets a second user create a job while the first user is stuck at their per-user limit', async () => {
    setLimit(10)
    setPerUserLimit(1)

    const userAJob = await postUrl('https://example.com/two-users-a')
    expect(userAJob.status).toBe(202)

    const userABlocked = await postUrl('https://example.com/two-users-a-2')
    expect(userABlocked.status).toBe(429)
    const blockedBody = await userABlocked.json()
    expect(blockedBody.scope).toBe('user')

    const userBJob = await postUrl('https://example.com/two-users-b', authHeadersB)
    expect(userBJob.status).toBe(202)

    const active = jobManager.getActiveJobs()
    expect(active.filter((job) => job.userId === userId).length).toBe(1)
    expect(active.filter((job) => job.userId === userIdB).length).toBe(1)
  })
})
