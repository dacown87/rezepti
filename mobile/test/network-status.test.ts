// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { onReconnect } from '@/offline/network-status';

describe('onReconnect', () => {
  it('calls callback on online event and stops after unsubscribe', () => {
    const cb = vi.fn();
    const unsubscribe = onReconnect(cb);

    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledTimes(1); // still 1 — unsubscribed
  });
});
