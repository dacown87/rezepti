# PWA Follow-up Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three deferred PWA follow-up slices — precache cap 6→5 MB, a persistent offline mutation queue (last-write-wins + idempotency) for Shopping/Planner, and Background Sync + Push notifications.

**Architecture:** Three sequenced phases, each independently shippable. Phase 1 is an isolated build-config change. Phase 2 adds a standalone, storage-agnostic mutation queue (dependency-injected store, tested in-memory; IndexedDB-backed on web) wrapping `apiFetch`, plus a server-side `client_op_id` idempotency key. Phase 3 adds a Service-Worker `sync` handler that wakes open clients to flush the queue, and a full Web Push path (VAPID, `push_subscriptions` table, `web-push` send on job completion).

**Tech Stack:** TypeScript, Expo Web (React), Workbox-bundled Service Worker (esbuild via `scripts/pwa/build-sw.ts`), Hono API, Drizzle ORM + Supabase Postgres, Vitest. Design source: `docs/superpowers/specs/2026-06-13-pwa-followups-design.md`.

**Conventions for this plan:**
- Mobile tests live under `mobile/test/`, run with `npm run test:mobile`.
- Root/server tests live under `test/`, run with `npm test -- --run --exclude="test/e2e/**"`.
- New mobile tests MUST NOT import `react-test-renderer`; run `npm run test:mobile:rntl-guard` after adding mobile tests.
- Commit after every task. Branch base is `main` (PWA Phase 6 already merged via PR #8).

---

## Phase 1 — Precache Cap 6→5 MB

### Task 1: Reduce the Expo web JS bundle below 5 MB

**Files:**
- Investigate: `public/_expo/static/js/web/*.js` (build output)
- Modify (lazy-load candidates): `mobile/app/(tabs)/planner.tsx` (dnd-kit), `mobile/app/(tabs)/scanner.tsx` (QR libs), PDF-export module, vision/camera paths
- Reference: `CLAUDE.md` "Strict performance hardening" (bundle baselines)

- [ ] **Step 1: Capture the current bundle baseline**

Run: `npm run build:mobile && npm run perf:bundle`
Expected: raw + gzip JS totals printed; raw JS total ≈ 5.26 MB across ~6 chunks. Record the per-chunk sizes — the largest chunks are the lazy-load targets.

- [ ] **Step 2: Lazy-load the heaviest non-initial-route modules**

For each large chunk that is NOT needed for first paint (planner drag-and-drop, scanner QR, PDF export), convert its static import to a dynamic import behind the route/interaction that needs it. Example pattern for a heavy component (apply per identified module — do NOT lazy-load anything on the initial `/` or app-shell path):

```tsx
import { lazy, Suspense } from 'react';
const PlannerBoard = lazy(() => import('@/components/PlannerBoard'));
// ...render:
<Suspense fallback={<ActivityIndicator />}>
  <PlannerBoard /* …props… */ />
</Suspense>
```

Do not regress the route-aware app-shell LCP in `mobile/app/+html.tsx` (Phase 4c). Only split modules below the fold / behind navigation.

- [ ] **Step 3: Re-measure after each split**

Run: `npm run build:mobile && npm run perf:bundle`
Expected: raw JS total strictly below `5 * 1024 * 1024` bytes (5 MB). If still above, split the next-largest chunk and repeat.

- [ ] **Step 4: Run perf validation for LCP/shell safety**

Run: `npm run perf:lighthouse:compare && npm run perf:validate`
Expected: no new budget findings; readiness not regressed.

- [ ] **Step 5: Commit**

```bash
git add mobile/ public/
git commit -m "perf(pwa): lazy-load below-fold modules to bring web JS bundle under 5 MB"
```

### Task 2: Lower the service-worker precache cap to 5 MB

**Files:**
- Modify: `scripts/pwa/build-sw.ts:41` (constant), `scripts/pwa/build-sw.ts:67-72` (throw message), `scripts/pwa/build-sw.ts:37-40` (comment)
- Modify: `TODO.md` (close the cap line)

- [ ] **Step 1: Lower the constant and parameterize the throw message**

In `scripts/pwa/build-sw.ts`, replace the constant + comment (lines 37-41):

```ts
// Cap total precached JS. Content-hashed Expo chunks are cached forever, so an
// oversized precache wastes storage and slows install. Keep this at 5 MB.
const JS_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB
```

Replace the hard-coded "6 MB" throw (lines 67-72) with a message derived from the constant:

```ts
  if (totalJsBytes > JS_SIZE_LIMIT_BYTES) {
    const limitMb = (JS_SIZE_LIMIT_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(
      `[build-sw] Precached JS exceeds ${limitMb} MB limit: ${(totalJsBytes / 1024 / 1024).toFixed(2)} MB ` +
      `(${totalJsBytes} bytes). Reduce bundle size before shipping the service worker.`,
    );
  }
```

- [ ] **Step 2: Verify the builder passes with the reduced bundle**

Run: `npx tsx scripts/pwa/build-sw.ts`
Expected: prints manifest + `Done → public/sw.js`, NO throw. (If it throws, Task 1 is incomplete — return to it.)

- [ ] **Step 3: Close the TODO entry**

In `TODO.md`, change the line `- [ ] **PWA: Precache-Cap von 6 MB zurueck auf 5 MB** …` to `- [x]` and append ` — erledigt 2026-06-13 (Cap auf 5 MB, Bundle <5 MB).`

- [ ] **Step 4: Commit**

```bash
git add scripts/pwa/build-sw.ts TODO.md public/sw.js
git commit -m "build(pwa): restore precache cap to 5 MB now that bundle is under limit"
```

---

## Phase 2 — Offline Write Path (Mutation Queue + Idempotency)

### File structure (new)

| File | Responsibility |
|------|----------------|
| `mobile/offline/types.ts` | `QueuedMutation`, `QueueStore`, `SendOutcome` types |
| `mobile/offline/idb-store.ts` | IndexedDB-backed `QueueStore` (web runtime default) |
| `mobile/offline/mutation-queue.ts` | `MutationQueue` class: enqueue/list/size/flush (store-agnostic) |
| `mobile/offline/queued-mutate.ts` | `queuedMutate()` — network-first, enqueue-on-failure wrapper around `apiFetch` |
| `mobile/offline/network-status.ts` | `onReconnect()` subscription over `online`/foreground events |
| `mobile/hooks/useOfflineQueue.ts` | pending count + manual flush trigger for UI |

### Task 3: Queue types and the store contract

**Files:**
- Create: `mobile/offline/types.ts`
- Test: `mobile/test/offline-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { QueuedMutation } from '@/offline/types';
import { isRetryableStatus } from '@/offline/types';

describe('offline types', () => {
  it('treats 5xx and 429/408 as retryable, other 4xx as permanent', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('QueuedMutation shape compiles', () => {
    const m: QueuedMutation = {
      opId: 'x', endpoint: '/api/v1/planner', method: 'POST',
      body: { recipeId: 1 }, createdAt: 0, attempts: 0,
    };
    expect(m.method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- offline-types`
Expected: FAIL — cannot resolve `@/offline/types`.

- [ ] **Step 3: Create the types module**

```ts
// mobile/offline/types.ts
export type QueuedMethod = 'POST' | 'PATCH' | 'DELETE';

export interface QueuedMutation {
  /** Client-generated UUID. Sent as `client_op_id` for POST to dedupe server-side. */
  opId: string;
  endpoint: string;
  method: QueuedMethod;
  body?: unknown;
  createdAt: number;
  attempts: number;
}

/** Result of attempting to send one queued mutation. */
export type SendOutcome = 'ok' | 'retry' | 'drop';

export interface QueueStore {
  read(): Promise<QueuedMutation[]>;
  write(items: QueuedMutation[]): Promise<void>;
}

/** Retryable: transient server/network conditions. Everything else is permanent. */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- offline-types`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/offline/types.ts mobile/test/offline-types.test.ts
git commit -m "feat(offline): queue types and retryable-status classifier"
```

### Task 4: MutationQueue (store-agnostic core)

**Files:**
- Create: `mobile/offline/mutation-queue.ts`
- Test: `mobile/test/mutation-queue.test.ts`

- [ ] **Step 1: Write the failing test (in-memory store, no IndexedDB needed)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MutationQueue } from '@/offline/mutation-queue';
import type { QueueStore, QueuedMutation, SendOutcome } from '@/offline/types';

function memStore(): QueueStore {
  let items: QueuedMutation[] = [];
  return {
    read: async () => items.slice(),
    write: async (next) => { items = next.slice(); },
  };
}

const base = { endpoint: '/api/v1/planner', method: 'POST' as const, body: {}, createdAt: 1, attempts: 0 };

describe('MutationQueue', () => {
  let store: QueueStore;
  let queue: MutationQueue;
  beforeEach(() => { store = memStore(); queue = new MutationQueue(store); });

  it('enqueues and reports size', async () => {
    await queue.enqueue({ ...base, opId: 'a' });
    await queue.enqueue({ ...base, opId: 'b' });
    expect(await queue.size()).toBe(2);
  });

  it('flush removes mutations that send ok, keeps retryable ones in FIFO order', async () => {
    await queue.enqueue({ ...base, opId: 'a' });
    await queue.enqueue({ ...base, opId: 'b' });
    const seen: string[] = [];
    const summary = await queue.flush(async (m): Promise<SendOutcome> => {
      seen.push(m.opId);
      return m.opId === 'a' ? 'ok' : 'retry';
    });
    expect(seen).toEqual(['a', 'b']);
    expect(summary).toEqual({ sent: 1, dropped: 0, remaining: 1 });
    expect((await queue.list()).map((m) => m.opId)).toEqual(['b']);
  });

  it('flush drops permanently-failed mutations', async () => {
    await queue.enqueue({ ...base, opId: 'a' });
    const summary = await queue.flush(async () => 'drop');
    expect(summary).toEqual({ sent: 0, dropped: 1, remaining: 0 });
    expect(await queue.size()).toBe(0);
  });

  it('flush is a no-op on an empty queue', async () => {
    const summary = await queue.flush(async () => 'ok');
    expect(summary).toEqual({ sent: 0, dropped: 0, remaining: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- mutation-queue`
Expected: FAIL — cannot resolve `@/offline/mutation-queue`.

- [ ] **Step 3: Implement MutationQueue**

```ts
// mobile/offline/mutation-queue.ts
import type { QueueStore, QueuedMutation, SendOutcome } from './types';

export interface FlushSummary {
  sent: number;
  dropped: number;
  remaining: number;
}

export class MutationQueue {
  constructor(private readonly store: QueueStore) {}

  async list(): Promise<QueuedMutation[]> {
    return this.store.read();
  }

  async size(): Promise<number> {
    return (await this.store.read()).length;
  }

  async enqueue(mutation: QueuedMutation): Promise<void> {
    const items = await this.store.read();
    items.push(mutation);
    await this.store.write(items);
  }

  /**
   * Flush FIFO. `send` reports the outcome per mutation:
   *  - 'ok'    → remove from queue
   *  - 'drop'  → remove from queue (permanent failure)
   *  - 'retry' → keep, and STOP draining (preserve order; try again next flush)
   */
  async flush(send: (m: QueuedMutation) => Promise<SendOutcome>): Promise<FlushSummary> {
    let items = await this.store.read();
    let sent = 0;
    let dropped = 0;

    while (items.length > 0) {
      const head = items[0];
      const outcome = await send(head);
      if (outcome === 'retry') break;
      if (outcome === 'ok') sent += 1;
      else dropped += 1;
      items = items.slice(1);
      await this.store.write(items);
    }

    return { sent, dropped, remaining: items.length };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- mutation-queue`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/offline/mutation-queue.ts mobile/test/mutation-queue.test.ts
git commit -m "feat(offline): store-agnostic MutationQueue with FIFO flush"
```

### Task 5: IndexedDB-backed QueueStore (web runtime)

**Files:**
- Create: `mobile/offline/idb-store.ts`
- Test: `mobile/test/idb-store.test.ts`

- [ ] **Step 1: Write the failing test (fake IndexedDB)**

This test uses `fake-indexeddb` to exercise the real IDB code path in Node. Install it first as a dev dependency in the mobile workspace:

Run: `npm --prefix mobile install -D fake-indexeddb`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { createIdbQueueStore } from '@/offline/idb-store';

describe('idb queue store', () => {
  beforeEach(async () => {
    // fresh DB per test
    indexedDB.deleteDatabase('recipedeck-offline');
  });

  it('round-trips an empty list', async () => {
    const store = createIdbQueueStore();
    expect(await store.read()).toEqual([]);
  });

  it('persists writes and reads them back', async () => {
    const store = createIdbQueueStore();
    await store.write([
      { opId: 'a', endpoint: '/x', method: 'POST', body: { n: 1 }, createdAt: 1, attempts: 0 },
    ]);
    const back = await store.read();
    expect(back).toHaveLength(1);
    expect(back[0].opId).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- idb-store`
Expected: FAIL — cannot resolve `@/offline/idb-store`.

- [ ] **Step 3: Implement the IDB store**

```ts
// mobile/offline/idb-store.ts
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
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- idb-store`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/offline/idb-store.ts mobile/test/idb-store.test.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(offline): IndexedDB-backed queue store with fake-indexeddb test"
```

### Task 6: queuedMutate — network-first wrapper

**Files:**
- Create: `mobile/offline/queued-mutate.ts`
- Test: `mobile/test/queued-mutate.test.ts`

- [ ] **Step 1: Write the failing test (inject queue + fetch)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queuedMutate } from '@/offline/queued-mutate';
import { MutationQueue } from '@/offline/mutation-queue';
import type { QueueStore, QueuedMutation } from '@/offline/types';

function memStore(): QueueStore {
  let items: QueuedMutation[] = [];
  return { read: async () => items.slice(), write: async (n) => { items = n.slice(); } };
}

function res(status: number): Response {
  return new Response(status === 204 ? null : JSON.stringify({ id: 1 }), { status });
}

describe('queuedMutate', () => {
  let queue: MutationQueue;
  beforeEach(() => { queue = new MutationQueue(memStore()); });

  it('sends immediately when online and succeeds → not queued', async () => {
    const send = vi.fn(async () => res(201));
    const out = await queuedMutate(queue, { endpoint: '/api/v1/planner', method: 'POST', body: { recipeId: 1 } }, { online: true, send, newId: () => 'op-1' });
    expect(out.queued).toBe(false);
    expect(send).toHaveBeenCalledOnce();
    expect(await queue.size()).toBe(0);
  });

  it('queues when offline and does not call send', async () => {
    const send = vi.fn(async () => res(201));
    const out = await queuedMutate(queue, { endpoint: '/api/v1/planner', method: 'POST', body: {} }, { online: false, send, newId: () => 'op-2' });
    expect(out.queued).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(await queue.size()).toBe(1);
  });

  it('queues when online but the request fails with a retryable status', async () => {
    const send = vi.fn(async () => res(503));
    const out = await queuedMutate(queue, { endpoint: '/api/v1/planner', method: 'POST', body: {} }, { online: true, send, newId: () => 'op-3' });
    expect(out.queued).toBe(true);
    expect(await queue.size()).toBe(1);
  });

  it('throws on a permanent (non-retryable) failure and does not queue', async () => {
    const send = vi.fn(async () => res(400));
    await expect(
      queuedMutate(queue, { endpoint: '/api/v1/planner', method: 'POST', body: {} }, { online: true, send, newId: () => 'op-4' }),
    ).rejects.toBeTruthy();
    expect(await queue.size()).toBe(0);
  });

  it('injects client_op_id into POST bodies for idempotency', async () => {
    let capturedBody: any;
    const send = vi.fn(async (m: QueuedMutation) => { capturedBody = m.body; return res(201); });
    await queuedMutate(queue, { endpoint: '/api/v1/planner', method: 'POST', body: { recipeId: 7 } }, { online: true, send, newId: () => 'op-5' });
    expect(capturedBody).toEqual({ recipeId: 7, client_op_id: 'op-5' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- queued-mutate`
Expected: FAIL — cannot resolve `@/offline/queued-mutate`.

- [ ] **Step 3: Implement queuedMutate**

```ts
// mobile/offline/queued-mutate.ts
import type { MutationQueue } from './mutation-queue';
import type { QueuedMethod, QueuedMutation } from './types';
import { isRetryableStatus } from './types';

export interface MutationInput {
  endpoint: string;
  method: QueuedMethod;
  body?: unknown;
}

export interface QueuedMutateDeps {
  online: boolean;
  /** Sends one mutation; resolves with the HTTP Response (or rejects on network error). */
  send: (m: QueuedMutation) => Promise<Response>;
  /** UUID factory (crypto.randomUUID in production). */
  newId: () => string;
}

function withOpId(input: MutationInput, opId: string): QueuedMutation {
  const body =
    input.method === 'POST' && input.body && typeof input.body === 'object'
      ? { ...(input.body as Record<string, unknown>), client_op_id: opId }
      : input.body;
  return { opId, endpoint: input.endpoint, method: input.method, body, createdAt: Date.now(), attempts: 0 };
}

/**
 * Network-first mutation. On success → not queued. On offline / network error /
 * retryable status → enqueued for later flush. On permanent failure → throws (caller
 * rolls back its optimistic update). POST bodies carry `client_op_id` for server dedupe.
 */
export async function queuedMutate(
  queue: MutationQueue,
  input: MutationInput,
  deps: QueuedMutateDeps,
): Promise<{ queued: boolean }> {
  const mutation = withOpId(input, deps.newId());

  if (!deps.online) {
    await queue.enqueue(mutation);
    return { queued: true };
  }

  try {
    const res = await deps.send(mutation);
    if (res.ok) return { queued: false };
    if (isRetryableStatus(res.status)) {
      await queue.enqueue(mutation);
      return { queued: true };
    }
    throw new Error(`Mutation failed permanently (${res.status})`);
  } catch (err) {
    // Network error (fetch rejected) → treat as offline, enqueue.
    if (err instanceof TypeError) {
      await queue.enqueue(mutation);
      return { queued: true };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- queued-mutate`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/offline/queued-mutate.ts mobile/test/queued-mutate.test.ts
git commit -m "feat(offline): queuedMutate network-first wrapper with op-id idempotency"
```

### Task 7: Server idempotency — `client_op_id` migration + route dedupe

**Files:**
- Create: `supabase/migrations/20260613120000_offline_idempotency_keys.sql`
- Modify: `src/schema.ts:52-81` (add `clientOpId` columns + unique indexes)
- Modify: `src/db-react.ts:733` (`addToShoppingList`), `src/db-react.ts:816` (`addRecipeToMealPlan`)
- Modify: `src/routes/planner.ts:34` (shopping POST), `src/routes/planner.ts:221` (planner POST)
- Test: `test/planner-idempotency.test.ts`

- [ ] **Step 1: Write the failing server test**

```ts
import { describe, it, expect } from 'vitest';
// Reuse the existing planner-routes test harness pattern (in-memory / test DB).
// See test/planner-routes.test.ts for the existing app + auth-header helpers.
import { makeTestApp, authHeader } from './helpers/planner-test-harness';

describe('planner POST idempotency', () => {
  it('a repeated POST with the same client_op_id creates exactly one meal-plan row', async () => {
    const app = await makeTestApp();
    const body = { recipeId: 1, dayOfWeek: 2, weekStart: 1700000000, client_op_id: 'dup-1' };
    const r1 = await app.request('/api/v1/planner', { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
    const r2 = await app.request('/api/v1/planner', { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const id1 = (await r1.json()).id;
    const id2 = (await r2.json()).id;
    expect(id2).toBe(id1); // same row returned, not a duplicate
  });
});
```

> Note: `test/planner-routes.test.ts` already exists. If it does not expose a reusable harness, mirror its setup inline in this file instead of importing `./helpers/planner-test-harness`. Do not invent a harness module that does not exist — copy the existing pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run planner-idempotency`
Expected: FAIL — `client_op_id` ignored, two distinct ids returned.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260613120000_offline_idempotency_keys.sql
-- Offline mutation queue: dedupe retried POSTs via a client-generated op id.
ALTER TABLE public.shopping_list ADD COLUMN IF NOT EXISTS client_op_id uuid;
ALTER TABLE public.meal_plan     ADD COLUMN IF NOT EXISTS client_op_id uuid;

-- One row per (household, client_op_id). NULL op-ids are allowed and not deduped.
CREATE UNIQUE INDEX IF NOT EXISTS shopping_list_household_opid_uidx
  ON public.shopping_list (household_id, client_op_id)
  WHERE client_op_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_household_opid_uidx
  ON public.meal_plan (household_id, client_op_id)
  WHERE client_op_id IS NOT NULL;
```

- [ ] **Step 4: Add the Drizzle columns + indexes**

In `src/schema.ts`, add to `shoppingList` columns: `clientOpId: uuid("client_op_id"),` and to its index array:
```ts
  uniqueIndex("shopping_list_household_opid_uidx")
    .on(t.householdId, t.clientOpId)
    .where(sql`${t.clientOpId} IS NOT NULL`),
```
Do the same for `mealPlan`: add `clientOpId: uuid("client_op_id"),` and:
```ts
  uniqueIndex("meal_plan_household_opid_uidx")
    .on(t.householdId, t.clientOpId)
    .where(sql`${t.clientOpId} IS NOT NULL`),
```
Add `uuid` and `sql` to imports if not already present (both already imported in this file).

- [ ] **Step 5: Thread `clientOpId` through the db helpers**

In `src/db-react.ts`, extend `addRecipeToMealPlan` (line 816) to accept and dedupe on the op id:

```ts
export async function addRecipeToMealPlan(
  householdId: string, userId: string, recipeId: number,
  dayOfWeek: number, weekStart: number, clientOpId?: string | null,
) {
  const db = getDb();
  const rows = await db
    .insert(mealPlan)
    .values({ householdId, userId, recipeId, dayOfWeek, weekStart, clientOpId: clientOpId ?? null })
    .onConflictDoNothing({ target: [mealPlan.householdId, mealPlan.clientOpId] })
    .returning({ id: mealPlan.id });
  if (rows.length > 0) return rows[0];
  // Conflict (duplicate op id) — return the existing row's id.
  const existing = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(and(eq(mealPlan.householdId, householdId), eq(mealPlan.clientOpId, clientOpId!)))
    .limit(1);
  return existing[0];
}
```

For `addToShoppingList` (line 733): add a `clientOpId?: string | null` parameter, pass `clientOpId: clientOpId ?? null` into `.values(...)`. The existing name-based `onConflictDoNothing` already prevents duplicates; the op-id column is additive. Leave the existing conflict target as-is.

- [ ] **Step 6: Read `client_op_id` in the routes**

In `src/routes/planner.ts` planner POST (line 221), read and forward the key:
```ts
    const { recipeId, dayOfWeek, weekStart, client_op_id } = await c.req.json();
    // …existing validation…
    const result = await addRecipeToMealPlan(auth.activeHouseholdId, auth.userId, recipeId, dayOfWeek, weekStart, client_op_id ?? null);
```
In shopping POST (line 42), destructure `client_op_id` from the body and pass it as the new trailing arg to `addToShoppingList(...)`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- --run planner-idempotency`
Expected: PASS — `id2 === id1`.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add supabase/migrations/20260613120000_offline_idempotency_keys.sql src/schema.ts src/db-react.ts src/routes/planner.ts test/planner-idempotency.test.ts
git commit -m "feat(api): client_op_id idempotency for shopping/planner POSTs"
```

### Task 8: Network-status helper + useOfflineQueue hook

**Files:**
- Create: `mobile/offline/network-status.ts`
- Create: `mobile/hooks/useOfflineQueue.ts`
- Create: `mobile/offline/queue-singleton.ts` (wires the real IDB store + crypto.randomUUID + apiFetch)
- Test: `mobile/test/network-status.test.ts`

- [ ] **Step 1: Write the failing test for network-status**

```ts
import { describe, it, expect, vi } from 'vitest';
import { onReconnect } from '@/offline/network-status';

describe('onReconnect', () => {
  it('invokes the callback on an online event and unsubscribes cleanly', () => {
    const cb = vi.fn();
    const off = onReconnect(cb);
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledOnce();
    off();
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledOnce(); // not called again after unsubscribe
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- network-status`
Expected: FAIL — cannot resolve `@/offline/network-status`.

- [ ] **Step 3: Implement network-status**

```ts
// mobile/offline/network-status.ts
/** Calls `cb` whenever the browser regains connectivity or the tab is refocused. */
export function onReconnect(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onlineHandler = () => cb();
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) cb();
  };
  window.addEventListener('online', onlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  return () => {
    window.removeEventListener('online', onlineHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);
  };
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- network-status`
Expected: PASS (1 test).

- [ ] **Step 5: Create the queue singleton + send adapter (no test — thin wiring)**

```ts
// mobile/offline/queue-singleton.ts
import { MutationQueue } from './mutation-queue';
import { createIdbQueueStore } from './idb-store';
import type { QueuedMutation } from './types';
import { apiFetch } from '@/utils/api';

export const offlineQueue = new MutationQueue(createIdbQueueStore());

/** Sends one queued mutation via the authenticated apiFetch. */
export async function sendQueuedMutation(m: QueuedMutation): Promise<Response> {
  const init: RequestInit = { method: m.method };
  if (m.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(m.body);
  }
  return apiFetch(m.endpoint, init);
}

/** Classifies a send into the queue's SendOutcome. */
export async function flushOnce(): Promise<void> {
  const { isRetryableStatus } = await import('./types');
  await offlineQueue.flush(async (m) => {
    try {
      const res = await sendQueuedMutation(m);
      if (res.ok) return 'ok';
      return isRetryableStatus(res.status) ? 'retry' : 'drop';
    } catch (err) {
      return err instanceof TypeError ? 'retry' : 'drop';
    }
  });
}
```

- [ ] **Step 6: Implement the useOfflineQueue hook**

```ts
// mobile/hooks/useOfflineQueue.ts
import { useEffect, useState, useCallback } from 'react';
import { offlineQueue, flushOnce } from '@/offline/queue-singleton';
import { onReconnect, isOnline } from '@/offline/network-status';

export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(isOnline());

  const refresh = useCallback(async () => {
    setPending(await offlineQueue.size());
    setOnline(isOnline());
  }, []);

  const flush = useCallback(async () => {
    await flushOnce();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const off = onReconnect(() => { void flush(); });
    return off;
  }, [refresh, flush]);

  return { pending, online, flush, refresh };
}
```

- [ ] **Step 7: Run the full offline test set + type-check**

Run: `npm run test:mobile -- offline && npm run mobile:typecheck`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/offline/network-status.ts mobile/offline/queue-singleton.ts mobile/hooks/useOfflineQueue.ts mobile/test/network-status.test.ts
git commit -m "feat(offline): network-status helper, queue singleton, useOfflineQueue hook"
```

### Task 9: Wire Shopping + Planner screens to the queue and add the sync indicator

**Files:**
- Modify: `mobile/app/(tabs)/shopping.tsx:53-60` (`addManualItem`), `:33-41` (`toggleItem`/`deleteItem`)
- Modify: `mobile/app/(tabs)/planner.tsx` (add/delete handlers)
- Create: `mobile/components/OfflineQueueBanner.tsx`
- Test: `mobile/test/offline-queue-banner.test.tsx`

- [ ] **Step 1: Write the failing banner test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/testing-library-rn-real';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';

describe('OfflineQueueBanner', () => {
  it('shows nothing when online and queue is empty', () => {
    render(<OfflineQueueBanner pending={0} online={true} />);
    expect(screen.queryByText(/synchronisiert|offline/i)).toBeNull();
  });

  it('shows pending count when there are queued changes', () => {
    render(<OfflineQueueBanner pending={3} online={true} />);
    expect(screen.getByText(/3 Änderungen werden synchronisiert/i)).toBeTruthy();
  });

  it('shows an offline notice when offline', () => {
    render(<OfflineQueueBanner pending={0} online={false} />);
    expect(screen.getByText(/offline/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- offline-queue-banner`
Expected: FAIL — cannot resolve `@/components/OfflineQueueBanner`.

- [ ] **Step 3: Implement the banner**

```tsx
// mobile/components/OfflineQueueBanner.tsx
import { View, Text } from 'react-native';

export function OfflineQueueBanner({ pending, online }: { pending: number; online: boolean }) {
  if (online && pending === 0) return null;
  const message = !online
    ? 'Du bist offline. Änderungen werden gespeichert und später synchronisiert.'
    : `${pending} Änderung${pending === 1 ? '' : 'en'} ${pending === 1 ? 'wird' : 'werden'} synchronisiert…`;
  return (
    <View accessibilityRole="alert" style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FEF3C7' }}>
      <Text style={{ fontSize: 12, color: '#92400E' }}>{message}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- offline-queue-banner`
Expected: PASS (3 tests).

- [ ] **Step 5: Route shopping mutations through the queue**

In `mobile/app/(tabs)/shopping.tsx`, replace the bodies of `addManualItem`, `toggleItem`, and `deleteItem` so they go through `queuedMutate` + the singleton. Example for `addManualItem`:

```tsx
import { queuedMutate } from '@/offline/queued-mutate';
import { offlineQueue, sendQueuedMutation } from '@/offline/queue-singleton';
import { isOnline } from '@/offline/network-status';

async function addManualItem(name: string): Promise<void> {
  await queuedMutate(
    offlineQueue,
    { endpoint: '/api/v1/shopping', method: 'POST', body: { canonicalName: name, recipeId: null } },
    { online: isOnline(), send: sendQueuedMutation, newId: () => crypto.randomUUID() },
  );
}
```

`toggleItem(id)` → `queuedMutate(offlineQueue, { endpoint: \`/api/v1/shopping/${id}\`, method: 'PATCH' }, …)`.
`deleteItem(id)` → `queuedMutate(offlineQueue, { endpoint: \`/api/v1/shopping/${id}\`, method: 'DELETE' }, …)`.
The existing optimistic-update + rollback logic in the component stays. A thrown error (permanent failure) still triggers the existing rollback path. A `{ queued: true }` result means it succeeded optimistically.

- [ ] **Step 6: Route planner add/delete through the queue (same pattern)**

In `mobile/app/(tabs)/planner.tsx`, wrap the add (`POST /api/v1/planner`) and delete (`DELETE /api/v1/planner/:id`) calls in `queuedMutate` the same way. Keep the existing optimistic `setMealPlan` updates and rollback.

- [ ] **Step 7: Mount the banner + hook in both screens**

In each screen, call `const { pending, online } = useOfflineQueue();` and render `<OfflineQueueBanner pending={pending} online={online} />` directly under the `SafeAreaView` header.

- [ ] **Step 8: Run mobile tests + guard + type-check**

Run: `npm run test:mobile && npm run test:mobile:rntl-guard && npm run mobile:typecheck`
Expected: all PASS; guard reports no new `react-test-renderer` imports.

- [ ] **Step 9: Commit**

```bash
git add mobile/app/\(tabs\)/shopping.tsx mobile/app/\(tabs\)/planner.tsx mobile/components/OfflineQueueBanner.tsx mobile/test/offline-queue-banner.test.tsx
git commit -m "feat(offline): route shopping/planner mutations through the queue + sync banner"
```

---

## Phase 3 — Background Sync + Push

### Task 10: Service-Worker `sync` handler that wakes clients to flush

**Files:**
- Modify: `mobile/sw/sw.ts:121-160` (add a `sync` listener; extend the message handler)
- Modify: `mobile/offline/queued-mutate.ts` (register a sync after enqueue, web only)
- Create: `mobile/offline/background-sync.ts`
- Test: `mobile/test/background-sync.test.ts`

- [ ] **Step 1: Write the failing test for the sync-registration helper**

```ts
import { describe, it, expect, vi } from 'vitest';
import { registerBackgroundFlush } from '@/offline/background-sync';

describe('registerBackgroundFlush', () => {
  it('registers the flush-mutations sync tag when Background Sync is available', async () => {
    const register = vi.fn(async () => {});
    const reg = { sync: { register } } as unknown as ServiceWorkerRegistration;
    await registerBackgroundFlush({ ready: Promise.resolve(reg) } as unknown as ServiceWorkerContainer);
    expect(register).toHaveBeenCalledWith('flush-mutations');
  });

  it('no-ops without throwing when Background Sync is unsupported', async () => {
    const reg = {} as ServiceWorkerRegistration; // no .sync
    await expect(
      registerBackgroundFlush({ ready: Promise.resolve(reg) } as unknown as ServiceWorkerContainer),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- background-sync`
Expected: FAIL — cannot resolve `@/offline/background-sync`.

- [ ] **Step 3: Implement the registration helper**

```ts
// mobile/offline/background-sync.ts
const SYNC_TAG = 'flush-mutations';

/** Registers a one-off Background Sync so the SW can wake the page to flush the queue. */
export async function registerBackgroundFlush(container?: ServiceWorkerContainer): Promise<void> {
  const sw = container ?? (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  if (!sw) return;
  try {
    const reg = await sw.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    if (!sync) return; // Background Sync unsupported (e.g. Safari) — online listener covers it.
    await sync.register(SYNC_TAG);
  } catch {
    // Best-effort — the foreground online listener is the reliable fallback.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- background-sync`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the `sync` listener to the SW + a FLUSH_QUEUE broadcast**

In `mobile/sw/sw.ts`, after the `message` listener, add:

```ts
// ---------------------------------------------------------------------------
// Background Sync — the SW cannot make authenticated requests (the auth token
// lives in the page's Supabase session), so on a sync it wakes all open clients
// and asks them to flush the queue. If no client is open the flush is retried by
// the browser on the next sync opportunity.
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event: Event & { tag?: string; waitUntil(p: Promise<unknown>): void }) => {
  if (event.tag !== 'flush-mutations') return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'FLUSH_QUEUE' });
    }),
  );
});
```

- [ ] **Step 6: Register a sync after every offline enqueue**

In `mobile/offline/queued-mutate.ts`, after each `await queue.enqueue(mutation)` call, fire-and-forget a background-sync registration:

```ts
import { registerBackgroundFlush } from './background-sync';
// …after enqueue:
await queue.enqueue(mutation);
void registerBackgroundFlush();
return { queued: true };
```

Update the existing `queued-mutate.test.ts` to mock/ignore this — the import is side-effect-free and `registerBackgroundFlush` no-ops without `navigator.serviceWorker`, so tests stay green. Verify.

- [ ] **Step 7: Have the page flush on FLUSH_QUEUE**

In `mobile/utils/query-client.ts` `postToServiceWorker` area is for outbound. Add an inbound listener in the app bootstrap (where `startAuthQueryCacheWatch` is wired — `mobile/app/_layout.tsx`). Add:

```ts
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'FLUSH_QUEUE') void import('@/offline/queue-singleton').then((m) => m.flushOnce());
  });
}
```

- [ ] **Step 8: Rebuild the SW and run the mobile suite**

Run: `npx tsx scripts/pwa/build-sw.ts && npm run test:mobile && npm run mobile:typecheck`
Expected: SW builds; tests PASS; no type errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/sw/sw.ts mobile/offline/background-sync.ts mobile/offline/queued-mutate.ts mobile/app/_layout.tsx mobile/test/background-sync.test.ts public/sw.js
git commit -m "feat(pwa): background sync wakes clients to flush the offline queue"
```

### Task 11: `push_subscriptions` table + migration

**Files:**
- Create: `supabase/migrations/20260613130000_push_subscriptions.sql`
- Modify: `src/schema.ts` (add `pushSubscriptions` table + types)
- Test: covered by Task 13's route test (schema verified there)

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260613130000_push_subscriptions.sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          serial PRIMARY KEY,
  user_id     uuid NOT NULL,
  endpoint    text NOT NULL,
  keys        text NOT NULL,            -- JSON { p256dh, auth }
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner-only: a user can only see/modify their own subscriptions.
CREATE POLICY push_subscriptions_owner_select ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY push_subscriptions_owner_modify ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Add the Drizzle table**

In `src/schema.ts`, add:
```ts
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  keys: text("keys").notNull(), // JSON { p256dh, auth }
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("push_subscriptions_user_endpoint_uidx").on(t.userId, t.endpoint),
  index("push_subscriptions_user_idx").on(t.userId),
]);
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add supabase/migrations/20260613130000_push_subscriptions.sql src/schema.ts
git commit -m "feat(push): push_subscriptions table with owner-only RLS"
```

### Task 12: web-push dependency + server send helper (VAPID)

**Files:**
- Modify: root `package.json` (add `web-push`)
- Create: `src/push.ts` (VAPID config + `sendPushToUser`)
- Modify: `.env.example` (document `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`)
- Add db helpers: `src/db-react.ts` (`getPushSubscriptionsForUser`, `addPushSubscription`, `deletePushSubscription`)
- Test: `test/push-send.test.ts`

- [ ] **Step 1: Install web-push**

Run: `npm install web-push && npm install -D @types/web-push`

- [ ] **Step 2: Write the failing test (inject the web-push sender + subscription loader)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { sendPushToUser } from '../src/push';

describe('sendPushToUser', () => {
  it('sends one notification per subscription and drops 410-Gone subscriptions', async () => {
    const subs = [
      { id: 1, endpoint: 'https://push/1', keys: JSON.stringify({ p256dh: 'a', auth: 'b' }) },
      { id: 2, endpoint: 'https://push/2', keys: JSON.stringify({ p256dh: 'c', auth: 'd' }) },
    ];
    const sent: string[] = [];
    const sendNotification = vi.fn(async (sub: any) => {
      sent.push(sub.endpoint);
      if (sub.endpoint === 'https://push/2') throw { statusCode: 410 };
    });
    const deleted: number[] = [];
    await sendPushToUser('user-1', { title: 'Rezept fertig', body: 'Pizza', url: '/recipe/5' }, {
      loadSubscriptions: async () => subs as any,
      sendNotification,
      deleteSubscription: async (id) => { deleted.push(id); },
    });
    expect(sent).toEqual(['https://push/1', 'https://push/2']);
    expect(deleted).toEqual([2]); // 410 → pruned
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run push-send`
Expected: FAIL — cannot resolve `../src/push`.

- [ ] **Step 4: Implement `src/push.ts`**

```ts
// src/push.ts
import webpush from 'web-push';

export interface PushPayload { title: string; body: string; url: string; }

interface PushSubRow { id: number; endpoint: string; keys: string; }

export interface SendPushDeps {
  loadSubscriptions: (userId: string) => Promise<PushSubRow[]>;
  sendNotification: (sub: webpush.PushSubscription, payload: string) => Promise<unknown>;
  deleteSubscription: (id: number) => Promise<void>;
}

let configured = false;
export function configureVapid(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@rezepti.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

const defaultDeps = (): SendPushDeps => ({
  loadSubscriptions: (userId) => import('./db-react.js').then((m) => m.getPushSubscriptionsForUser(userId)),
  sendNotification: (sub, payload) => webpush.sendNotification(sub, payload),
  deleteSubscription: (id) => import('./db-react.js').then((m) => m.deletePushSubscriptionById(id)),
});

/** Best-effort fan-out of a push payload to all of a user's subscriptions. */
export async function sendPushToUser(userId: string, payload: PushPayload, deps: SendPushDeps = defaultDeps()): Promise<void> {
  const subs = await deps.loadSubscriptions(userId);
  const body = JSON.stringify(payload);
  for (const row of subs) {
    const keys = JSON.parse(row.keys) as { p256dh: string; auth: string };
    try {
      await deps.sendNotification({ endpoint: row.endpoint, keys }, body);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await deps.deleteSubscription(row.id);
      // Other errors are swallowed — push is best-effort.
    }
  }
}
```

- [ ] **Step 5: Add the db helpers in `src/db-react.ts`**

```ts
import { pushSubscriptions } from "./schema.js";

export async function getPushSubscriptionsForUser(userId: string) {
  const db = getDb();
  return db.select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, keys: pushSubscriptions.keys })
    .from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function addPushSubscription(userId: string, endpoint: string, keys: string): Promise<void> {
  const db = getDb();
  await db.insert(pushSubscriptions).values({ userId, endpoint, keys })
    .onConflictDoNothing({ target: [pushSubscriptions.userId, pushSubscriptions.endpoint] });
}

export async function deletePushSubscriptionByEndpoint(userId: string, endpoint: string): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function deletePushSubscriptionById(id: number): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
```

- [ ] **Step 6: Document env in `.env.example`**

Append:
```
# Web Push (PWA notifications). Generate once: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@rezepti.app
```

- [ ] **Step 7: Run the test + type-check**

Run: `npm test -- --run push-send && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/push.ts src/db-react.ts .env.example
git commit -m "feat(push): VAPID web-push send helper + subscription db helpers"
```

### Task 13: Push subscribe/unsubscribe API endpoints

**Files:**
- Create: `src/routes/push.ts`
- Modify: `src/api-react.ts:13,25` (import + mount `pushRouter`)
- Modify: `CLAUDE.md` (Route Auth Inventory + endpoint table)
- Test: `test/push-routes.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
import { describe, it, expect } from 'vitest';
import app from '../src/routes/push';

describe('push subscribe routes', () => {
  it('rejects unauthenticated subscribe with 401', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' } }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed subscription body with 400 (when authed)', async () => {
    // Use the existing authed-request helper pattern from test/planner-routes.test.ts.
    // Assert a missing-endpoint body yields 400.
    expect(true).toBe(true); // replace with the authed harness assertion
  });
});
```

> Mirror the auth-header / test-DB harness from `test/planner-routes.test.ts`. Replace the placeholder assertion with a real authed request once the harness is wired — do not ship a `true===true` assertion.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run push-routes`
Expected: FAIL — cannot resolve `../src/routes/push`.

- [ ] **Step 3: Implement the routes**

```ts
// src/routes/push.ts
import { Hono } from "hono";
import { getAuth, requireUserAuth } from "../auth.js";
import { addPushSubscription, deletePushSubscriptionByEndpoint } from "../db-react.js";

const app = new Hono();

app.post("/api/v1/push/subscribe", requireUserAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const body = await c.req.json().catch(() => null);
    const endpoint = body?.endpoint;
    const keys = body?.keys;
    if (typeof endpoint !== "string" || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
      return c.json({ error: "endpoint and keys.{p256dh,auth} are required" }, 400);
    }
    await addPushSubscription(auth.userId, endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }));
    return c.json({ success: true }, 201);
  } catch (error) {
    console.error("Error subscribing to push:", error);
    return c.json({ error: "Failed to subscribe" }, 500);
  }
});

app.delete("/api/v1/push/subscribe", requireUserAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const body = await c.req.json().catch(() => null);
    const endpoint = body?.endpoint;
    if (typeof endpoint !== "string") return c.json({ error: "endpoint is required" }, 400);
    await deletePushSubscriptionByEndpoint(auth.userId, endpoint);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
    return c.json({ error: "Failed to unsubscribe" }, 500);
  }
});

export default app;
```

- [ ] **Step 4: Mount the router**

In `src/api-react.ts`: add `import pushRouter from "./routes/push.js";` (near line 13) and `app.route("/", pushRouter);` (near line 25).

- [ ] **Step 5: Update CLAUDE.md docs**

Add to the API Endpoints table: `/api/v1/push/subscribe | POST/DELETE | Register/remove a Web Push subscription, requireUserAuth`. Add a Route Auth Inventory row: `push_subscriptions | Server + RLS | user-scoped | requireUserAuth | owner | owner | low | —`.

- [ ] **Step 6: Run the test + type-check**

Run: `npm test -- --run push-routes && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/push.ts src/api-react.ts CLAUDE.md test/push-routes.test.ts
git commit -m "feat(push): subscribe/unsubscribe endpoints (requireUserAuth)"
```

### Task 14: Send a push on job completion

**Files:**
- Modify: `src/job-manager.ts:104-110` (`completeJob`)
- Test: `test/job-completion-push.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { JobManager } from '../src/job-manager';

describe('completeJob push notification', () => {
  it('fires a push to the job owner with the recipe name when configured', async () => {
    const calls: any[] = [];
    const jm = new JobManager(/* …existing ctor args… */);
    // Inject the push sender (add an optional `onComplete` hook or DI in job-manager).
    (jm as any).pushSender = async (userId: string, payload: any) => { calls.push({ userId, payload }); };
    const jobId = jm.createJob(/* …with ownerUserId 'user-9' … */);
    jm.completeJob(jobId, { recipe: { name: 'Pizza', id: 5 } } as any);
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget settle
    expect(calls).toHaveLength(1);
    expect(calls[0].userId).toBe('user-9');
    expect(calls[0].payload.title).toMatch(/fertig/i);
    expect(calls[0].payload.url).toBe('/recipe/5');
  });
});
```

> Adapt the `JobManager` constructor/`createJob` call to the real signatures in `src/job-manager.ts`. The key behavior to assert: `completeJob` triggers a best-effort push to the owning user.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run job-completion-push`
Expected: FAIL — no push fired.

- [ ] **Step 3: Wire a best-effort push into `completeJob`**

Add an injectable push sender to `JobManager` (default = `sendPushToUser` from `src/push.ts`, guarded by `configureVapid()`), and call it inside `completeJob` after the status update. It must be fire-and-forget and never throw into the job path:

```ts
import { sendPushToUser, configureVapid, type PushPayload } from "./push.js";

// in completeJob(jobId, result), after Object.assign(...):
if (job.ownerUserId && configureVapid()) {
  const name = result?.recipe?.name ?? "Dein Rezept";
  const id = result?.recipe?.id;
  const payload: PushPayload = { title: "Rezept fertig 🍳", body: name, url: id ? `/recipe/${id}` : "/" };
  void (this.pushSender ?? sendPushToUser)(job.ownerUserId, payload).catch(() => {});
}
```

Add `ownerUserId` to the job record if not already tracked (it must be captured at `createJob` time from the authenticated user). If the job model has no owner field, add one — extraction jobs are already `requireUserAuth` and user-scoped per the API inventory.

- [ ] **Step 4: Run the test + type-check**

Run: `npm test -- --run job-completion-push && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/job-manager.ts test/job-completion-push.test.ts
git commit -m "feat(push): notify the job owner when an extraction completes"
```

### Task 15: SW push + notificationclick handlers

**Files:**
- Modify: `mobile/sw/sw.ts` (add `push` and `notificationclick` listeners)
- Test: `mobile/test/sw-push-handler.test.ts`

- [ ] **Step 1: Write the failing test for the payload parser**

The notification-building logic is extracted to a pure function so it is testable without a real SW.

```ts
import { describe, it, expect } from 'vitest';
import { buildNotification, resolveClickUrl } from '@/sw/push-handler';

describe('push handler helpers', () => {
  it('builds a notification from a valid JSON payload', () => {
    const n = buildNotification(JSON.stringify({ title: 'Rezept fertig', body: 'Pizza', url: '/recipe/5' }));
    expect(n.title).toBe('Rezept fertig');
    expect(n.options.body).toBe('Pizza');
    expect(n.options.data).toEqual({ url: '/recipe/5' });
  });

  it('falls back to a default title on malformed payloads', () => {
    const n = buildNotification('not json');
    expect(n.title).toBe('RecipeDeck');
  });

  it('resolves the click URL from notification data, defaulting to /', () => {
    expect(resolveClickUrl({ url: '/recipe/9' })).toBe('/recipe/9');
    expect(resolveClickUrl(undefined)).toBe('/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- sw-push-handler`
Expected: FAIL — cannot resolve `@/sw/push-handler`.

- [ ] **Step 3: Create the pure helpers**

```ts
// mobile/sw/push-handler.ts
export interface BuiltNotification {
  title: string;
  options: { body: string; data: { url: string }; icon?: string; badge?: string };
}

export function buildNotification(raw: string): BuiltNotification {
  try {
    const p = JSON.parse(raw) as { title?: string; body?: string; url?: string };
    return {
      title: p.title ?? 'RecipeDeck',
      options: { body: p.body ?? '', data: { url: p.url ?? '/' }, icon: '/icon-192.png', badge: '/icon-192.png' },
    };
  } catch {
    return { title: 'RecipeDeck', options: { body: '', data: { url: '/' }, icon: '/icon-192.png' } };
  }
}

export function resolveClickUrl(data: { url?: string } | undefined): string {
  return data?.url ?? '/';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- sw-push-handler`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the listeners into the SW**

In `mobile/sw/sw.ts`, import the helpers and add:

```ts
import { buildNotification, resolveClickUrl } from './push-handler.js';

self.addEventListener('push', (event: PushEvent) => {
  const raw = event.data?.text() ?? '';
  const n = buildNotification(raw);
  event.waitUntil(self.registration.showNotification(n.title, n.options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = resolveClickUrl(event.notification.data as { url?: string } | undefined);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return (existing as WindowClient).focus().then((c) => c?.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
```

- [ ] **Step 6: Rebuild SW + run tests + guard**

Run: `npx tsx scripts/pwa/build-sw.ts && npm run test:mobile -- sw-push-handler && npm run test:mobile:rntl-guard`
Expected: SW builds; tests PASS; guard clean.

- [ ] **Step 7: Commit**

```bash
git add mobile/sw/sw.ts mobile/sw/push-handler.ts mobile/test/sw-push-handler.test.ts public/sw.js
git commit -m "feat(push): SW push + notificationclick handlers"
```

### Task 16: Client push opt-in UX in Settings

**Files:**
- Create: `mobile/hooks/usePushSubscription.ts`
- Modify: `mobile/app/(tabs)/settings.tsx` (or the SettingsPage equivalent — locate the actual settings screen)
- Test: `mobile/test/use-push-subscription.test.ts`

- [ ] **Step 1: Write the failing test for the subscribe flow (inject deps)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { subscribeToPush } from '@/hooks/usePushSubscription';

describe('subscribeToPush', () => {
  it('subscribes via pushManager and POSTs the subscription to the server', async () => {
    const subscribe = vi.fn(async () => ({
      endpoint: 'https://push/1',
      toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' } }),
    }));
    const reg = { pushManager: { subscribe, getSubscription: async () => null } } as any;
    const post = vi.fn(async () => new Response(null, { status: 201 }));
    const out = await subscribeToPush({
      registration: reg,
      vapidKey: 'BASE64KEY',
      requestPermission: async () => 'granted',
      postSubscription: post,
    });
    expect(out).toBe(true);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledOnce();
  });

  it('returns false and does not POST when permission is denied', async () => {
    const post = vi.fn();
    const out = await subscribeToPush({
      registration: { pushManager: { subscribe: vi.fn(), getSubscription: async () => null } } as any,
      vapidKey: 'K',
      requestPermission: async () => 'denied',
      postSubscription: post as any,
    });
    expect(out).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- use-push-subscription`
Expected: FAIL — cannot resolve `@/hooks/usePushSubscription`.

- [ ] **Step 3: Implement the subscribe helper + hook**

```ts
// mobile/hooks/usePushSubscription.ts
import { apiFetch } from '@/utils/api';

export interface SubscribeDeps {
  registration: ServiceWorkerRegistration;
  vapidKey: string;
  requestPermission: () => Promise<NotificationPermission>;
  postSubscription: (sub: unknown) => Promise<Response>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeToPush(deps: SubscribeDeps): Promise<boolean> {
  const permission = await deps.requestPermission();
  if (permission !== 'granted') return false;
  const existing = await deps.registration.pushManager.getSubscription();
  const sub = existing ?? await deps.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(deps.vapidKey),
  });
  const json = (sub as PushSubscription).toJSON();
  const res = await deps.postSubscription({ endpoint: json.endpoint, keys: json.keys });
  return res.ok;
}

/** Production entry point: wires real navigator/Notification + apiFetch. */
export async function enablePushNotifications(vapidKey: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof Notification === 'undefined') return false;
  const registration = await navigator.serviceWorker.ready;
  return subscribeToPush({
    registration,
    vapidKey,
    requestPermission: () => Notification.requestPermission(),
    postSubscription: (sub) => apiFetch('/api/v1/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub),
    }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:mobile -- use-push-subscription`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the opt-in toggle to Settings**

Locate the settings screen (search: `Grep "SettingsPage|settings" mobile/app`). Add a "Push-Benachrichtigungen aktivieren" button/switch that calls `enablePushNotifications(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY!)` on press and surfaces the boolean result (granted / denied). Expose the public VAPID key to the client via `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (document it in `.env.example` and `mobile`'s env handling). Do NOT auto-prompt on app load — opt-in only.

- [ ] **Step 6: Run the full mobile suite + guard + typecheck**

Run: `npm run test:mobile && npm run test:mobile:rntl-guard && npm run mobile:typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/hooks/usePushSubscription.ts mobile/app/\(tabs\)/settings.tsx .env.example
git commit -m "feat(push): opt-in push subscription toggle in settings"
```

### Task 17: Documentation — update the PWA runbook + TODO

**Files:**
- Modify: `docs/pwa-runbook.md` (new cache/message types, Background Sync flow, Push setup + VAPID key generation, troubleshooting)
- Modify: `TODO.md` (close the offline-writes + background-sync/push lines)
- Modify: `CLAUDE.md` PWA section (Background Sync + Push status)

- [ ] **Step 1: Document Background Sync + Push in the runbook**

Add sections to `docs/pwa-runbook.md`: (a) the offline mutation queue (IndexedDB store name `recipedeck-offline`, FIFO flush, LWW reconciliation via refetch), (b) Background Sync (`flush-mutations` tag, SW-wakes-client design + no-tab limitation), (c) Push setup: generate VAPID keys (`npx web-push generate-vapid-keys`), set `VAPID_*` + `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, the `push_subscriptions` table, and emergency "disable push" (clear VAPID env → `configureVapid()` returns false → sends become no-ops).

- [ ] **Step 2: Close the TODO entries**

In `TODO.md`, mark `- [x]` for "PWA: Schreibender Offline-Pfad" and "PWA: Background Sync / Push Notifications", each appended with ` — erledigt 2026-06-13, Plan docs/superpowers/plans/2026-06-13-pwa-followups-plan.md`.

- [ ] **Step 3: Update CLAUDE.md PWA status**

In the PWA section, note Background Sync (queue flush via SW-wakes-client) and Push (VAPID + `push_subscriptions` + job-completion notification) as delivered, with the no-tab background-flush limitation documented.

- [ ] **Step 4: Commit**

```bash
git add docs/pwa-runbook.md TODO.md CLAUDE.md
git commit -m "docs(pwa): runbook + TODO/CLAUDE updates for offline writes, background sync, push"
```

---

## Final Verification (run before opening the PR)

- [ ] `npx tsc --noEmit` — server type-check clean
- [ ] `npm run mobile:typecheck` — mobile type-check clean
- [ ] `npm test -- --run --exclude="test/e2e/**"` — root/server unit tests green
- [ ] `npm run test:mobile` — mobile tests green
- [ ] `npm run test:mobile:rntl-guard` — no new `react-test-renderer` imports
- [ ] `npm run build:mobile && npx tsx scripts/pwa/build-sw.ts` — web export + SW build succeed, precache under 5 MB
- [ ] `npm run perf:bundle` — JS bundle under 5 MB
- [ ] Apply both migrations to staging Supabase and run the RLS smoke (`npm run supabase:rls-smoke:staging`)
- [ ] Manual smoke: offline → add shopping item → go online → item persists server-side (LWW); complete an extraction with push enabled → notification arrives and click opens the recipe

---

## Notes / Open Decisions for the Implementer

- **IndexedDB vs dependency:** This plan uses a hand-written IDB store (no runtime dep) + `fake-indexeddb` (dev-only) for tests. If the codebase later adopts `idb`, the `QueueStore` interface isolates the swap.
- **`Date.now()` in `withOpId`:** fine in app runtime; queue tests inject `createdAt` and never assert on wall-clock time.
- **Migration order:** apply `20260613120000` (idempotency) before `20260613130000` (push). Both are idempotent (`IF NOT EXISTS`).
- **iOS PWA push:** requires the app to be installed to the home screen (iOS 16.4+). Document this caveat in the Settings UX copy.
- **web-push send timing:** fired best-effort fire-and-forget from `completeJob` so it never blocks or fails the extraction pipeline.

---

## Review-Korrekturen (Eng Review, 2026-06-14)

Verbindliche Änderungen aus dem Eng-Review. Jede ersetzt/ergänzt die referenzierte Task.
Lieferung in **3 getrennten PRs**: PR1 = Phase 1, PR2 = Phase 2, PR3 = Phase 3.

### K1 — Offline-Add: Optimistic-Insert + Temp-ID→Server-ID-Reconciliation (Task 9, P1)

Heute ist `handleAddManual` refetch-basiert (`await add(); await load();`,
[shopping.tsx:188-206](../../../mobile/app/(tabs)/shopping.tsx)) — **kein** optimistisches Insert.
Offline gäbe `queuedMutate` sofort `{queued:true}` zurück, danach scheitert `load()` → der
Artikel bleibt unsichtbar. Außerdem fehlt jegliche Temp-ID-Reconciliation.

Task 9 wird so erweitert:

1. **Optimistic-Insert bei Add.** Vor dem `queuedMutate` lokal eine Karte mit Temp-ID einfügen:
   ```tsx
   const tmpId = `tmp-${crypto.randomUUID()}`;
   setItems(prev => [...prev, { id: tmpId, canonical_name: name, checked: 0, /* … */ }]);
   ```
   Bei permanentem Fehler (throw aus `queuedMutate`) die Temp-Karte wieder entfernen (Rollback).
2. **Kein `await load()` direkt nach dem Add im Offline-Fall.** `load()` nur ausführen, wenn
   `queuedMutate` `{queued:false}` zurückgibt (online erfolgreich) — sonst überschreibt der
   fehlschlagende Refetch die optimistische Karte.
3. **Reconciliation nach Flush.** `useOfflineQueue.flush()` ruft nach erfolgreichem Drain einen
   übergebenen `onFlushed`-Callback; Shopping/Planner hängen dort ihr `load()` ein → Server ist
   LWW, Temp-IDs werden durch echte ersetzt.
4. **Temp-Items sind nicht toggle-/löschbar, solange unbestätigt.** `handleToggle`/`handleDelete`
   früh return, wenn `typeof item.id === 'string'` (Temp-ID). Verhindert queue-PATCH/DELETE auf
   nicht-existente Server-IDs (404 → permanent-drop). Optisch: Temp-Karte mit reduzierter Opacity
   + „wird synchronisiert".
5. **Tests** (Task 9 ergänzen): create-offline → Karte sichtbar (Temp-ID); flush → `load()` läuft,
   Temp-ID verschwindet; toggle/delete auf Temp-ID ist No-Op (kein enqueue).

```
ADD (offline)                 FLUSH (reconnect)
 setItems([...,tmp-x])         drain queue FIFO (POST zuerst)
 enqueue(POST client_op_id)    -> server vergibt realId
 {queued:true} -> Karte bleibt onFlushed() -> load() -> tmp-x ersetzt durch realId
 (kein load())                 toggle/delete auf tmp-x: blockiert bis realId da
```

### K2 — Partial-Index `ON CONFLICT` braucht `targetWhere` (Task 7, P1)

Der partielle Unique-Index (`WHERE client_op_id IS NOT NULL`) erfordert das Prädikat in der
Conflict-Klausel, sonst wirft Postgres *"no unique or exclusion constraint matching the ON
CONFLICT specification"* — bei **jedem** `meal_plan`-Insert, auch online mit `clientOpId = null`.
`addRecipeToMealPlan` korrigieren:

```ts
.onConflictDoNothing({
  target: [mealPlan.householdId, mealPlan.clientOpId],
  targetWhere: sql`${mealPlan.clientOpId} is not null`,
})
```

### K3 — `client_op_id` nur auf `meal_plan`, nicht auf `shopping_list` (Task 7, CQ)

`shopping_list` dedupliziert Retries bereits über den bestehenden Unique-Index
`(household_id, recipe_id, canonical_name)` ([db-react.ts:749-751](../../../src/db-react.ts)) —
ein erneuter POST desselben Artikels trifft `onConflictDoNothing` und legt keine zweite Row an.
Eine zusätzliche `client_op_id`-Spalte + Partial-Index auf `shopping_list` wäre toter Ballast,
der nirgends als Conflict-Arbiter genutzt wird. **Migration + Drizzle-Schema-Änderung nur für
`meal_plan`.** `addToShoppingList` bekommt **keinen** `clientOpId`-Parameter; der Client darf
`client_op_id` im Body mitschicken, der Server ignoriert es für Shopping.
Idempotenz-Test für Shopping trotzdem ergänzen: doppelter POST gleicher `canonicalName` → genau 1 Row.

### K4 — Push-Sender via `JobManagerDependencies` injizieren + echte Felder nutzen (Task 14, P1/Phase 3)

Der Plan nutzt `job.ownerUserId`, `(jm as any).pushSender` und `new JobManager(...)` — alle drei
existieren nicht ([job-manager.ts](../../../src/job-manager.ts): Feld heißt `userId`, Konstruktor
ist `private`, kein `pushSender`). Korrektur:

```ts
interface JobManagerDependencies {
  now: () => number;
  random: () => number;
  pushSender?: (userId: string, payload: PushPayload) => Promise<void>;
}
// completeJob(jobId, result), nach Object.assign(...):
if (job.userId && configureVapid()) {
  const name = result?.recipe?.name ?? "Dein Rezept";
  const id = result?.recipeId;                 // NICHT result.recipe.id — die DB-ID ist recipeId
  const payload: PushPayload = { title: "Rezept fertig 🍳", body: name, url: id ? `/recipe/${id}` : "/" };
  void (this.deps.pushSender ?? sendPushToUser)(job.userId, payload).catch(() => {});
}
```
Test über `JobManager.createTestInstance({ pushSender: spy })`, `createJob(url, ua, hash, 'user-9')`,
und Assertion `payload.url === '/recipe/5'` (aus `result.recipeId = 5`).

### K5 — DRY: Response→`SendOutcome`-Klassifikation zentralisieren (Task 6 + Task 8, CQ)

Die Logik „`res.ok`→ok / `isRetryableStatus`→retry / sonst→drop, Netzfehler(`TypeError`)→retry"
steckt doppelt in `queuedMutate` (Task 6) und `flushOnce` (Task 8 queue-singleton). In
`mobile/offline/types.ts` zwei reine Helfer ergänzen und beide Stellen darauf umstellen:

```ts
export function classifyResponse(res: Response): SendOutcome {
  if (res.ok) return 'ok';
  return isRetryableStatus(res.status) ? 'retry' : 'drop';
}
export function classifyError(err: unknown): SendOutcome {
  return err instanceof TypeError ? 'retry' : 'drop'; // Netzfehler → retry
}
```
Hinweis: `queuedMutate` wirft bei `'drop'` weiterhin (Caller-Rollback), `flushOnce` verwirft still.

### K6 — `network-status.test.ts` braucht eine DOM-Umgebung (Task 8, P1 Test-Infra)

Mobile Vitest läuft mit `environment: 'node'` ([mobile/vitest.config.ts](../../../mobile/vitest.config.ts)).
`onReconnect` gibt unter Node sofort einen No-Op zurück (`typeof window === 'undefined'`), der
geplante Test (`window.dispatchEvent(new Event('online'))`) kann also **nie** grün werden.
Fix: am Dateikopf `// @vitest-environment jsdom` setzen und `jsdom` als Dev-Dep im mobile-Workspace
sicherstellen (`npm --prefix mobile ls jsdom` prüfen, ggf. `npm --prefix mobile i -D jsdom`).
`idb-store.test.ts` (fake-indexeddb) und `offline-queue-banner.test.tsx` (RNTL-Shim) bleiben node-kompatibel.

### Test-Coverage-Diagramm (Sektion 3)

```
CODE PATHS (neu)                                  STATUS
[+] mobile/offline/types.ts
  ├── isRetryableStatus(5xx/429/408 vs 4xx)       [★★★ geplant — offline-types.test]
  ├── classifyResponse / classifyError (K5)       [GAP → Test in types.test ergänzen]
[+] mobile/offline/mutation-queue.ts
  ├── enqueue/size/list/flush (ok/retry/drop)     [★★★ geplant — mutation-queue.test]
[+] mobile/offline/idb-store.ts                    [★★ geplant — idb-store.test (fake-idb)]
[+] mobile/offline/queued-mutate.ts
  ├── online-ok / offline / retryable / permanent [★★★ geplant — queued-mutate.test]
  ├── client_op_id-Injektion (POST)               [★★ geplant]
  ├── create-offline-then-toggle (Temp-ID) (K1)   [GAP → CRITICAL, neuer Test]
[+] mobile/offline/network-status.ts (onReconnect)[GAP → braucht jsdom (K6)]
[+] mobile/app/(tabs)/shopping.tsx (K1)
  ├── optimistic add + rollback                   [GAP → Test ergänzen]
  ├── flush→load reconciliation (Temp→real)       [GAP → Test ergänzen]
  ├── toggle/delete auf Temp-ID = No-Op           [GAP → Test ergänzen]
[+] src/db-react.ts addRecipeToMealPlan (K2)
  ├── insert / op-id-conflict / null-op-id        [★★★ geplant — planner-idempotency.test]
[+] src/routes/* shopping POST idempotent (K3)    [GAP → Shopping-Idempotenztest]
[+] src/push.ts sendPushToUser
  ├── fan-out / 410-prune                          [★★★ geplant — push-send.test]
[+] src/routes/push.ts subscribe/unsubscribe
  ├── 401 unauth / 400 malformed / 201 ok          [★★ geplant — Platzhalter durch echte Assertion ersetzen]
[+] src/job-manager.ts completeJob push (K4)      [★★ geplant — recipeId statt recipe.id]
[+] mobile/sw/push-handler.ts (build/resolve)     [★★★ geplant — sw-push-handler.test]
[+] mobile/offline/background-sync.ts            [★★★ geplant — background-sync.test]
[+] mobile/hooks/usePushSubscription.ts          [★★ geplant — granted/denied]

COVERAGE-LÜCKEN: 6 (1 CRITICAL: create-offline-then-mutate)
```

### NOT in scope (bestätigt/ergänzt)

- Feld-Merge / echte Konflikterkennung — LWW-by-Refetch genügt für diesen Slice.
- Token-loses Background-Replay ohne offenen Tab — Token lebt in der Page-Session; SW-`sync`
  weckt nur offene Clients. Bewusste, dokumentierte Limitation (Design 3a). → TODO-Kandidat.
- React-Query-Migration der Shopping/Planner-Screens — bleibt useState + queuedMutate.
- `client_op_id` für Shopping (K3) — Namens-Index deckt Idempotenz bereits ab.

### What already exists (Reuse)

- `apiFetch` ([api.ts:53-75](../../../mobile/utils/api.ts)) liefert rohe `Response` + macht
  401→Refresh→Retry. `sendQueuedMutation` baut sauber darauf auf — **nicht** neu bauen.
- Shopping `toggle`/`delete` haben bereits Optimistic+Rollback — Queue dockt dort an.
- `shopping_list` Unique-Index `(household_id, recipe_id, canonical_name)` → Shopping-Idempotenz (K3).
- `JobManagerDependencies` (now/random) ist das vorhandene DI-Muster → `pushSender` dort einreihen (K4).
- `job.userId` ist bereits gesetzt → kein neues `ownerUserId`-Feld.

### Failure Modes (neue Codepfade)

| Pfad | Realistischer Fehler | Test? | Error-Handling? | Sichtbar? |
|------|----------------------|-------|-----------------|-----------|
| Offline-Add ohne Reconciliation | Item unsichtbar bis Reconnect | nach K1 ✓ | K1 Rollback | ja (Temp-Karte) |
| Create-then-modify (Temp-ID) | PATCH/DELETE→404→drop | nach K1 ✓ (No-Op) | K1 Block | ja |
| `meal_plan`-Insert | ON CONFLICT wirft (K2) | nach K2 ✓ | K2 targetWhere | 500 sonst |
| Push-URL | `/recipe/undefined`→`/` | nach K4 ✓ | K4 recipeId | falsch sonst |
| network-status-Test | Test nie grün (K6) | nach K6 ✓ | — | CI-rot sonst |
| Push send | Endpoint 410/404 | ✓ push-send | prune | best-effort |

### Parallelisierung (über die 3 PRs)

| PR | Module | Depends on |
|----|--------|-----------|
| PR1 Phase 1 | scripts/pwa, mobile (lazy) | — |
| PR2 Phase 2 (Server) | src/ (schema, db-react, routes) | — |
| PR2 Phase 2 (Mobile) | mobile/offline, hooks | — |
| PR2 Screen-Wiring | mobile/app/(tabs) | beide PR2-Lanes |
| PR3 Phase 3 | sw, src/push, routes, job-manager | PR2 |

Lane A (PR2 Server) und Lane B (PR2 Mobile-Offline) sind unabhängig → parallel.
Screen-Wiring (K1) erst nach beiden. PR3 erst nach PR2 (Sync braucht die Queue).

---

## Implementation Tasks
Synthetisiert aus den Review-Befunden. Jede Task referenziert einen Befund oben.

- [x] **T1 (P1, human: ~3h / CC: ~25min)** — mobile/app/(tabs) — Optimistic-Add + Temp-ID-Reconciliation
  - Surfaced by: Architektur Befund 1 / K1
  - Files: `mobile/app/(tabs)/shopping.tsx`, `mobile/app/(tabs)/planner.tsx`, `mobile/hooks/useOfflineQueue.ts`
  - Verify: neue Tests create-offline→sichtbar, flush→reconcile, toggle/delete-Temp=No-Op
- [x] **T2 (P1, human: ~30min / CC: ~5min)** — src/db-react — `targetWhere` für partiellen Index
  - Surfaced by: Architektur Befund 2 / K2
  - Files: `src/db-react.ts`
  - Verify: `npm test -- --run planner-idempotency` grün (kein ON-CONFLICT-Throw)
- [x] **T3 (P1, human: ~45min / CC: ~10min)** — src/job-manager + src/push — Push-DI + `recipeId`-Fix
  - Surfaced by: Architektur Befund 3 / K4
  - Files: `src/job-manager.ts`, `test/job-completion-push.test.ts`
  - Verify: `payload.url === '/recipe/5'` über `result.recipeId`
- [x] **T4 (P1, human: ~20min / CC: ~5min)** — mobile/test — jsdom-Env für network-status
  - Surfaced by: Code-Quality / K6
  - Files: `mobile/test/network-status.test.ts`, `mobile/package.json`
  - Verify: `npm run test:mobile -- network-status` grün
- [x] **T5 (P2, human: ~30min / CC: ~5min)** — supabase + src/schema — `client_op_id` nur meal_plan
  - Surfaced by: Code-Quality / K3
  - Files: Migration `20260613120000_*`, `src/schema.ts`, `src/db-react.ts`, Shopping-Idempotenztest
  - Verify: Shopping doppelter POST → 1 Row; meal_plan op-id dedupe
- [x] **T6 (P2, human: ~20min / CC: ~5min)** — mobile/offline — DRY Outcome-Klassifikation
  - Surfaced by: Code-Quality / K5
  - Files: `mobile/offline/types.ts`, `queued-mutate.ts`, `queue-singleton.ts`
  - Verify: `npm run test:mobile -- offline` grün

---

## Design-Review-Korrekturen (Design Review, 2026-06-14)

UI-Klassifizierung: **APP UI** (Utility-Chrome — Sync-Banner, Optimistic-Temp-Cards,
Push-Toggle, System-Notification; keine Marketing/Landing-Fläche). Kein DESIGN.md im Repo.
Vier nutzersichtbare Flächen: (A) `OfflineQueueBanner`, (B) Optimistic-Temp-Card (K1),
(C) Push-Opt-in-Toggle (Task 16), (D) Push-Notification-Inhalt (Task 14/15).

Bewertung der 7 Passes (vorher → nach Korrekturen):
Info-Arch 7→8 · Interaction-States 4→9 · Journey/Trust 5→9 · AI-Slop 9→9 ·
Design-System 4→8 · Responsive/A11y 5→9 · Pass 7: 3 Entscheidungen aufgelöst.
Gesamt-Design-Score: **5/10 → 8/10**.

Verbindliche Änderungen (alle auto-entschieden, Prinzipien *explicit over clever* + *completeness*).

### DD1 — `OfflineQueueBanner` an bestehenden `OfflineBanner` angleichen (Pass 5, P1)

Es existiert bereits [`OfflineBanner.tsx`](../../../mobile/components/OfflineBanner.tsx):
NativeWind-Klassen (`bg-warm-700 dark:bg-warm-800`), Dark-Mode, lucide-Icon (`WifiOff`/`LogIn`),
Fade-Animation, eigene `useIsOnline`-Erkennung. Der Plan-Entwurf von `OfflineQueueBanner`
([Task 9, Step 3](#)) nutzt dagegen Inline-Hex (`#FEF3C7`/`#92400E`), kein Dark-Mode, kein Icon,
keine Animation und eine zweite Online-Erkennung. Auf Shopping/Planner könnten **beide Banner
gleichzeitig** stapeln (bestehendes bei Query-Fehler + neues bei Sync) — zwei Offline-Vokabulare.

**Entscheidung: bestehenden `OfflineBanner` um eine `pending`/`syncing`-Variante erweitern statt
zweite Komponente.** Eine Offline-Sprache, kein Stapeln, DRY. Konkret:
- `OfflineBanner` bekommt optionale Props `pending?: number` und `syncState?: 'idle'|'syncing'|'synced'`.
- Reihenfolge der Sichtbarkeit (Precedence, schließt Pass-1-Lücke): `authExpired` > `offline` >
  `permanent-error` > `syncing` > `synced (2 s, auto-dismiss)` > hidden.
- **Zwei Farbwelten, nicht eine:** Offline/Fehler = bestehendes `bg-warm-700` (degradiert/rot-warm);
  Sync-in-Arbeit/Erfolg = `bg-amber-600 dark:bg-amber-700` (benigne, gelb) — wie die `authExpired`-Variante.
- Inline-Hex entfällt; NativeWind-Tokens + Dark-Mode wie im Rest der Komponente. Schließt zugleich
  die fehlenden Design-Tokens (kein DESIGN.md) pragmatisch über die vorhandene Tailwind-Skala.
- lucide-Icon je Zustand: `WifiOff` (offline), `RefreshCw` (syncing), `Check` (synced).

### DD2 — Interaction-State-Tabelle ergänzen (Pass 2, P1)

Die schwächste Stelle: mehrere Zustände sind unspezifiziert. Verbindlich in den Plan aufnehmen:

```
FLÄCHE                | OFFLINE          | PENDING (n)        | ERROR/DROP            | SUCCESS
----------------------|------------------|--------------------|-----------------------|------------------
Sync-Banner (A)       | "Offline …" (rot)| "n werden sync." …  | "n konnten nicht …"   | "Alle gespeichert ✓"
                      |                  | (gelb, RefreshCw)   | (rot, Retry-CTA)      | (2 s, auto-dismiss)
Temp-Card (B)         | Card + "⏳ wird   | wie offline         | Card entfernt + Toast | Temp-ID→realId,
                      | gespeichert"     |                     | "Konnte nicht …"      | normale Card
Push-Toggle (C)       | n/a (online-only)| Spinner während     | "Im Browser           | Switch = an,
                      |                  | Round-Trip          | blockiert" (sticky)   | "aktiv"
Notification (D)      | —                | —                   | best-effort, stumm    | "Rezept fertig 🍳"
```

Pro Zelle zählt, was der Nutzer **sieht** — nicht das Backend-Verhalten.

### DD3 — Trust-Moment beim Drain (Pass 3)

Heute verschwindet das Banner stumm, wenn die Queue leer wird. Nach „n werden synchronisiert"
ohne Bestätigung bleibt offen, ob gespeichert wurde. **Kurzer Erfolgszustand „Alle Änderungen
gespeichert ✓" (~2 s, auto-dismiss)** statt stummem Verschwinden. `useOfflineQueue` liefert dazu
beim Übergang `pending>0 → 0` ein kurzes `synced`-Flag (siehe `onFlushed`-Callback aus K1).

### DD4 — Permanenter Fehler muss sichtbar sein (Pass 2/3)

Ein permanent verworfener Mutation-Drop (4xx / Temp-Card-Rollback aus K1) darf nicht **stumm**
verschwinden. Inline-Fehler/Toast „Konnte nicht gespeichert werden" + optionaler Retry. K1
entfernt die Temp-Card bereits beim Rollback — hier nur die nutzersichtbare Meldung ergänzen.
`flushOnce`/`MutationQueue.flush` geben die `dropped`-Zahl bereits zurück → an die UI durchreichen.

### DD5 — Push-Toggle als vollständiger Lebenszyklus (Pass 2/6)

Task 16 verdrahtet nur `subscribe`; ein Switch-Affordance ohne Off-Pfad ist inkonsistent
(DELETE-Endpoint existiert bereits in Task 13). **Vollständig:**
- Echter Switch, der den **aktuellen** Subscription-Status spiegelt (`pushManager.getSubscription()`),
  an **subscribe UND** den vorhandenen `DELETE /api/v1/push/subscribe` gebunden.
- **Loading-State** während Permission-Prompt + `subscribe` + POST.
- **Denied-sticky:** Browser-Permission-Denial ist klebrig (kein Re-Prompt). Copy:
  „Benachrichtigungen sind im Browser blockiert — in den Browsereinstellungen aktivieren."
  Sonst scheint der Toggle dauerhaft kaputt.
- **iOS nicht installiert:** Toggle disabled + Hinweis „Erst zum Home-Bildschirm hinzufügen
  (iOS 16.4+)" statt stummem Fehlschlag.

### DD6 — Accessibility (Pass 6)

- `accessibilityRole="status"` (polite) für `syncing`/`synced`; `accessibilityRole="alert"`
  (assertive) **nur** für offline/permanent-error. Der Plan-Entwurf nutzt fälschlich `alert`
  für den benignen Sync-Zustand → Screenreader-Lärm.
- Temp-Card: `accessibilityState={{ disabled: true }}` + Label „wird synchronisiert", nicht nur
  reduzierte Opacity (Opacity-only liest sich als „kaputt/disabled" mehrdeutig — siehe DD7).
- Push-Toggle: Touch-Target ≥ 44 px.
- Jegliche Spinner respektieren `prefers-reduced-motion`.

### DD7 — Temp-Card: nicht nur Opacity (Pass 4)

Reduzierte Opacity allein ist mehrdeutig (laden vs. deaktiviert vs. Fehler). Zusätzlich ein
expliziter Inline-Chip „⏳ wird gespeichert", damit das Dimmen nicht das einzige Signal ist.

### NOT in scope (Design, bestätigt)

- Eigenes Design-System / DESIGN.md-Tokens — pragmatisch über vorhandene Tailwind-Skala; echtes
  `/design-consultation` als TODO (nicht blockierend).
- Animationsfeinschliff/Micro-Interactions über die Fade/Spinner-Specs hinaus.
- Notification-Rich-Content (Bilder/Actions) — Titel+Body+Click genügen für diesen Slice.

### What already exists (Design-Reuse)

- [`OfflineBanner.tsx`](../../../mobile/components/OfflineBanner.tsx) — NativeWind, Dark-Mode,
  lucide-Icons, Fade, `useIsOnline`, `authExpired`-Variante. **Erweitern, nicht duplizieren** (DD1).
- `useOfflineQueue` (`pending`/`online`/`flush`, K1 `onFlushed`) liefert die Datenquelle für die
  Banner-Zustände — keine zweite Online-Erkennung bauen.
- Shopping `toggle`/`delete` haben bereits Optimistic+Rollback → Fehler-Sichtbarkeit (DD4) dockt an.

### Implementation Tasks (Design)

- [x] **DT1 (P1, human: ~2h / CC: ~20min)** — mobile/components — `OfflineBanner` um `pending`/`syncState`-Variante erweitern statt `OfflineQueueBanner` (DD1)
  - Surfaced by: Pass 5 Design-System / DD1
  - Files: `mobile/components/OfflineBanner.tsx`, `mobile/app/(tabs)/shopping.tsx`, `mobile/app/(tabs)/planner.tsx`, `mobile/test/offline-banner.test.tsx`
  - Verify: ein Banner pro Screen; Offline=warm/rot, Sync=amber; Dark-Mode; kein Inline-Hex
- [x] **DT2 (P1, human: ~1h / CC: ~10min)** — mobile/app — Interaction-State-Tabelle umsetzen: drained-success + permanent-drop sichtbar (DD2/DD3/DD4)
  - Surfaced by: Pass 2 States / Pass 3 Journey
  - Files: `mobile/hooks/useOfflineQueue.ts`, `mobile/app/(tabs)/shopping.tsx`, `mobile/app/(tabs)/planner.tsx`
  - Verify: Test pending→0 zeigt „gespeichert ✓"; drop zeigt Fehlertext (kein stummes Verschwinden)
- [x] **DT3 (P1, human: ~1.5h / CC: ~15min)** — mobile/hooks — Push-Toggle als Switch mit subscribe+unsubscribe, loading, denied-sticky, iOS-disabled (DD5)
  - Surfaced by: Pass 2 States / Pass 6 A11y
  - Files: `mobile/hooks/usePushSubscription.ts`, `mobile/app/(tabs)/settings.tsx`, `mobile/test/use-push-subscription.test.ts`
  - Verify: Switch spiegelt `getSubscription()`; DELETE-Pfad; denied→Hinweis statt stummem Fail
- [x] **DT4 (P2, human: ~45min / CC: ~10min)** — mobile — A11y: `status` vs `alert`, Temp-Card `disabled`+Label, 44px Toggle, reduced-motion (DD6/DD7)
  - Surfaced by: Pass 6 Responsive/A11y / Pass 4
  - Files: `mobile/components/OfflineBanner.tsx`, `mobile/app/(tabs)/shopping.tsx`, `mobile/app/(tabs)/settings.tsx`
  - Verify: Screenreader-Rolle korrekt; Temp-Card announced als „wird synchronisiert"

### Unresolved Design Decisions (auto-entschieden, überstimmbar)

| Entscheidung | Auto-Wahl (Empfehlung) | Wenn anders gewünscht |
|--------------|------------------------|------------------------|
| Banner: erweitern vs. neue Komponente | **Erweitern** (DRY, eine Offline-Sprache) | separate Komponente mit geteilten Tokens |
| Drain: Erfolgs-Toast vs. stumm | **Kurzer „gespeichert ✓"-Toast** (Trust) | stummes Verschwinden |
| Push: Switch vs. Enable-Button | **Vollständiger Switch** (DELETE existiert) | One-way Enable-Button |
| DESIGN.md / Tokens | **TODO `/design-consultation`** (nicht blockierend) | jetzt im PR aufsetzen |

---

## DX-Review-Korrekturen (DevEx Review, 2026-06-14)

**Produkttyp:** API/Service + operative Plattform. **Persona:** der Self-Hosted-Operator
(du / dacown87) — Full-Stack, deployt via Docker Hub → Northflank, konfiguriert per `.env`.
**Modus:** DX POLISH. „TTHW"-Analogon = Zeit bis zur ersten funktionierenden Push-Notification.

**Empathie (Operator):** „Ich generiere VAPID-Keys mit `npx web-push generate-vapid-keys`,
trage sie ein, deploye — und es passiert nichts. Keine Notification, kein Log, kein Fehler.
Liegt's am Key? An iOS? Am Service Worker? Ich habe keinen Faden zum Ziehen." Genau diese
stumme Unsicherheit ist der teuerste DX-Bruch dieses Slices.

Bewertung (vorher → nach Korrekturen): Getting-Started 5→8 · API-Design 7→8 ·
Error/Uncertainty 4→8 · Docs 6→8 · Upgrade/Deploy 6→8 · Dev-Env 7→8 · Community n/a ·
Measurement 5→6 (deferred). **Gesamt-DX: 5/10 → 8/10. TTHW ~15–20 min → ~5 min.**

Verbindliche Änderungen (auto-entschieden, Prinzipien *Fight Uncertainty* + *Zero Friction at T0*):

### X1 — Zwei VAPID-Public-Key-Vars müssen identisch sein + EXPO_PUBLIC ist build-time-inlined (Pass 1, P1)

`VAPID_PUBLIC_KEY` (Server, Runtime) und `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (Client) müssen
**denselben Wert** tragen. `subscribeToPush` nutzt den Client-Key als `applicationServerKey`;
ist er ≠ Server-Key, gelingt das `subscribe`, aber jeder `webpush.sendNotification` scheitert
(stumm verworfen, X2). Zusätzlich ist jede `EXPO_PUBLIC_*`-Variable **zur Build-Zeit ins Bundle
inlined** — sie auf Northflank zu setzen reicht nicht; das Mobile-Bundle muss neu gebaut werden
und der Wert muss bereits in der Docker-`web-builder`-Stage (`npm run build:mobile`) verfügbar sein.
Verbindlich:
- Task 12 Step 6 / Task 16 Step 5: `.env.example`-Block ergänzen mit Kommentar
  *„VAPID_PUBLIC_KEY und EXPO_PUBLIC_VAPID_PUBLIC_KEY MÜSSEN identisch sein (einmal generieren,
  zweimal eintragen). EXPO_PUBLIC_* wird beim `build:mobile` ins Bundle gebacken — nach Änderung
  neu bauen + neu deployen."*
- Task 17 Runbook: dieselbe Doppelschlüssel-/Rebuild-Regel + Hinweis, dass die Docker-`web-builder`-
  Stage `EXPO_PUBLIC_VAPID_PUBLIC_KEY` als Build-Arg/Env braucht, sonst shipt der Toggle mit leerem Key.

### X2 — Push-Pfad ist stumm best-effort → Operator-Logs ergänzen (Pass 3, P1)

`configureVapid()` gibt bei fehlenden Keys still `false` zurück; `sendPushToUser` schluckt alle
Nicht-410-Fehler. Für den Operator ist „keine Notifications" damit komplett undebugbar. Verbindlich:
- **Einmaliges Startup-/erstes-Send-Log**, wenn VAPID nicht konfiguriert ist:
  `console.warn("[push] VAPID keys not set — notifications disabled (configureVapid=false)")`.
- In `sendPushToUser` bei Send-Fehlern den Statuscode auf `debug`/`warn` loggen (nicht nur 410-prune
  still): `console.warn("[push] send failed", { endpoint: row.endpoint, status })`. Best-effort bleibt
  best-effort — aber mit Faden zum Ziehen. Test (push-send.test) um eine Assertion „loggt bei Fehler" ergänzen.

### X3 — Migration-vor-Deploy-Reihenfolge fixieren (Pass 5, P2)

Northflank redeployt automatisch bei Image-Push. PR2 ist **nicht** best-effort: läuft der neue
`addRecipeToMealPlan`-Insert mit `targetWhere` bevor die `client_op_id`-Migration (`20260613120000`)
angewandt ist, wirft Postgres („no unique constraint matching ON CONFLICT"). Verbindlich in
„Final Verification" + Runbook: **Migration zuerst auf Prod-Supabase anwenden, dann das Image
deployen** — pro PR explizit (PR2: idempotency-Migration; PR3: push_subscriptions-Migration).

### X4 — „Funktioniert Push?"-Smoke in den Runbook (Pass 1/4, P2)

Nach dem Setup braucht der Operator eine Bestätigung ohne kompletten Extraktions-Job. Task 17
Runbook um einen Smoke ergänzen: Toggle in Settings aktivieren → Permission `granted` →
Subscription erscheint in `push_subscriptions` → ein Test-Send (z. B. kurzer Node-Snippet mit
`webpush.sendNotification` gegen die eigene Subscription, oder ein dokumentierter manueller
Job-Complete-Trigger) → Notification kommt + Klick öffnet `/recipe/:id`.

### X5 — VAPID-Key-Rotation dokumentieren (Pass 5, P2)

Runbook-Eintrag: VAPID-Keys rotieren invalidiert **alle** bestehenden Subscriptions (mit altem
Key verschlüsselt) → Sends laufen in 4xx → werden über X2/410-prune nach und nach entfernt; Nutzer
müssen Push neu aktivieren. Emergency-Disable bleibt: `VAPID_*` leeren → `configureVapid()=false` → no-op.

### NOT in scope (DX, bestätigt)

- Push-Delivery-Metriken (sent/pruned-Counter, Dashboard) — TODO-Kandidat (X6, Pass 8), für
  Single-Tenant nicht blockierend.
- Community/Ecosystem (Pass 7) — Self-Hosted Single-Tenant, kein öffentliches Dev-Produkt → n/a.
- Eigenes Push-SDK / Multi-Language — nicht relevant.

### What already exists (DX-Reuse)

- [`.env.example`](../../../.env.example) — bestehende, gut kommentierte Env-Matrix (Server-only vs
  EXPO_PUBLIC) → VAPID-Block dort einreihen, Konvention übernehmen (X1).
- `docs/pwa-runbook.md` — bestehender Runbook → Push/Sync-Sektionen anhängen (Task 17), nicht neu anlegen.
- `requireUserAuth` + Route-Auth-Inventory in CLAUDE.md → push-Routes folgen exakt dem Muster (Task 13).
- `JobManagerDependencies`-DI → `pushSender` injizierbar, testbar ohne echtes web-push (K4).

### Implementation Tasks (DX)

- [x] **XT1 (P1, human: ~30min / CC: ~10min)** — .env.example + docs/pwa-runbook — Doppel-VAPID-Key identisch + EXPO_PUBLIC-Rebuild/Build-Arg dokumentieren (X1)
  - Surfaced by: Pass 1 Getting-Started / X1
  - Files: `.env.example`, `docs/pwa-runbook.md`, `Dockerfile` (web-builder Build-Arg prüfen)
  - Verify: frischer Operator-Setup ohne Key-Mismatch; Prod-Bundle enthält den Key
- [x] **XT2 (P1, human: ~30min / CC: ~10min)** — src/push — Operator-Logs: VAPID-not-configured + Send-Fehler-Status (X2)
  - Surfaced by: Pass 3 Error/Uncertainty / X2
  - Files: `src/push.ts`, `test/push-send.test.ts`
  - Verify: Log bei fehlenden Keys; Log mit Status bei Send-Fehler; Test deckt es ab
- [x] **XT3 (P2, human: ~20min / CC: ~5min)** — docs — Migration-vor-Deploy-Reihenfolge je PR (X3)
  - Surfaced by: Pass 5 Upgrade/Deploy / X3
  - Files: Plan „Final Verification", `docs/pwa-runbook.md`
  - Verify: Runbook nennt explizit „Migration zuerst, dann Image" pro PR2/PR3
- [x] **XT4 (P2, human: ~30min / CC: ~10min)** — docs — Push-Verify-Smoke + VAPID-Rotation im Runbook (X4/X5)
  - Surfaced by: Pass 1/4 + Pass 5 / X4, X5
  - Files: `docs/pwa-runbook.md`
  - Verify: Operator kann Push ohne Extraktions-Job bestätigen; Rotations-Folgen dokumentiert

### Unresolved DX Decisions (auto-entschieden, überstimmbar)

| Entscheidung | Auto-Wahl (Empfehlung) | Wenn anders gewünscht |
|--------------|------------------------|------------------------|
| Push-Send-Logging-Level | **warn (sichtbar im Default-Log)** | debug (nur mit Verbose) |
| Verify-Smoke: Node-Snippet vs. UI-Toggle | **Beides im Runbook** (UI primär, Snippet als Fallback) | nur UI-Pfad |
| Delivery-Metriken | **TODO (X6), nicht in diesem Slice** | jetzt im PR3 |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found (gefaltet) | 6 Befunde, 0 kritische Lücken offen |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open (gefaltet) | Score 5→8/10, 7 Befunde (DD1–DD7), 4 Tasks |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | issues_open (gefaltet) | Score 5→8/10, TTHW ~15–20→~5 min, 5 Befunde (X1–X5), 4 Tasks |

**Eng-Befunde (alle in den Plan eingearbeitet — K1–K6):**
- K1 (P1) Offline-Add: Optimistic-Insert + Temp-ID-Reconciliation — *Vollständig* (User-Entscheidung)
- K2 (P1) Partial-Index ON CONFLICT braucht `targetWhere` (User-Entscheidung)
- K3 (CQ) `client_op_id` nur auf `meal_plan`; Shopping nutzt Namens-Index
- K4 (P1) Push-DI via `JobManagerDependencies` + `result.recipeId`-Bugfix (User-Entscheidung)
- K5 (CQ) DRY: Outcome-Klassifikation zentralisieren
- K6 (P1) `network-status.test.ts` braucht jsdom-Env (mobile Vitest ist `node`)

**Design-Befunde (alle in den Plan eingearbeitet — DD1–DD7):**
- DD1 (P1) `OfflineQueueBanner` an bestehenden `OfflineBanner` angleichen (erweitern statt duplizieren)
- DD2 (P1) Interaction-State-Tabelle (fehlende success/error/denied/loading-Zustände)
- DD3 Trust-Moment „gespeichert ✓" beim Queue-Drain statt stummem Verschwinden
- DD4 (P1) Permanenter Drop muss sichtbar sein (Inline-Fehler statt stummem Entfernen)
- DD5 (P1) Push-Toggle als vollständiger Switch (subscribe+unsubscribe, loading, denied-sticky, iOS)
- DD6 A11y: `status` vs `alert`, Temp-Card `disabled`+Label, 44px, reduced-motion
- DD7 Temp-Card: expliziter „wird gespeichert"-Chip statt Opacity-only

**DX-Befunde (alle in den Plan eingearbeitet — X1–X5):**
- X1 (P1) Doppel-VAPID-Key identisch + EXPO_PUBLIC build-time-inlined (Rebuild/Build-Arg)
- X2 (P1) Push-Pfad stumm best-effort → Operator-Logs (VAPID-not-configured + Send-Status)
- X3 (P2) Migration-vor-Deploy-Reihenfolge je PR (PR2 idempotency, PR3 push_subscriptions)
- X4 (P2) „Funktioniert Push?"-Smoke im Runbook
- X5 (P2) VAPID-Key-Rotation dokumentieren
- X6 (P3) Push-Delivery-Metriken → TODO (deferred, Single-Tenant nicht blockierend)

**Scope:** 3 getrennte PRs (Phase 1 → 2 → 3, User-Entscheidung). Design-Korrekturen in PR2 (DD1–DD4, DD6/7) + PR3 (DD5); DX-Korrekturen in PR2 (X3) + PR3 (X1, X2, X4, X5). Performance-Review: keine Issues.
**Outside Voice:** übersprungen (Codex nicht installiert; Befunde sind code-verifiziert).

**VERDICT:** ENG CLEARED + DESIGN CLEARED + DX CLEARED — ready to implement (6 Eng- + 7 Design- + 5 DX-Befunde in den Plan gefaltet, keine kritischen Lücken offen; auto-getroffene Entscheidungen überstimmbar).

NO UNRESOLVED DECISIONS

---

## Umsetzungsstatus (As-Built, 2026-06-14) ✅

Vollständig umgesetzt in **3 gestackten PRs** (subagent-driven, fresh agent + Review pro Arbeitseinheit). Merge-Reihenfolge **#14 → #15 → #16**.

| PR | Branch | Phase | Commits |
|----|--------|-------|---------|
| [#14](https://github.com/dacown87/rezepti/pull/14) | `feat/pwa-phase1-precache-cap` (base `main`) | Phase 1 | 2 |
| [#15](https://github.com/dacown87/rezepti/pull/15) | `feat/pwa-phase2-offline-queue` (base `main`) | Phase 2 | 9 |
| [#16](https://github.com/dacown87/rezepti/pull/16) | `feat/pwa-phase3-push-sync` (base `#15`) | Phase 3 | 8 |

**Verifikation:** Mobile 274 passed · Root 524 passed · **0 failures** · `tsc --noEmit` (Server) + `mobile:typecheck` + `rntl-guard` + `build-sw.ts` clean.

### As-Built-Abweichungen vom Plan (bewusst beim Umsetzen entschieden)
- **Phase 1 (statt Task 1 Lazy-Load):** Code-Splitting senkt die Precache-Gesamtmenge nicht — `build-sw.ts` globt alle Chunks. Stattdessen werden die reinen PDF-Export-Chunks (`pdf-export`, `html2canvas`, `purify` = 689 KB) vom Precache-Manifest ausgeschlossen (Laufzeit-CacheFirst deckt sie ab). Precache **4.61 MB < 5 MB**. (User-Entscheidung „beides kombinieren".)
- **K2:** drizzle-orm 0.45.2 kennt für `onConflictDoNothing` kein `targetWhere`; der API-korrekte Schlüssel ist `where` (emittiert dieselbe Partial-Index-Klausel). Vermeidet 500 bei jedem `meal_plan`-Insert.
- **K4:** Plan-Gate `if (job.userId && configureVapid())` hätte den Job-Completion-Test unmöglich gemacht. Korrigiert zu `if (sender || configureVapid())` — injizierter `pushSender` umgeht das VAPID-Gate; URL aus `result.recipeId`.
- **Tests:** Server-Idempotenz wird auf Wiring-Ebene getestet (Route-Harness mockt `db-react`); echte Postgres-Deduplizierung deckt das CI-Supabase-Gate. Shopping/Planner-Fallback-Tests von `500/503` auf `422` umgestellt, da retryable Stati jetzt korrekt gequeued statt als Fehler surfaced werden (Coverage erhalten, Review-bestätigt).
- **Phase-2-Kern:** `useOfflineQueue` wurde Teil der Integrations-Einheit (nicht des Kerns), da seine Endform (`onFlushed`/`syncState`/`lastDropped`) erst durch K1/DD3/DD4 definiert ist.

### Nach Merge aller 3 PRs (Deploy-Checkliste)
1. Migrationen **vor** Image-Deploy auf Prod-Supabase: PR2 `20260613120000`, PR3 `20260613130000`.
2. `VAPID_PUBLIC_KEY` == `EXPO_PUBLIC_VAPID_PUBLIC_KEY` setzen (Docker-`web-builder`-Build-Arg, build-time inlined).
3. Einmal `npx tsx scripts/pwa/build-sw.ts` (sw.js = Build-Artefakt aus PR1 + PR3).
