import type { QueueStore, QueuedMutation, SendOutcome } from './types';

export interface FlushSummary { sent: number; dropped: number; remaining: number; }

export type UserIdResolver = () => Promise<string | null>;

export class MutationQueue {
  /**
   * `resolveUserId` stamps each enqueued mutation with the signed-in user and is
   * the reference for `flush`. Without it (tests) mutations stay unstamped and
   * nothing is filtered.
   */
  constructor(
    private readonly store: QueueStore,
    private readonly resolveUserId?: UserIdResolver,
  ) {}

  async list(): Promise<QueuedMutation[]> { return this.store.read(); }

  async size(): Promise<number> { return (await this.store.read()).length; }

  async enqueue(mutation: QueuedMutation): Promise<void> {
    const items = await this.store.read();
    const userId = mutation.userId ?? (await this.resolveUserId?.()) ?? undefined;
    items.push(userId ? { ...mutation, userId } : mutation);
    await this.store.write(items);
  }

  /** Remove every queued mutation (sign-out, account switch, account deletion). */
  async clear(): Promise<void> { await this.store.write([]); }

  /**
   * Flush FIFO. `send` reports the outcome per mutation:
   *  'ok' → remove; 'drop' → remove (permanent); 'retry' → keep and STOP draining.
   * Mutations stamped for another user than the current one are dropped unsent.
   * With no signed-in user nothing is sent or dropped (the queue waits for login).
   */
  async flush(send: (m: QueuedMutation) => Promise<SendOutcome>): Promise<FlushSummary> {
    let items = await this.store.read();
    let sent = 0, dropped = 0;
    let currentUserId: string | null | undefined;
    if (this.resolveUserId) {
      currentUserId = await this.resolveUserId();
      if (!currentUserId) return { sent, dropped, remaining: items.length };
    }
    while (items.length > 0) {
      const head = items[0];
      if (currentUserId && head.userId && head.userId !== currentUserId) {
        dropped += 1;
        items = items.slice(1);
        await this.store.write(items);
        continue;
      }
      const outcome = await send(head);
      if (outcome === 'retry') break;
      if (outcome === 'ok') sent += 1; else dropped += 1;
      items = items.slice(1);
      await this.store.write(items);
    }
    return { sent, dropped, remaining: items.length };
  }
}
