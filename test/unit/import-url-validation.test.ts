import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'
import { jobManager } from '../../src/job-manager.js'

// Drive the real extraction route with the real `jobManager` singleton and the
// real `safe-fetch` guard, while everything downstream of "job created" is
// mocked so background processing can never touch the network. A blocked URL
// must be rejected before a job is ever created.

vi.mock('../../src/processors/llm.js', () => ({
  extractRecipeFromImage: vi.fn(),
  extractRecipeFromText: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => ({
  saveRecipeToReactDb: vi.fn().mockReturnValue(42),
  loadUserAuthorization: vi.fn(),
  consumeImportQuota: vi.fn(async () => ({ allowed: true })),
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
  processURL: vi.fn(),
  toUserFriendlyError: vi.fn(),
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

vi.mock('../../src/byok-policy.js', () => ({
  ByokValidationFailure: class extends Error {},
  enforceByokValidation: vi.fn(),
}))

const { default: extractionRouter } = await import('../../src/routes/extraction.js')

const userId = '00000000-0000-0000-0000-000000000001'

function configureAuth() {
  configureAuthForTests({
    verifyAccessToken: async () => ({ id: userId, email: 'user@example.com' }),
    loadAuthorization: async () => ({
      appRole: 'user' as const,
      memberships: [{ householdId: '10000000-0000-0000-0000-000000000001', role: 'owner' as const }],
      activeHouseholdId: '10000000-0000-0000-0000-000000000001',
    }),
  })
}

async function postUrl(url: string) {
  return extractionRouter.request('/api/v1/extract/react', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('import URL SSRF validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureAuth()
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
    for (const job of jobManager.getActiveJobs()) {
      jobManager.failJob(job.id, 'test cleanup')
    }
  })

  it('rejects a loopback URL with 400 and creates no job', async () => {
    const res = await postUrl('http://127.0.0.1:3000/admin')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Diese Adresse kann nicht importiert werden.' })
    expect(jobManager.getActiveJobs()).toHaveLength(0)
  })

  it('rejects a file:// URL with 400 and creates no job', async () => {
    const res = await postUrl('file:///etc/passwd')
    expect(res.status).toBe(400)
    expect(jobManager.getActiveJobs()).toHaveLength(0)
  })

  it('rejects localhost with 400 and creates no job', async () => {
    const res = await postUrl('http://localhost:3001/health')
    expect(res.status).toBe(400)
    expect(jobManager.getActiveJobs()).toHaveLength(0)
  })

  it('rejects a metadata IP with 400 and creates no job', async () => {
    const res = await postUrl('http://169.254.169.254/latest/meta-data/')
    expect(res.status).toBe(400)
    expect(jobManager.getActiveJobs()).toHaveLength(0)
  })

  it('rejects an unparseable URL with 400 and creates no job', async () => {
    const res = await postUrl('not-a-valid-url')
    expect(res.status).toBe(400)
    expect(jobManager.getActiveJobs()).toHaveLength(0)
  })
})
