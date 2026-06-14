import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { QueuedMutation } from '@/offline/types';
import { createIdbQueueStore } from '@/offline/idb-store';

const DB_NAME = 'recipedeck-offline';

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // accept blocked as "done"
  });
}

function makeMutation(opId: string): QueuedMutation {
  return {
    opId,
    endpoint: '/api/v1/planner',
    method: 'POST',
    body: { recipeId: 1 },
    createdAt: 1000,
    attempts: 0,
  };
}

describe('IdbQueueStore', () => {
  beforeEach(async () => {
    await deleteDb();
  });

  it('read returns empty array when nothing is stored', async () => {
    const store = createIdbQueueStore();
    const items = await store.read();
    expect(items).toEqual([]);
  });

  it('write then read round-trips items correctly', async () => {
    const store = createIdbQueueStore();
    const mutations = [makeMutation('op-1'), makeMutation('op-2')];
    await store.write(mutations);
    const read = await store.read();
    expect(read).toEqual(mutations);
  });
});
