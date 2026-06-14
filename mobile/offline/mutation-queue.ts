import type { QueueStore, QueuedMutation, SendOutcome } from './types';

export interface FlushSummary { sent: number; dropped: number; remaining: number; }

export class MutationQueue {
  constructor(private readonly store: QueueStore) {}

  async list(): Promise<QueuedMutation[]> { return this.store.read(); }

  async size(): Promise<number> { return (await this.store.read()).length; }

  async enqueue(mutation: QueuedMutation): Promise<void> {
    const items = await this.store.read();
    items.push(mutation);
    await this.store.write(items);
  }

  /**
   * Flush FIFO. `send` reports the outcome per mutation:
   *  'ok' → remove; 'drop' → remove (permanent); 'retry' → keep and STOP draining.
   */
  async flush(send: (m: QueuedMutation) => Promise<SendOutcome>): Promise<FlushSummary> {
    let items = await this.store.read();
    let sent = 0, dropped = 0;
    while (items.length > 0) {
      const head = items[0];
      const outcome = await send(head);
      if (outcome === 'retry') break;
      if (outcome === 'ok') sent += 1; else dropped += 1;
      items = items.slice(1);
      await this.store.write(items);
    }
    return { sent, dropped, remaining: items.length };
  }
}
