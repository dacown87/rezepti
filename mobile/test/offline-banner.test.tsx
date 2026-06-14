import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

// useIsOnline reads window/navigator on web. The vitest env is node, so provide
// them at module scope (before RNTL imports) and keep them defined — RNTL's
// auto-cleanup runs the effect teardown (window.removeEventListener) after each
// test, so unstubbing them mid-suite would crash on unmount.
const g = globalThis as unknown as { window?: unknown };
g.window = g.window ?? { addEventListener: () => undefined, removeEventListener: () => undefined };

// Regression: an auth failure (401) was surfaced with the crossed-out-WiFi
// "offline" framing, so users thought it was a network problem when their
// session had actually expired. The authExpired variant must show a distinct,
// tappable "re-login" message instead of the offline/WifiOff banner.

vi.mock('lucide-react-native', () => ({
  WifiOff: (props: Record<string, unknown>) => React.createElement('WifiOff', props),
  LogIn: (props: Record<string, unknown>) => React.createElement('LogIn', props),
  RefreshCw: (props: Record<string, unknown>) => React.createElement('RefreshCw', props),
  Check: (props: Record<string, unknown>) => React.createElement('Check', props),
}));

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
    Platform: { OS: 'web' },
    Animated: {
      View: wrap('AnimatedView'),
      Value: class { constructor(public value: number) {} },
      timing: () => ({ start: () => undefined }),
    },
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // navigator.onLine is falsy in the node test env → force "online" so the
    // banner's visibility is driven by the props under test, not a fake offline
    // state. Not unstubbed: RNTL's post-test cleanup runs the effect teardown.
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('shows a tappable re-login message (not the offline/WifiOff framing) when authExpired', async () => {
    const onAuthPress = vi.fn();
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    render(React.createElement(OfflineBanner, { authExpired: true, onAuthPress }));

    expect(screen.getByText('Sitzung abgelaufen — zum Neuanmelden tippen')).toBeTruthy();
    expect(screen.queryByText('Rezepte konnten nicht geladen werden')).toBeNull();

    await press(screen.getByLabelText('Erneut anmelden'));
    expect(onAuthPress).toHaveBeenCalledTimes(1);
  });

  it('shows the generic error message when isError but not authExpired', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    render(React.createElement(OfflineBanner, { isError: true }));

    expect(screen.getByText('Rezepte konnten nicht geladen werden')).toBeTruthy();
    expect(screen.queryByText('Sitzung abgelaufen — zum Neuanmelden tippen')).toBeNull();
  });

  it('renders nothing when online with no error', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    const { toJSON } = render(React.createElement(OfflineBanner, {}));
    expect(toJSON()).toBeNull();
  });

  // ─── New sync/pending state tests ─────────────────────────────────────────

  it('renders nothing when online, pending=0, syncState=idle', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    const { toJSON } = render(
      React.createElement(OfflineBanner, { pending: 0, syncState: 'idle' }),
    );
    expect(toJSON()).toBeNull();
    expect(screen.queryByText(/synchronisiert|gespeichert|offline/i)).toBeNull();
  });

  it('shows syncing text for plural pending mutations', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    render(
      React.createElement(OfflineBanner, { pending: 3, syncState: 'syncing' }),
    );
    expect(screen.getByText(/3 Änderungen werden synchronisiert/i)).toBeTruthy();
  });

  it('shows syncing text for a single pending mutation', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    render(
      React.createElement(OfflineBanner, { pending: 1, syncState: 'syncing' }),
    );
    expect(screen.getByText(/1 Änderung wird synchronisiert/i)).toBeTruthy();
  });

  it('shows synced confirmation text when syncState=synced', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    render(
      React.createElement(OfflineBanner, { syncState: 'synced' }),
    );
    expect(screen.getByText(/gespeichert/i)).toBeTruthy();
  });

  // a11y role checks: RNTL's getByRole only matches accessible elements (those
  // with `accessible` prop or host Text/TextInput/Switch). The mocked View is a
  // plain string element, so we check the role/accessibilityRole prop via the
  // rendered JSON props directly.
  // DD6 contracts: syncing/synced → role="status" (polite),
  //                offline/error  → accessibilityRole="alert" (assertive).
  it('(a11y) syncing banner View has role="status"', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    const { toJSON } = render(
      React.createElement(OfflineBanner, { pending: 2, syncState: 'syncing' }),
    );
    const json = toJSON() as { children: Array<{ props: Record<string, unknown> }> };
    // AnimatedView > View with role="status"
    const innerView = json?.children?.[0];
    expect((innerView as { props?: Record<string, unknown> })?.props?.role).toBe('status');
  });

  it('(a11y) synced banner View has role="status"', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    const { toJSON } = render(
      React.createElement(OfflineBanner, { syncState: 'synced' }),
    );
    const json = toJSON() as { children: Array<{ props: Record<string, unknown> }> };
    const innerView = json?.children?.[0];
    expect((innerView as { props?: Record<string, unknown> })?.props?.role).toBe('status');
  });

  it('(a11y) isError banner View has accessibilityRole="alert"', async () => {
    const { OfflineBanner } = await import('@/components/OfflineBanner');
    const { toJSON } = render(React.createElement(OfflineBanner, { isError: true }));
    const json = toJSON() as { children: Array<{ props: Record<string, unknown> }> };
    const innerView = json?.children?.[0];
    expect((innerView as { props?: Record<string, unknown> })?.props?.accessibilityRole).toBe('alert');
  });
});
