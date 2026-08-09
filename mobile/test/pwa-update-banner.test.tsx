import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

// PwaUpdateBanner is the global counterpart to the update card in Settings
// (mobile/app/(tabs)/settings.tsx): a second usePwaUpdate() instance, mounted
// once in _layout.tsx, so a deploy is visible no matter which screen the user
// is on. It must render nothing until the hook reports updateReady, must be
// able to trigger applyUpdate(), and must be dismissible for the session
// without touching the hook itself (dismissing does not call applyUpdate).

const state = vi.hoisted(() => ({
  updateReady: false,
  applyUpdate: vi.fn(),
}));

vi.mock('@/hooks/usePwaUpdate', () => ({
  usePwaUpdate: () => ({ updateReady: state.updateReady, applyUpdate: state.applyUpdate }),
}));

vi.mock('lucide-react-native', () => ({
  RefreshCw: (props: Record<string, unknown>) => React.createElement('RefreshCw', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

describe('PwaUpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateReady = false;
  });

  it('renders nothing when updateReady is false', async () => {
    const { PwaUpdateBanner } = await import('@/components/PwaUpdateBanner');
    const { toJSON } = render(React.createElement(PwaUpdateBanner));
    expect(toJSON()).toBeNull();
  });

  it('renders and calls applyUpdate when the apply button is pressed', async () => {
    state.updateReady = true;
    const { PwaUpdateBanner } = await import('@/components/PwaUpdateBanner');
    render(React.createElement(PwaUpdateBanner));

    expect(screen.getByText('Neue Version verfügbar')).toBeTruthy();

    await press(screen.getByLabelText('Update jetzt anwenden'));
    expect(state.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed, hiding the banner without calling applyUpdate', async () => {
    state.updateReady = true;
    const { PwaUpdateBanner } = await import('@/components/PwaUpdateBanner');
    const { toJSON } = render(React.createElement(PwaUpdateBanner));

    expect(screen.getByText('Neue Version verfügbar')).toBeTruthy();

    await press(screen.getByLabelText('Hinweis ausblenden'));

    expect(screen.queryByText('Neue Version verfügbar')).toBeNull();
    expect(toJSON()).toBeNull();
    expect(state.applyUpdate).not.toHaveBeenCalled();
  });
});
