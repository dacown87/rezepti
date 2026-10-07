import { MutationQueue, type FlushSummary } from './mutation-queue';
import { createIdbQueueStore } from './idb-store';
import { classifyResponse, classifyError, type QueuedMutation } from './types';
import { apiFetch } from '@/utils/api';
import { getAuthSession } from '@/utils/auth';

async function currentUserId(): Promise<string | null> {
  try {
    return (await getAuthSession())?.user.id ?? null;
  } catch {
    return null;
  }
}

export const offlineQueue = new MutationQueue(createIdbQueueStore(), currentUserId);

export async function sendQueuedMutation(m: QueuedMutation): Promise<Response> {
  const init: RequestInit = { method: m.method };
  if (m.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(m.body);
  }
  return apiFetch(m.endpoint, init);
}

export async function flushOnce(): Promise<FlushSummary> {
  return offlineQueue.flush(async (m) => {
    try {
      return classifyResponse(await sendQueuedMutation(m));
    } catch (err) {
      return classifyError(err);
    }
  });
}
