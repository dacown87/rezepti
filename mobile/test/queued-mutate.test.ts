import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueueStore, QueuedMutation } from '@/offline/types';
import { MutationQueue } from '@/offline/mutation-queue';
import { queuedMutate, type MutationInput, type QueuedMutateDeps } from '@/offline/queued-mutate';

function makeStore(): QueueStore & { items: QueuedMutation[] } {
  const store = {
    items: [] as QueuedMutation[],
    async read(): Promise<QueuedMutation[]> { return [...store.items]; },
    async write(items: QueuedMutation[]): Promise<void> { store.items = [...items]; },
  };
  return store;
}

describe('queuedMutate', () => {
  let store: ReturnType<typeof makeStore>;
  let queue: MutationQueue;
  let opCounter: number;

  beforeEach(() => {
    store = makeStore();
    queue = new MutationQueue(store);
    opCounter = 1;
  });

  function makeNewId(): () => string {
    return () => `op-${opCounter++}`;
  }

  it('online success: sends mutation and returns queued=false', async () => {
    const send = vi.fn(async (_m: QueuedMutation) => new Response(null, { status: 200 }));
    const input: MutationInput = { endpoint: '/api/v1/planner', method: 'POST', body: { recipeId: 1 } };
    const deps: QueuedMutateDeps = { online: true, send, newId: makeNewId() };

    const result = await queuedMutate(queue, input, deps);

    expect(result).toEqual({ queued: false });
    expect(send).toHaveBeenCalledOnce();
    expect(await queue.size()).toBe(0);
  });

  it('offline: enqueues mutation without calling send', async () => {
    const send = vi.fn(async (_m: QueuedMutation) => new Response(null, { status: 200 }));
    const input: MutationInput = { endpoint: '/api/v1/planner', method: 'POST', body: { recipeId: 2 } };
    const deps: QueuedMutateDeps = { online: false, send, newId: makeNewId() };

    const result = await queuedMutate(queue, input, deps);

    expect(result).toEqual({ queued: true });
    expect(send).not.toHaveBeenCalled();
    expect(await queue.size()).toBe(1);
  });

  it('online retryable (503): enqueues mutation and returns queued=true', async () => {
    const send = vi.fn(async (_m: QueuedMutation) => new Response(null, { status: 503 }));
    const input: MutationInput = { endpoint: '/api/v1/shopping', method: 'PATCH', body: { checked: true } };
    const deps: QueuedMutateDeps = { online: true, send, newId: makeNewId() };

    const result = await queuedMutate(queue, input, deps);

    expect(result).toEqual({ queued: true });
    expect(await queue.size()).toBe(1);
  });

  it('online permanent failure (400): rejects with error and does NOT enqueue', async () => {
    const send = vi.fn(async (_m: QueuedMutation) => new Response('bad request', { status: 400 }));
    const input: MutationInput = { endpoint: '/api/v1/planner', method: 'DELETE' };
    const deps: QueuedMutateDeps = { online: true, send, newId: makeNewId() };

    await expect(queuedMutate(queue, input, deps)).rejects.toThrow('400');
    expect(await queue.size()).toBe(0);
  });

  it('POST body gets client_op_id injected', async () => {
    let capturedMutation: QueuedMutation | undefined;
    const send = vi.fn(async (m: QueuedMutation) => {
      capturedMutation = m;
      return new Response(null, { status: 201 });
    });
    const input: MutationInput = { endpoint: '/api/v1/planner', method: 'POST', body: { recipeId: 7 } };
    const deps: QueuedMutateDeps = { online: true, send, newId: () => 'op-5' };

    await queuedMutate(queue, input, deps);

    expect(capturedMutation?.body).toEqual({ recipeId: 7, client_op_id: 'op-5' });
  });
});
