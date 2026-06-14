/**
 * Temp-ID helpers for optimistic UI inserts.
 *
 * Before a mutation is confirmed by the server, newly added items are assigned
 * a client-generated string id so they can be rendered immediately and later
 * reconciled (replaced) with the real server id on flush.
 */

export function isTempId(id: number | string): id is string {
  return typeof id === 'string';
}

export function newTempId(): string {
  return `tmp-${crypto.randomUUID()}`;
}
