import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'
import { jobManager } from '../../src/job-manager.js'
import type { PipelineResult } from '../../src/types.js'

// Reuses the harness style of test/unit/job-concurrency.test.ts: the real,
// module-level `jobManager` singleton is driven through the routes so we can
// observe genuine cancellation state, while everything downstream of "job
// created" (pipeline, LLM, DB, image search) is mocked so background
// processing never touches the network.

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

// processURL is a controllable deferred promise so a test can pause the
// background pipeline right after it starts running, cancel the job while
// the "pipeline" is still in flight, and only then let it resolve
// successfully — reproducing the exact race that resurrected cancelled jobs.
let resolveProcessURL: ((result: PipelineResult) => void) | undefined
vi.mock('../../src/pipeline.js', () => ({
  processURL: vi.fn(
    () =>
      new Promise<PipelineResult>((resolve) => {
        resolveProcessURL = resolve
      }),
  ),
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

async function postUrl(url: string, headers: Record<string, string> = authHeaders) {
  return extractionRouter.request('/api/v1/extract/react', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

async function deleteJob(jobId: string, headers: Record<string, string> = authHeaders) {
  return extractionRouter.request(`/api/v1/extract/react/${jobId}`, {
    method: 'DELETE',
    headers,
  })
}

describe('extraction job cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveProcessURL = undefined
    // Background processing is scheduled via `setTimeout(fn, 0)`; fake timers
    // keep it from running until a test explicitly advances them.
    vi.useFakeTimers()
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
    // Drain any jobs this test created so active-job state never leaks into
    // the next test (jobManager is a module-level singleton).
    for (const job of jobManager.getActiveJobs()) {
      jobManager.failJob(job.id, 'test cleanup')
    }
    resetAuthAdaptersForTests()
  })

  it('cancels a running job: DELETE returns success and the job stays failed with the cancel message', async () => {
    const created = await postUrl('https://example.com/cancel-me')
    expect(created.status).toBe(202)
    const { jobId } = await created.json()

    // Let the background job start (startJob runs synchronously before the
    // pipeline's returned promise is awaited).
    await vi.advanceTimersByTimeAsync(0)
    expect(jobManager.getJob(jobId)?.status).toBe('running')

    const res = await deleteJob(jobId)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true })

    const job = jobManager.getJob(jobId)
    expect(job?.status).toBe('failed')
    expect(job?.error).toBe('Import vom Nutzer abgebrochen')
  })

  it('regression: cancelling a job and then letting the background pipeline complete leaves it failed, not completed', async () => {
    const created = await postUrl('https://example.com/resurrection-check')
    expect(created.status).toBe(202)
    const { jobId } = await created.json()

    // Let the background job start.
    await vi.advanceTimersByTimeAsync(0)
    expect(jobManager.getJob(jobId)?.status).toBe('running')

    // User cancels while the "pipeline" is still in flight.
    const cancelRes = await deleteJob(jobId)
    expect(cancelRes.status).toBe(200)
    expect(jobManager.getJob(jobId)?.status).toBe('failed')

    // The pipeline now resolves successfully — this is the exact race that
    // used to resurrect a cancelled job into "completed" and fire a push
    // notification. Without the cancelRequested guard in completeJob, this
    // assertion below would fail (status flips back to "completed").
    expect(resolveProcessURL).toBeDefined()
    resolveProcessURL?.({ success: true, recipeId: 123, recipe: { name: 'Test' } as any })
    await vi.advanceTimersByTimeAsync(0)

    const job = jobManager.getJob(jobId)
    expect(job?.status).toBe('failed')
    expect(job?.error).toBe('Import vom Nutzer abgebrochen')
    expect(job?.result).toBeUndefined()
  })

  it('returns 400 when cancelling an already finished job', async () => {
    const created = await postUrl('https://example.com/already-done')
    expect(created.status).toBe(202)
    const { jobId } = await created.json()

    await vi.advanceTimersByTimeAsync(0)
    resolveProcessURL?.({ success: true, recipeId: 1, recipe: { name: 'Test' } as any })
    await vi.advanceTimersByTimeAsync(0)
    expect(jobManager.getJob(jobId)?.status).toBe('completed')

    const res = await deleteJob(jobId)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.status).toBe('completed')
  })

  it('returns 404 when cancelling another user\'s job', async () => {
    const created = await postUrl('https://example.com/not-yours', authHeaders)
    expect(created.status).toBe(202)
    const { jobId } = await created.json()

    const res = await deleteJob(jobId, authHeadersB)
    expect(res.status).toBe(404)

    // The job itself must be untouched by the failed cancellation attempt.
    expect(jobManager.getJob(jobId)?.status).not.toBe('failed')
  })
})
