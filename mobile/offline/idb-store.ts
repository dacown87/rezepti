import type { QueueStore, QueuedMutation } from './types';

const DB_NAME = 'recipedeck-offline';
const STORE = 'mutation-queue';
const KEY = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => {
          db.close();
          resolve(req.result);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

export function createIdbQueueStore(): QueueStore {
  return {
    async read(): Promise<QueuedMutation[]> {
      const value = await tx<QueuedMutation[] | undefined>('readonly', (s) => s.get(KEY));
      return value ?? [];
    },
    async write(items: QueuedMutation[]): Promise<void> {
      await tx('readwrite', (s) => s.put(items, KEY));
    },
  };
}
