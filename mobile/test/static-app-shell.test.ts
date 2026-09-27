// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hideStaticAppShell, STATIC_APP_SHELL_ID } from '@/utils/static-app-shell';

function mountShell() {
  const shell = document.createElement('div');
  shell.id = STATIC_APP_SHELL_ID;
  shell.className = 'rd-audit-shell';
  document.body.appendChild(shell);
  return shell;
}

describe('hideStaticAppShell', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('fades the pre-hydration shell out and then removes it from layout', () => {
    vi.useFakeTimers();
    const shell = mountShell();

    hideStaticAppShell();
    expect(shell.classList.contains('rd-audit-shell--hidden')).toBe(true);
    expect(shell.style.display).toBe('');

    vi.runAllTimers();
    expect(shell.style.display).toBe('none');
  });

  it('is a no-op without a shell and when called repeatedly', () => {
    expect(() => hideStaticAppShell()).not.toThrow();

    vi.useFakeTimers();
    const shell = mountShell();
    hideStaticAppShell();
    vi.runAllTimers();
    hideStaticAppShell();
    vi.runAllTimers();
    expect(shell.className).toBe('rd-audit-shell rd-audit-shell--hidden');
    expect(shell.style.display).toBe('none');
  });
});
