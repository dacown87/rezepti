import { describe, it, expect, vi } from 'vitest';
import { registerBackgroundFlush } from '@/offline/background-sync';

describe('registerBackgroundFlush', () => {
  it('registers sync tag flush-mutations when sync is supported', async () => {
    const register = vi.fn(async () => undefined);
    const container = {
      ready: Promise.resolve({
        sync: { register },
      }),
    } as unknown as ServiceWorkerContainer;

    await registerBackgroundFlush(container);

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith('flush-mutations');
  });

  it('resolves without throwing when sync is not supported (no .sync on registration)', async () => {
    const container = {
      ready: Promise.resolve({}),
    } as unknown as ServiceWorkerContainer;

    const result = await registerBackgroundFlush(container);

    expect(result).toBeUndefined();
  });
});
