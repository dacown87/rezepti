import type { MutationQueue } from './mutation-queue';
import type { QueuedMethod, QueuedMutation } from './types';
import { classifyResponse, classifyError } from './types';
import { registerBackgroundFlush } from './background-sync';

export interface MutationInput { endpoint: string; method: QueuedMethod; body?: unknown; }
export interface QueuedMutateDeps {
  online: boolean;
  send: (m: QueuedMutation) => Promise<Response>;
  newId: () => string;
}

function withOpId(input: MutationInput, opId: string): QueuedMutation {
  const body =
    input.body && typeof input.body === 'object'
      ? { ...(input.body as Record<string, unknown>), client_op_id: opId }
      : input.body;
  return { opId, endpoint: input.endpoint, method: input.method, body, createdAt: Date.now(), attempts: 0 };
}

export async function queuedMutate(
  queue: MutationQueue,
  input: MutationInput,
  deps: QueuedMutateDeps,
): Promise<{ queued: boolean }> {
  const mutation = withOpId(input, deps.newId());
  if (!deps.online) {
    await queue.enqueue(mutation);
    void registerBackgroundFlush();
    return { queued: true };
  }
  try {
    const res = await deps.send(mutation);
    const outcome = classifyResponse(res);
    if (outcome === 'ok') return { queued: false };
    if (outcome === 'retry') {
      await queue.enqueue(mutation);
      void registerBackgroundFlush();
      return { queued: true };
    }
    throw new Error(`Mutation failed permanently (${res.status})`);
  } catch (err) {
    if (classifyError(err) === 'retry') {
      await queue.enqueue(mutation);
      void registerBackgroundFlush();
      return { queued: true };
    }
    throw err;
  }
}
