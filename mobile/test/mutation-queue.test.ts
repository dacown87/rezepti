import { describe, it, expect, beforeEach } from 'vitest';
import type { QueueStore, QueuedMutation, SendOutcome } from '@/offline/types';
import { MutationQueue } from '@/offline/mutation-queue';

function makeStore(): QueueStore & { items: QueuedMutation[] } {
  const store = {
    items: [] as QueuedMutation[],
    async read(): Promise<QueuedMutation[]> { return [...store.items]; },
    async write(items: QueuedMutation[]): Promise<void> { store.items = [...items]; },
  };
  return store;
}

function makeMutation(overrides?: Partial<QueuedMutation>): QueuedMutation {
  return {
    opId: 'op-1',
    endpoint: '/api/v1/planner',
    method: 'POST',
    body: { recipeId: 1 },
    createdAt: Date.now(),
    attempts: 0,
    ...overrides,
  };
}

describe('MutationQueue', () => {
  let store: ReturnType<typeof makeStore>;
  let queue: MutationQueue;

  beforeEach(() => {
    store = makeStore();
    queue = new MutationQueue(store);
  });

  it('enqueue increases size correctly', async () => {
    expect(await queue.size()).toBe(0);
    await queue.enqueue(makeMutation({ opId: 'op-1' }));
    expect(await queue.size()).toBe(1);
    await queue.enqueue(makeMutation({ opId: 'op-2' }));
    expect(await queue.size()).toBe(2);
  });

  it('flush removes ok items and stops on retry, preserving FIFO order', async () => {
    await queue.enqueue(makeMutation({ opId: 'op-1' }));
    await queue.enqueue(makeMutation({ opId: 'op-2' }));

    // op-1: ok (removed), op-2: retry (keep and stop)
    const outcomes: SendOutcome[] = ['ok', 'retry'];
    let callCount = 0;
    const summary = await queue.flush(async (m) => {
      return outcomes[callCount++] as SendOutcome;
    });

    expect(summary).toEqual({ sent: 1, dropped: 0, remaining: 1 });
    expect(await queue.size()).toBe(1);
    const remaining = await queue.list();
    expect(remaining[0].opId).toBe('op-2');
  });

  it('flush drops permanently-failed items and removes them', async () => {
    await queue.enqueue(makeMutation({ opId: 'op-1' }));

    const summary = await queue.flush(async () => 'drop');

    expect(summary).toEqual({ sent: 0, dropped: 1, remaining: 0 });
    expect(await queue.size()).toBe(0);
  });

  it('flush on empty queue is a no-op', async () => {
    const send = async (_m: QueuedMutation): Promise<SendOutcome> => 'ok';
    const summary = await queue.flush(send);
    expect(summary).toEqual({ sent: 0, dropped: 0, remaining: 0 });
  });
});
