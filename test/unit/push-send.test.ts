import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SendPushDeps, PushPayload } from '../../src/push.js'

describe('sendPushToUser', () => {
  const sub1 = { id: 1, endpoint: 'https://push.example.com/sub1', keys: JSON.stringify({ p256dh: 'key1', auth: 'auth1' }) }
  const sub2 = { id: 2, endpoint: 'https://push.example.com/sub2', keys: JSON.stringify({ p256dh: 'key2', auth: 'auth2' }) }

  let sendNotification: ReturnType<typeof vi.fn>
  let deleteSubscription: ReturnType<typeof vi.fn>
  let loadSubscriptions: ReturnType<typeof vi.fn>
  let deps: SendPushDeps

  beforeEach(() => {
    sendNotification = vi.fn()
    deleteSubscription = vi.fn().mockResolvedValue(undefined)
    loadSubscriptions = vi.fn().mockResolvedValue([sub1, sub2])
    deps = { loadSubscriptions, sendNotification, deleteSubscription }
  })

  it('sends to both subscriptions in order', async () => {
    sendNotification.mockResolvedValue(undefined)
    const { sendPushToUser } = await import('../../src/push.js')

    const payload: PushPayload = { title: 'Test', body: 'Hallo', url: '/recipe/1' }
    await sendPushToUser('user-1', payload, deps)

    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(sendNotification).toHaveBeenNthCalledWith(
      1,
      { endpoint: sub1.endpoint, keys: { p256dh: 'key1', auth: 'auth1' } },
      JSON.stringify(payload),
    )
    expect(sendNotification).toHaveBeenNthCalledWith(
      2,
      { endpoint: sub2.endpoint, keys: { p256dh: 'key2', auth: 'auth2' } },
      JSON.stringify(payload),
    )
  })

  it('prunes a 410 subscription and logs a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sendNotification
      .mockResolvedValueOnce(undefined) // sub1 succeeds
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 })) // sub2 fails with 410

    const { sendPushToUser } = await import('../../src/push.js')

    const payload: PushPayload = { title: 'Test', body: 'Pizza', url: '/recipe/5' }
    await sendPushToUser('user-2', payload, deps)

    // Both endpoints must have been attempted
    expect(sendNotification).toHaveBeenCalledTimes(2)

    // The 410 sub must be deleted
    expect(deleteSubscription).toHaveBeenCalledOnce()
    expect(deleteSubscription).toHaveBeenCalledWith(sub2.id)

    // console.warn must have been called with the status arg visible
    expect(warnSpy).toHaveBeenCalled()
    const warnArgs = warnSpy.mock.calls[0]
    // Second arg is an object with { endpoint, status }
    expect(warnArgs[1]).toMatchObject({ status: 410 })

    warnSpy.mockRestore()
  })

  it('does not prune a sub that fails with a non-terminal error', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('Server error'), { statusCode: 500 }))

    const { sendPushToUser } = await import('../../src/push.js')

    const payload: PushPayload = { title: 'Test', body: 'Suppe', url: '/' }
    await sendPushToUser('user-3', payload, deps)

    // Both attempted, none deleted
    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(deleteSubscription).not.toHaveBeenCalled()
  })
})
