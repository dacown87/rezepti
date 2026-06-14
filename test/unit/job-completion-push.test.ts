import { describe, expect, it, vi } from 'vitest'
import { JobManager } from '../../src/job-manager.js'
import type { PushPayload } from '../../src/push.js'

describe('JobManager push notification on completion', () => {
  it('calls pushSender once with correct payload when job completes', async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    const jm = JobManager.createTestInstance({ pushSender: spy })

    const job = jm.createJob('http://x', undefined, undefined, 'user-9')
    jm.startJob(job.id)
    jm.completeJob(job.id, {
      success: true,
      recipe: { name: 'Pizza' } as any,
      recipeId: 5,
    } as any)

    // Let the fire-and-forget settle
    await new Promise(r => setTimeout(r, 0))

    expect(spy).toHaveBeenCalledOnce()
    const [calledUserId, calledPayload] = spy.mock.calls[0] as [string, PushPayload]
    expect(calledUserId).toBe('user-9')
    expect(calledPayload.title).toMatch(/fertig/i)
    expect(calledPayload.body).toBe('Pizza')
    expect(calledPayload.url).toBe('/recipe/5')
  })

  it('falls back to url "/" when recipeId is absent', async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    const jm = JobManager.createTestInstance({ pushSender: spy })

    const job = jm.createJob('http://y', undefined, undefined, 'user-10')
    jm.startJob(job.id)
    jm.completeJob(job.id, {
      success: true,
      recipe: { name: 'Suppe' } as any,
      // recipeId intentionally absent
    } as any)

    await new Promise(r => setTimeout(r, 0))

    expect(spy).toHaveBeenCalledOnce()
    const [, payload] = spy.mock.calls[0] as [string, PushPayload]
    expect(payload.url).toBe('/')
  })

  it('does not call pushSender when userId is null', async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    const jm = JobManager.createTestInstance({ pushSender: spy })

    const job = jm.createJob('http://z')  // no userId
    jm.startJob(job.id)
    jm.completeJob(job.id, { success: true } as any)

    await new Promise(r => setTimeout(r, 0))

    expect(spy).not.toHaveBeenCalled()
  })

  it('injected pushSender bypasses configureVapid gate (no VAPID keys needed)', async () => {
    // Verify that the injected sender runs without VAPID env vars being set.
    const originalPub = process.env.VAPID_PUBLIC_KEY
    const originalPriv = process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY

    const spy = vi.fn().mockResolvedValue(undefined)
    const jm = JobManager.createTestInstance({ pushSender: spy })

    const job = jm.createJob('http://w', undefined, undefined, 'user-11')
    jm.startJob(job.id)
    jm.completeJob(job.id, { success: true, recipe: { name: 'Pasta' } as any, recipeId: 3 } as any)

    await new Promise(r => setTimeout(r, 0))

    // spy must have been called even without VAPID keys
    expect(spy).toHaveBeenCalledOnce()

    // Restore
    if (originalPub !== undefined) process.env.VAPID_PUBLIC_KEY = originalPub
    if (originalPriv !== undefined) process.env.VAPID_PRIVATE_KEY = originalPriv
  })
})
