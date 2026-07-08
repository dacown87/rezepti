export type QueuedMethod = 'POST' | 'PATCH' | 'DELETE';

export interface QueuedMutation {
  /** Client-generated UUID. Sent as `client_op_id` when the queued body is an object. */
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

/** K5: single source of truth for classifying a Response into a SendOutcome. */
export function classifyResponse(res: Response): SendOutcome {
  if (res.ok) return 'ok';
  return isRetryableStatus(res.status) ? 'retry' : 'drop';
}

/** K5: classify a thrown send error. Network errors (TypeError) are retryable. */
export function classifyError(err: unknown): SendOutcome {
  return err instanceof TypeError ? 'retry' : 'drop';
}
