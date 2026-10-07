import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'

const dbMocks = vi.hoisted(() => ({
  loadUserAuthorization: vi.fn(),
  ensureUserProfile: vi.fn(),
  ensureDefaultHouseholdForUser: vi.fn(),
  getAccountBootstrapStatus: vi.fn(),
  deleteUserAccount: vi.fn(),
}))

const jobMocks = vi.hoisted(() => ({
  getActiveJobs: vi.fn(),
  cancelJob: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)
vi.mock('../../src/job-manager.js', () => ({ jobManager: jobMocks }))

const { default: authRouter } = await import('../../src/routes/auth.js')

function signIn() {
  configureAuthForTests({
    verifyAccessToken: async () => ({ id: USER_ID, email: 'user@example.com' }),
    loadAuthorization: async () => ({ appRole: 'user', memberships: [], activeHouseholdId: null }),
  })
}

const call = () =>
  authRouter.request('/api/v1/auth/account', { method: 'DELETE', headers: { Authorization: 'Bearer valid-token' } })

describe('DELETE /api/v1/auth/account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    jobMocks.getActiveJobs.mockReturnValue([])
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    resetAuthAdaptersForTests()
    vi.restoreAllMocks()
  })

  it('requires authentication and deletes nothing without a token', async () => {
    const res = await authRouter.request('/api/v1/auth/account', { method: 'DELETE' })
    expect(res.status).toBe(401)
    expect(dbMocks.deleteUserAccount).not.toHaveBeenCalled()
  })

  it('deletes the account and answers 204 without logging the email', async () => {
    signIn()
    dbMocks.deleteUserAccount.mockResolvedValue({ ok: true, counts: { households: 1 } })

    const res = await call()

    expect(res.status).toBe(204)
    expect(dbMocks.deleteUserAccount).toHaveBeenCalledWith(USER_ID)
    const logged = JSON.stringify((console.info as ReturnType<typeof vi.fn>).mock.calls)
    expect(logged).toContain('auth.account.deleted')
    expect(logged).toContain('"userId":"00000000"')
    expect(logged).not.toContain('user@example.com')
    expect(logged).not.toContain(USER_ID)
  })

  it('cancels only the caller\'s active import jobs before deleting', async () => {
    signIn()
    jobMocks.getActiveJobs.mockReturnValue([
      { id: 'mine', userId: USER_ID },
      { id: 'theirs', userId: 'someone-else' },
    ])
    dbMocks.deleteUserAccount.mockResolvedValue({ ok: true, counts: {} })

    await call()

    expect(jobMocks.cancelJob).toHaveBeenCalledTimes(1)
    expect(jobMocks.cancelJob).toHaveBeenCalledWith('mine')
    expect(jobMocks.cancelJob.mock.invocationCallOrder[0]).toBeLessThan(
      dbMocks.deleteUserAccount.mock.invocationCallOrder[0],
    )
  })

  it('answers 409 when the household has other members', async () => {
    signIn()
    dbMocks.deleteUserAccount.mockResolvedValue({ ok: false, reason: 'household_has_other_members' })

    const res = await call()

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ code: 'household_has_other_members' })
  })

  it('answers 404 when the user no longer exists', async () => {
    signIn()
    dbMocks.deleteUserAccount.mockResolvedValue({ ok: false, reason: 'user_not_found' })
    expect((await call()).status).toBe(404)
  })

  it('answers a generic 500 and does not leak the database error', async () => {
    signIn()
    dbMocks.deleteUserAccount.mockRejectedValue(new Error('relation "secret_table" does not exist'))

    const res = await call()

    expect(res.status).toBe(500)
    const body = JSON.stringify(await res.json())
    expect(body).toContain('account_delete_failed')
    expect(body).not.toContain('secret_table')
  })
})
