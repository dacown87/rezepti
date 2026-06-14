import { describe, it, expect } from 'vitest';
import type { QueuedMutation } from '@/offline/types';
import { isRetryableStatus, classifyResponse, classifyError } from '@/offline/types';

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

  it('classifyResponse: ok for 2xx, retry for 5xx/429/408, drop for other 4xx', () => {
    expect(classifyResponse(new Response(null, { status: 201 }))).toBe('ok');
    expect(classifyResponse(new Response(null, { status: 200 }))).toBe('ok');
    expect(classifyResponse(new Response(null, { status: 503 }))).toBe('retry');
    expect(classifyResponse(new Response('x', { status: 400 }))).toBe('drop');
  });

  it('classifyError: TypeError is retry, other errors are drop', () => {
    expect(classifyError(new TypeError('net'))).toBe('retry');
    expect(classifyError(new Error('x'))).toBe('drop');
  });
});
