import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  share: vi.fn(),
}));

vi.mock('react-native', () => ({
  Share: { share: state.share },
}));

describe('shareText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  it('returns "shared" when Share.share resolves, without touching the clipboard', async () => {
    state.share.mockResolvedValueOnce(undefined);
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    const outcome = await shareText({ title: 'Rezept', message: 'Hallo Welt' });

    expect(outcome).toBe('shared');
    expect(state.share).toHaveBeenCalledWith({ title: 'Rezept', message: 'Hallo Welt' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when Share.share rejects (Linux desktop Chromium case)', async () => {
    state.share.mockRejectedValueOnce(new Error('Share is not supported in this browser'));
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    const outcome = await shareText({ title: 'Rezept', message: 'Hallo Welt' });

    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Hallo Welt');
  });

  it('returns "unavailable" when Share.share rejects and there is no clipboard', async () => {
    state.share.mockRejectedValueOnce(new Error('Share is not supported in this browser'));
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    const outcome = await shareText({ message: 'Hallo Welt' });

    expect(outcome).toBe('unavailable');
  });

  it('returns "unavailable" when Share.share rejects and the clipboard write also rejects', async () => {
    state.share.mockRejectedValueOnce(new Error('Share is not supported in this browser'));
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied'));
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    const outcome = await shareText({ message: 'Hallo Welt' });

    expect(outcome).toBe('unavailable');
  });

  it('reports a cancelled share sheet as dismissed and leaves the clipboard alone', async () => {
    const abort = new Error('Share canceled');
    abort.name = 'AbortError';
    state.share.mockRejectedValueOnce(abort);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    const outcome = await shareText({ message: 'Hallo Welt' });

    expect(outcome).toBe('dismissed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('never throws in any of the above cases', async () => {
    state.share.mockRejectedValue(new Error('boom'));
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('boom')) } },
      writable: true,
      configurable: true,
    });

    const { shareText } = await import('@/utils/share');
    await expect(shareText({ message: 'x' })).resolves.toBe('unavailable');
  });
});
