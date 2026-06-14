import { describe, it, expect, vi } from 'vitest';
import { subscribeToPush, unsubscribeFromPush, type SubscribeDeps, type UnsubscribeDeps } from '@/hooks/usePushSubscription';

// ---------------------------------------------------------------------------
// subscribeToPush
// ---------------------------------------------------------------------------

describe('subscribeToPush', () => {
  it('calls subscribe + POST and returns true when permission is granted', async () => {
    const mockSub = {
      endpoint: 'https://push.example.com/sub-abc',
      toJSON: () => ({ endpoint: 'https://push.example.com/sub-abc', keys: { auth: 'aaa', p256dh: 'bbb' } }),
    } as unknown as PushSubscription;

    const getSubscription = vi.fn(async () => null);
    const subscribe = vi.fn(async () => mockSub);
    const postSubscription = vi.fn(async () => new Response(null, { status: 201 }));

    const deps: SubscribeDeps = {
      registration: {
        pushManager: { getSubscription, subscribe },
      } as unknown as ServiceWorkerRegistration,
      vapidKey: 'dGVzdA', // valid base64url
      requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
      postSubscription,
    };

    const result = await subscribeToPush(deps);

    expect(result).toBe(true);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(postSubscription).toHaveBeenCalledOnce();
    expect(postSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example.com/sub-abc',
      keys: { auth: 'aaa', p256dh: 'bbb' },
    });
  });

  it('returns false and does not call subscribe or POST when permission is denied', async () => {
    const getSubscription = vi.fn(async () => null);
    const subscribe = vi.fn();
    const postSubscription = vi.fn();

    const deps: SubscribeDeps = {
      registration: {
        pushManager: { getSubscription, subscribe },
      } as unknown as ServiceWorkerRegistration,
      vapidKey: 'dGVzdA',
      requestPermission: vi.fn(async () => 'denied' as NotificationPermission),
      postSubscription,
    };

    const result = await subscribeToPush(deps);

    expect(result).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
    expect(postSubscription).not.toHaveBeenCalled();
  });

  it('reuses existing subscription and calls POST without subscribing again', async () => {
    const existingSub = {
      endpoint: 'https://push.example.com/existing',
      toJSON: () => ({ endpoint: 'https://push.example.com/existing', keys: { auth: 'x', p256dh: 'y' } }),
    } as unknown as PushSubscription;

    const getSubscription = vi.fn(async () => existingSub);
    const subscribe = vi.fn();
    const postSubscription = vi.fn(async () => new Response(null, { status: 200 }));

    const deps: SubscribeDeps = {
      registration: {
        pushManager: { getSubscription, subscribe },
      } as unknown as ServiceWorkerRegistration,
      vapidKey: 'dGVzdA',
      requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
      postSubscription,
    };

    const result = await subscribeToPush(deps);

    expect(result).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(postSubscription).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// unsubscribeFromPush
// ---------------------------------------------------------------------------

describe('unsubscribeFromPush', () => {
  it('unsubscribes and calls DELETE with the endpoint, returns true on ok response', async () => {
    const unsubscribe = vi.fn(async () => true);
    const mockSub = {
      endpoint: 'https://push.example.com/sub-abc',
      unsubscribe,
    };

    const getSubscription = vi.fn(async () => mockSub);
    const deleteSubscription = vi.fn(async (_endpoint: string) => new Response(null, { status: 204 }));

    const deps: UnsubscribeDeps = {
      registration: {
        pushManager: { getSubscription },
      } as unknown as ServiceWorkerRegistration,
      deleteSubscription,
    };

    const result = await unsubscribeFromPush(deps);

    expect(result).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(deleteSubscription).toHaveBeenCalledWith('https://push.example.com/sub-abc');
  });

  it('returns true immediately when there is no existing subscription', async () => {
    const getSubscription = vi.fn(async () => null);
    const deleteSubscription = vi.fn();

    const deps: UnsubscribeDeps = {
      registration: {
        pushManager: { getSubscription },
      } as unknown as ServiceWorkerRegistration,
      deleteSubscription,
    };

    const result = await unsubscribeFromPush(deps);

    expect(result).toBe(true);
    expect(deleteSubscription).not.toHaveBeenCalled();
  });
});
